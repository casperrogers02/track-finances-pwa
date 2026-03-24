const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all expenses with pagination and filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, from, to, category } = req.query;
    const userId = req.user.id;

    let query = 'SELECT * FROM expenses WHERE user_id = $1';
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

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += ` ORDER BY date DESC, created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM expenses WHERE user_id = $1';
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

    if (category) {
      countParamCount++;
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      expenses: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create expense
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'UGX', category, description, date, transaction_id } = req.body;
    const userId = req.user.id;

    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category are required' });
    }

    const result = await pool.query(
      'INSERT INTO expenses (user_id, amount, currency, category, description, date, transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, amount, currency, category, description || null, date || new Date().toISOString().split('T')[0], transaction_id || null]
    );

    const expense = result.rows[0];

    // Import notification service
    const notificationService = require('../services/notificationService');

    // Create basic expense notification
    await notificationService.createNotification(userId, {
      title: '💸 Expense Added',
      message: `You added an expense of ${expense.currency} ${expense.amount.toLocaleString()} for ${expense.category}.`,
      type: 'expense',
      priority: 'low',
      metadata: {
        expense_id: expense.id,
        amount: expense.amount,
        category: expense.category
      }
    });

    // Check for large transaction (async, don't wait)
    notificationService.checkLargeTransaction(userId, expense.amount, 'expense').catch(err =>
      console.error('Error checking large transaction:', err)
    );

    // Check for overspending (async, don't wait)
    notificationService.checkOverspending(userId).catch(err =>
      console.error('Error checking overspending:', err)
    );

    res.status(201).json({ expense });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'idx_expenses_transaction_id') {
      return res.status(409).json({ error: 'Duplicate transaction. This SMS has already been recorded.' });
    }
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update expense
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, category, description, date } = req.body;
    const userId = req.user.id;

    // Verify expense belongs to user
    const checkResult = await pool.query('SELECT id FROM expenses WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
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
    if (category !== undefined) {
      updateFields.push(`category = $${paramCount++}`);
      params.push(category);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (date !== undefined) {
      updateFields.push(`date = $${paramCount++}`);
      params.push(date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, userId);
    const query = `UPDATE expenses SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, params);
    res.json({ expense: result.rows[0] });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete expense
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get expense summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    let query = 'SELECT SUM(amount) as total, currency, category FROM expenses WHERE user_id = $1';
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

    query += ' GROUP BY currency, category';

    const result = await pool.query(query, params);
    res.json({ summary: result.rows });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

