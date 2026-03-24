const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { convert } = require('../utils/currency');

const router = express.Router();

// Get date range for period
function getDateRange(period) {
  const today = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(today.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(today.getDate() - 7);
      break;
    case '2weeks':
      startDate.setDate(today.getDate() - 14);
      break;
    case '3weeks':
      startDate.setDate(today.getDate() - 21);
      break;
    case 'month':
      startDate.setMonth(today.getMonth() - 1);
      break;
    default:
      startDate.setMonth(today.getMonth() - 1);
  }
  
  return {
    from: startDate.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0]
  };
}

// Get summary report
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const userId = req.user.id;
    const { from, to } = getDateRange(period);
    
    // Get user's preferred currency
    const userResult = await pool.query('SELECT preferred_currency FROM users WHERE id = $1', [userId]);
    const preferredCurrency = userResult.rows[0]?.preferred_currency || 'UGX';
    
    // Get expenses
    const expensesResult = await pool.query(
      `SELECT amount, currency, category, date FROM expenses 
       WHERE user_id = $1 AND date >= $2 AND date <= $3 
       ORDER BY date DESC`,
      [userId, from, to]
    );
    
    // Get income
    const incomeResult = await pool.query(
      `SELECT amount, currency, source, date FROM income 
       WHERE user_id = $1 AND date >= $2 AND date <= $3 
       ORDER BY date DESC`,
      [userId, from, to]
    );
    
    // Convert all amounts to preferred currency
    const expenses = expensesResult.rows.map(exp => ({
      ...exp,
      converted_amount: convert(parseFloat(exp.amount), exp.currency, preferredCurrency),
      original_amount: parseFloat(exp.amount),
      original_currency: exp.currency
    }));
    
    const income = incomeResult.rows.map(inc => ({
      ...inc,
      converted_amount: convert(parseFloat(inc.amount), inc.currency, preferredCurrency),
      original_amount: parseFloat(inc.amount),
      original_currency: inc.currency
    }));
    
    // Calculate totals
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.converted_amount, 0);
    const totalIncome = income.reduce((sum, inc) => sum + inc.converted_amount, 0);
    const balance = totalIncome - totalExpenses;
    
    // Group by category
    const expensesByCategory = {};
    expenses.forEach(exp => {
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += exp.converted_amount;
    });
    
    // Group by source
    const incomeBySource = {};
    income.forEach(inc => {
      if (!incomeBySource[inc.source]) {
        incomeBySource[inc.source] = 0;
      }
      incomeBySource[inc.source] += inc.converted_amount;
    });
    
    // Daily spending
    const dailySpending = {};
    expenses.forEach(exp => {
      const date = exp.date;
      if (!dailySpending[date]) {
        dailySpending[date] = 0;
      }
      dailySpending[date] += exp.converted_amount;
    });
    
    res.json({
      period,
      from,
      to,
      currency: preferredCurrency,
      summary: {
        totalIncome,
        totalExpenses,
        balance
      },
      expenses: expenses,
      income: income,
      expensesByCategory,
      incomeBySource,
      dailySpending
    });
  } catch (error) {
    console.error('Get report summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export CSV
router.get('/export', authenticate, async (req, res) => {
  try {
    const { period = 'month', format = 'csv' } = req.query;
    const userId = req.user.id;
    const { from, to } = getDateRange(period);
    
    // Get user's preferred currency
    const userResult = await pool.query('SELECT preferred_currency FROM users WHERE id = $1', [userId]);
    const preferredCurrency = userResult.rows[0]?.preferred_currency || 'UGX';
    
    // Get expenses
    const expensesResult = await pool.query(
      `SELECT amount, currency, category, description, date FROM expenses 
       WHERE user_id = $1 AND date >= $2 AND date <= $3 
       ORDER BY date DESC`,
      [userId, from, to]
    );
    
    // Get income
    const incomeResult = await pool.query(
      `SELECT amount, currency, source, date FROM income 
       WHERE user_id = $1 AND date >= $2 AND date <= $3 
       ORDER BY date DESC`,
      [userId, from, to]
    );
    
    if (format === 'csv') {
      // Generate CSV
      let csv = 'Type,Date,Category/Source,Amount,Currency,Description\n';
      
      expensesResult.rows.forEach(exp => {
        const converted = convert(parseFloat(exp.amount), exp.currency, preferredCurrency);
        csv += `Expense,${exp.date},${exp.category},${converted},${preferredCurrency},"${exp.description || ''}"\n`;
      });
      
      incomeResult.rows.forEach(inc => {
        const converted = convert(parseFloat(inc.amount), inc.currency, preferredCurrency);
        csv += `Income,${inc.date},${inc.source},${converted},${preferredCurrency},\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=spendwise-report-${period}-${from}-to-${to}.csv`);
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use csv' });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

