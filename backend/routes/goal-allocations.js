const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all goal allocations (optionally filtered by goal_id or income_id)
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { goal_id, income_id } = req.query;

        let query = 'SELECT * FROM goal_allocations WHERE user_id = $1';
        const params = [userId];
        let paramCount = 2;

        if (goal_id) {
            query += ` AND goal_id = $${paramCount++}`;
            params.push(goal_id);
        }

        if (income_id) {
            query += ` AND income_id = $${paramCount++}`;
            params.push(income_id);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json({ allocations: result.rows });
    } catch (error) {
        console.error('Get goal allocations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create goal allocation
router.post('/', authenticate, async (req, res) => {
    try {
        const { goal_id, income_id, amount, allocated_amount, currency } = req.body;
        const userId = req.user.id;

        const finalAmount = amount ?? allocated_amount;
        // NOTE: amount may come as number/string; we only reject null/undefined
        if (!goal_id || finalAmount === null || finalAmount === undefined) {
            return res.status(400).json({ error: 'Goal ID and amount are required' });
        }

        // Verify goal belongs to user
        const goalCheck = await pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [goal_id, userId]);
        if (goalCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Create allocation (use allocated_amount column as per database schema)
        const result = await pool.query(
            `INSERT INTO goal_allocations (user_id, goal_id, income_id, allocated_amount, currency, allocation_date) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
            [userId, goal_id, income_id || null, finalAmount, currency || 'UGX']
        );

        // Update goal progress
        const allocationsSum = await pool.query(
            'SELECT COALESCE(SUM(allocated_amount), 0) as total FROM goal_allocations WHERE goal_id = $1',
            [goal_id]
        );

        await pool.query(
            'UPDATE goals SET progress = $1 WHERE id = $2',
            [allocationsSum.rows[0].total, goal_id]
        );

        res.status(201).json({ allocation: result.rows[0] });
    } catch (error) {
        console.error('Create goal allocation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update goal allocation
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, allocated_amount } = req.body;
        const userId = req.user.id;

        // Verify allocation belongs to user
        const checkResult = await pool.query(
            'SELECT id, goal_id FROM goal_allocations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Allocation not found' });
        }

        const goalId = checkResult.rows[0].goal_id;

        const finalAmount = amount ?? allocated_amount;
        if (finalAmount === null || finalAmount === undefined) {
            return res.status(400).json({ error: 'Allocation amount is required' });
        }

        const result = await pool.query(
            'UPDATE goal_allocations SET allocated_amount = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [finalAmount, id, userId]
        );

        // Update goal progress
        const allocationsSum = await pool.query(
            'SELECT COALESCE(SUM(allocated_amount), 0) as total FROM goal_allocations WHERE goal_id = $1',
            [goalId]
        );

        await pool.query(
            'UPDATE goals SET progress = $1 WHERE id = $2',
            [allocationsSum.rows[0].total, goalId]
        );

        res.json({ allocation: result.rows[0] });
    } catch (error) {
        console.error('Update goal allocation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete goal allocation
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Get goal_id before deleting
        const checkResult = await pool.query(
            'SELECT goal_id FROM goal_allocations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Allocation not found' });
        }

        const goalId = checkResult.rows[0].goal_id;

        await pool.query('DELETE FROM goal_allocations WHERE id = $1 AND user_id = $2', [id, userId]);

        // Update goal progress
        const allocationsSum = await pool.query(
            'SELECT COALESCE(SUM(allocated_amount), 0) as total FROM goal_allocations WHERE goal_id = $1',
            [goalId]
        );

        await pool.query(
            'UPDATE goals SET progress = $1 WHERE id = $2',
            [allocationsSum.rows[0].total, goalId]
        );

        res.json({ message: 'Allocation deleted successfully' });
    } catch (error) {
        console.error('Delete goal allocation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete all allocations for a specific income
router.delete('/income/:incomeId', authenticate, async (req, res) => {
    try {
        const { incomeId } = req.params;
        const userId = req.user.id;

        // Get affected goal IDs
        const allocations = await pool.query(
            'SELECT DISTINCT goal_id FROM goal_allocations WHERE income_id = $1 AND user_id = $2',
            [incomeId, userId]
        );

        const goalIds = allocations.rows.map(r => r.goal_id);

        // Delete allocations
        await pool.query(
            'DELETE FROM goal_allocations WHERE income_id = $1 AND user_id = $2',
            [incomeId, userId]
        );

        // Update progress for affected goals
        for (const goalId of goalIds) {
            const allocationsSum = await pool.query(
                'SELECT COALESCE(SUM(allocated_amount), 0) as total FROM goal_allocations WHERE goal_id = $1',
                [goalId]
            );

            await pool.query(
                'UPDATE goals SET progress = $1 WHERE id = $2',
                [allocationsSum.rows[0].total, goalId]
            );
        }

        res.json({ message: 'Allocations deleted successfully' });
    } catch (error) {
        console.error('Delete allocations by income error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete all allocations for a specific goal
router.delete('/goal/:goalId', authenticate, async (req, res) => {
    try {
        const { goalId } = req.params;
        const userId = req.user.id;

        await pool.query(
            'DELETE FROM goal_allocations WHERE goal_id = $1 AND user_id = $2',
            [goalId, userId]
        );

        // Update goal progress to 0
        await pool.query(
            'UPDATE goals SET progress = 0 WHERE id = $1 AND user_id = $2',
            [goalId, userId]
        );

        res.json({ message: 'Allocations deleted successfully' });
    } catch (error) {
        console.error('Delete allocations by goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
