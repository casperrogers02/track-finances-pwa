const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all notifications with pagination
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND deleted_at IS NULL',
            [userId]
        );
        const totalCount = parseInt(countResult.rows[0].count);

        const result = await pool.query(
            `SELECT * FROM notifications 
             WHERE user_id = $1 AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            notifications: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL',
            [req.user.id]
        );
        res.json({ unreadCount: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark single notification as read
router.put('/:id/read', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = NOW()
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
             RETURNING *`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ notification: result.rows[0] });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = NOW()
             WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL
             RETURNING id`,
            [req.user.id]
        );
        res.json({ message: 'All notifications marked as read', count: result.rows.length });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Soft delete notification
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE notifications 
             SET deleted_at = NOW()
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
             RETURNING id`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create notification
router.post('/', authenticate, async (req, res) => {
    try {
        const { title, message, type, priority = 'medium', metadata = {} } = req.body;
        const result = await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, priority, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, title, message, type, priority, JSON.stringify(metadata)]
        );
        res.status(201).json({ notification: result.rows[0] });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
