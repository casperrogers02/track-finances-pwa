const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all goals
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY deadline ASC, created_at DESC',
      [userId]
    );
    res.json({ goals: result.rows });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create goal
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, target_amount, progress = 0, deadline } = req.body;
    const userId = req.user.id;
    
    if (!title || !target_amount) {
      return res.status(400).json({ error: 'Title and target amount are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO goals (user_id, title, target_amount, progress, deadline) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title, target_amount, progress, deadline || null]
    );
    
    res.status(201).json({ goal: result.rows[0] });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update goal
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, target_amount, progress, deadline } = req.body;
    const userId = req.user.id;
    
    // Verify goal belongs to user
    const checkResult = await pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const updateFields = [];
    const params = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (target_amount !== undefined) {
      updateFields.push(`target_amount = $${paramCount++}`);
      params.push(target_amount);
    }
    if (progress !== undefined) {
      updateFields.push(`progress = $${paramCount++}`);
      params.push(progress);
    }
    if (deadline !== undefined) {
      updateFields.push(`deadline = $${paramCount++}`);
      params.push(deadline);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(id, userId);
    const query = `UPDATE goals SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, params);
    res.json({ goal: result.rows[0] });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete goal
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

