const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all income with pagination and filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, from, to, source } = req.query;
    const userId = req.user.id;

    let query = 'SELECT * FROM income WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (from) {
      paramCount++;
      query += ` AND date >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND date <= $${paramCount}`;
      params.push(to);
    }

    if (source) {
      paramCount++;
      query += ` AND source = $${paramCount}`;
      params.push(source);
    }

    query += ` ORDER BY date DESC, created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM income WHERE user_id = $1';
    const countParams = [userId];
    let countParamCount = 1;

    if (from) {
      countParamCount++;
      countQuery += ` AND date >= $${countParamCount}`;
      countParams.push(from);
    }

    if (to) {
      countParamCount++;
      countQuery += ` AND date <= $${countParamCount}`;
      countParams.push(to);
    }

    if (source) {
      countParamCount++;
      countQuery += ` AND source = $${countParamCount}`;
      countParams.push(source);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      income: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create income
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'UGX', source, date, transaction_id } = req.body;
    const userId = req.user.id;

    if (!amount || !source) {
      return res.status(400).json({ error: 'Amount and source are required' });
    }

    const result = await pool.query(
      'INSERT INTO income (user_id, amount, currency, source, date, transaction_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, amount, currency, source, date || new Date().toISOString().split('T')[0], transaction_id || null]
    );

    const income = result.rows[0];

    // Import notification service
    const notificationService = require('../services/notificationService');

    // Create basic income notification
    await notificationService.createNotification(userId, {
      title: '💰 Income Added',
      message: `You added income of ${income.currency} ${income.amount.toLocaleString()} from ${income.source}.`,
      type: 'income',
      priority: 'low',
      metadata: {
        income_id: income.id,
        amount: income.amount,
        source: income.source
      }
    });

    // Check for large transaction (async, don't wait)
    notificationService.checkLargeTransaction(userId, income.amount, 'income').catch(err =>
      console.error('Error checking large transaction:', err)
    );

    res.status(201).json({ income });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'idx_income_transaction_id') {
      return res.status(409).json({ error: 'Duplicate transaction. This SMS has already been recorded.' });
    }
    console.error('Create income error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update income
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, source, date } = req.body;
    const userId = req.user.id;

    // Verify income belongs to user
    const checkResult = await pool.query('SELECT id FROM income WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (amount !== undefined) {
      updateFields.push(`amount = $${paramCount++}`);
      params.push(amount);
    }
    if (currency !== undefined) {
      updateFields.push(`currency = $${paramCount++}`);
      params.push(currency);
    }
    if (source !== undefined) {
      updateFields.push(`source = $${paramCount++}`);
      params.push(source);
    }
    if (date !== undefined) {
      updateFields.push(`date = $${paramCount++}`);
      params.push(date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, userId);
    const query = `UPDATE income SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, params);
    res.json({ income: result.rows[0] });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete income
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query('DELETE FROM income WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }

    res.json({ message: 'Income deleted successfully' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get income summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    let query = 'SELECT SUM(amount) as total, currency, source FROM income WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (from) {
      paramCount++;
      query += ` AND date >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND date <= $${paramCount}`;
      params.push(to);
    }

    query += ' GROUP BY currency, source';

    const result = await pool.query(query, params);
    res.json({ summary: result.rows });
  } catch (error) {
    console.error('Get income summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

