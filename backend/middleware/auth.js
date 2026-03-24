const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify token exists in sessions table
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE token = $1 AND user_id = $2',
      [token, decoded.userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user details
    const userResult = await pool.query('SELECT id, full_name, email, phone, preferred_currency, profile_picture FROM users WHERE id = $1', [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = { authenticate };

