const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure upload storage - use memory storage so we can convert to base64
// and store in DB (avoids Railway ephemeral filesystem issues for cross-device sync)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, password, phone, preferred_currency = 'UGX' } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, phone, preferred_currency) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, preferred_currency',
      [full_name, email, password_hash, phone || null, preferred_currency]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Store session
    await pool.query('INSERT INTO sessions (user_id, token) VALUES ($1, $2)', [user.id, token]);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        email: user.email,
        phone: user.phone,
        preferred_currency: user.preferred_currency,
        profile_picture: null
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Store session
    await pool.query('INSERT INTO sessions (user_id, token) VALUES ($1, $2)', [user.id, token]);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        email: user.email,
        phone: user.phone,
        preferred_currency: user.preferred_currency,
        profile_picture: user.profile_picture
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        full_name: req.user.full_name,
        email: req.user.email,
        phone: req.user.phone,
        preferred_currency: req.user.preferred_currency,
        profile_picture: req.user.profile_picture
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get profile picture
router.get('/profile/picture', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT profile_picture FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ profile_picture: result.rows[0].profile_picture || null });
  } catch (error) {
    console.error('Get profile picture error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload profile picture - stores as base64 in DB for cross-device sync
router.post('/profile/picture', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Convert buffer to base64 data URL and store in DB
    // This ensures the picture syncs across all devices via the /me endpoint
    const mimeType = req.file.mimetype;
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Update user in DB with base64 image
    await pool.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [dataUrl, req.user.id]);

    res.json({
      message: 'Profile picture updated',
      profile_picture: dataUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

// Update profile (name, phone, email)
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { full_name, phone, email } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (email !== undefined && email !== req.user.email) {
      // Check if email is already taken
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.json({ message: 'No changes to update', user: req.user });
    }

    values.push(req.user.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, full_name, email, phone, preferred_currency, profile_picture`,
      values
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token = $1', [req.token]);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// Update preferred currency
router.put('/currency', authenticate, async (req, res) => {
  try {
    const { preferred_currency } = req.body;

    if (!preferred_currency) {
      return res.status(400).json({ error: 'Currency is required' });
    }

    await pool.query(
      'UPDATE users SET preferred_currency = $1 WHERE id = $2',
      [preferred_currency, req.user.id]
    );

    res.json({ message: 'Currency updated successfully', preferred_currency });
  } catch (error) {
    console.error('Currency update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Get user to check current password
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    // Hash new password
    const saltRounds = 10;
    const new_password_hash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [new_password_hash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

