const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM categories';
    const params = [];
    
    if (type) {
      query += ' WHERE type = $1';
      params.push(type);
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

