const pool = require('../config/database');
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
    constructor() {
        super();
    }

    /**
     * Create a new notification
     * @param {string} userId - User ID (UUID)
     * @param {object} options - Notification options
     * @param {string} options.title - Notification title
     * @param {string} options.message - Notification message
     * @param {string} options.type - Notification type (goal, expense, income, security, report, sync, alert)
     * @param {string} options.priority - Priority level (low, medium, high)
     * @param {object} options.metadata - Additional JSON data
     * @returns {Promise<object>} Created notification
     */
    async createNotification(userId, { title, message, type, priority = 'medium', metadata = {} }) {
        try {
            const result = await pool.query(
                `INSERT INTO notifications (user_id, title, message, type, priority, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [userId, title, message, type, priority, JSON.stringify(metadata)]
            );

            const notification = result.rows[0];

            // Emit event for potential real-time updates
            this.emit('notification:created', notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Check if user is overspending (expenses > 80% of income)
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async checkOverspending(userId) {
        try {
            const currentMonth = new Date();
            const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            // Get total income for current month
            const incomeResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total
                 FROM income
                 WHERE user_id = $1 AND date >= $2 AND date <= $3`,
                [userId, firstDay, lastDay]
            );

            // Get total expenses for current month
            const expenseResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE user_id = $1 AND date >= $2 AND date <= $3`,
                [userId, firstDay, lastDay]
            );

            const totalIncome = parseFloat(incomeResult.rows[0].total);
            const totalExpenses = parseFloat(expenseResult.rows[0].total);

            if (totalIncome > 0) {
                const spendingPercentage = (totalExpenses / totalIncome) * 100;

                if (spendingPercentage >= 80) {
                    // Check if we already sent this alert today
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const existingAlert = await pool.query(
                        `SELECT id FROM notifications
                         WHERE user_id = $1 
                         AND type = 'alert' 
                         AND metadata->>'alert_type' = 'overspending'
                         AND created_at >= $2`,
                        [userId, today]
                    );

                    if (existingAlert.rows.length === 0) {
                        await this.createNotification(userId, {
                            title: '⚠️ Overspending Alert',
                            message: `You've spent ${spendingPercentage.toFixed(1)}% of your monthly income. Consider reviewing your expenses.`,
                            type: 'alert',
                            priority: 'high',
                            metadata: {
                                alert_type: 'overspending',
                                spending_percentage: spendingPercentage,
                                total_income: totalIncome,
                                total_expenses: totalExpenses
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error checking overspending:', error);
        }
    }

    /**
     * Check for goals with approaching deadlines
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async checkGoalDeadlines(userId) {
        try {
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            // Get goals with deadlines within 7 days and completion < 70%
            const goalsResult = await pool.query(
                `SELECT g.*, 
                        COALESCE(SUM(ga.allocated_amount), 0) as current_amount
                 FROM goals g
                 LEFT JOIN goal_allocations ga ON g.id = ga.goal_id
                 WHERE g.user_id = $1 
                 AND g.target_date <= $2 
                 AND g.target_date >= NOW()
                 GROUP BY g.id
                 HAVING COALESCE(SUM(ga.allocated_amount), 0) < (g.target_amount * 0.7)`,
                [userId, sevenDaysFromNow]
            );

            for (const goal of goalsResult.rows) {
                const completionPercentage = (goal.current_amount / goal.target_amount) * 100;
                const daysRemaining = Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24));

                // Check if we already sent this alert for this goal today
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const existingAlert = await pool.query(
                    `SELECT id FROM notifications
                     WHERE user_id = $1 
                     AND type = 'goal' 
                     AND metadata->>'goal_id' = $2
                     AND metadata->>'alert_type' = 'deadline_reminder'
                     AND created_at >= $3`,
                    [userId, goal.id.toString(), today]
                );

                if (existingAlert.rows.length === 0) {
                    await this.createNotification(userId, {
                        title: `🎯 Goal Deadline Approaching: ${goal.title}`,
                        message: `Your goal "${goal.title}" is ${daysRemaining} days away and only ${completionPercentage.toFixed(1)}% complete. Consider increasing your contributions.`,
                        type: 'goal',
                        priority: 'medium',
                        metadata: {
                            alert_type: 'deadline_reminder',
                            goal_id: goal.id,
                            days_remaining: daysRemaining,
                            completion_percentage: completionPercentage
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error checking goal deadlines:', error);
        }
    }

    /**
     * Check for user inactivity (no transactions in 14 days)
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async checkInactivity(userId) {
        try {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            // Check for recent expenses
            const expenseResult = await pool.query(
                `SELECT COUNT(*) as count
                 FROM expenses
                 WHERE user_id = $1 AND created_at >= $2`,
                [userId, fourteenDaysAgo]
            );

            // Check for recent income
            const incomeResult = await pool.query(
                `SELECT COUNT(*) as count
                 FROM income
                 WHERE user_id = $1 AND created_at >= $2`,
                [userId, fourteenDaysAgo]
            );

            const hasRecentActivity =
                parseInt(expenseResult.rows[0].count) > 0 ||
                parseInt(incomeResult.rows[0].count) > 0;

            if (!hasRecentActivity) {
                // Check if we already sent this alert in the last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const existingAlert = await pool.query(
                    `SELECT id FROM notifications
                     WHERE user_id = $1 
                     AND type = 'alert' 
                     AND metadata->>'alert_type' = 'inactivity'
                     AND created_at >= $2`,
                    [userId, sevenDaysAgo]
                );

                if (existingAlert.rows.length === 0) {
                    await this.createNotification(userId, {
                        title: '📊 Stay on Track!',
                        message: 'You haven\'t recorded any transactions in 14 days. Keep your financial tracking up to date!',
                        type: 'alert',
                        priority: 'low',
                        metadata: {
                            alert_type: 'inactivity',
                            days_inactive: 14
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error checking inactivity:', error);
        }
    }

    /**
     * Check for large transactions
     * @param {string} userId - User ID
     * @param {number} amount - Transaction amount
     * @param {string} type - Transaction type (expense or income)
     * @param {number} threshold - Large transaction threshold (default 500 USD equivalent)
     * @returns {Promise<void>}
     */
    async checkLargeTransaction(userId, amount, type, threshold = 1800000) {
        try {
            if (amount >= threshold) {
                await this.createNotification(userId, {
                    title: `💰 Large ${type === 'expense' ? 'Expense' : 'Income'} Detected`,
                    message: `You just recorded a large ${type} of ${amount.toLocaleString()} UGX.`,
                    type: type,
                    priority: 'medium',
                    metadata: {
                        alert_type: 'large_transaction',
                        amount: amount,
                        transaction_type: type
                    }
                });
            }
        } catch (error) {
            console.error('Error checking large transaction:', error);
        }
    }

    /**
     * Create goal milestone notification
     * @param {string} userId - User ID
     * @param {object} goal - Goal object
     * @param {number} percentage - Completion percentage
     * @returns {Promise<void>}
     */
    async createGoalMilestoneNotification(userId, goal, percentage) {
        try {
            const milestones = [25, 50, 75, 100];
            const milestone = milestones.find(m => percentage >= m && percentage < m + 5);

            if (milestone) {
                // Check if we already sent this milestone notification
                const existingNotification = await pool.query(
                    `SELECT id FROM notifications
                     WHERE user_id = $1 
                     AND type = 'goal' 
                     AND metadata->>'goal_id' = $2
                     AND metadata->>'milestone' = $3`,
                    [userId, goal.id.toString(), milestone.toString()]
                );

                if (existingNotification.rows.length === 0) {
                    const emoji = milestone === 100 ? '🎉' : milestone === 75 ? '🔥' : milestone === 50 ? '💪' : '🌟';
                    const message = milestone === 100
                        ? `Congratulations! You've completed your goal "${goal.title}"!`
                        : `You've reached ${milestone}% of your goal "${goal.title}". Keep going!`;

                    await this.createNotification(userId, {
                        title: `${emoji} Goal Milestone: ${milestone}%`,
                        message: message,
                        type: 'goal',
                        priority: milestone === 100 ? 'high' : 'medium',
                        metadata: {
                            alert_type: 'milestone',
                            goal_id: goal.id,
                            milestone: milestone,
                            completion_percentage: percentage
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error creating goal milestone notification:', error);
        }
    }
}

// Export singleton instance
module.exports = new NotificationService();
