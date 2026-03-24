const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Initialize Gemini
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
let genAI = null;
let model = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  // Use supported “latest” model names (older gemini-1.5-flash is retired in many setups)
  model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
}

// Get chat history
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch last 50 messages
    const result = await pool.query(
      'SELECT role, content, created_at FROM ai_chats WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50',
      [userId]
    );

    const history = result.rows.map(row => ({
      // Gemini stores assistant responses as 'model'. Older rows may store 'assistant'.
      role: (row.role === 'model' || row.role === 'assistant') ? 'assistant' : 'user',
      text: row.content,
      timestamp: row.created_at
    }));

    res.json({ history });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Chat with AI assistant
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!model) {
      return res.status(500).json({
        error: 'AI service is not configured. Please set GOOGLE_API_KEY in your backend .env file.',
      });
    }

    const userId = req.user.id;

    // 1. Fetch recent history from DB for context (exclude current message)
    // Limit to last 20 messages for context window management
    const historyResult = await pool.query(
      'SELECT role, content FROM ai_chats WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    // Reverse to chronological order for Gemini
    const normalizeRole = (r) => {
      if (r === 'user') return 'user';
      if (r === 'model') return 'model';
      // Backward compat: some older rows might store 'assistant'
      if (r === 'assistant') return 'model';
      // Unknown role: safest fallback is treating it as user content
      return 'user';
    };

    const dbHistory = historyResult.rows.reverse().map(row => ({
      role: normalizeRole(row.role),
      parts: [{ text: row.content }]
    }));

    // 2. Save User Message to DB
    await pool.query(
      'INSERT INTO ai_chats (user_id, role, content) VALUES ($1, $2, $3)',
      [userId, 'user', message]
    );

    // 3. Prepare Context
    // Parse context
    let systemInstructions = '';
    let financialDataSummary = '';

    if (context) {
      try {
        const contextObj = typeof context === 'string' ? JSON.parse(context) : context;
        if (contextObj.system_instructions) systemInstructions = contextObj.system_instructions;

        // Format financial data
        if (contextObj.user_financial_data) {
          const data = contextObj.user_financial_data;
          financialDataSummary = `User's Financial Summary (Currency: ${data.currency}):\n` +
            `- Income: ${data.totalIncome?.toLocaleString() || 0}, Expenses: ${data.totalExpenses?.toLocaleString() || 0}\n` +
            `- Balance: ${data.balance?.toLocaleString() || 0}, Savings Rate: ${data.savingsRate || 0}%\n`;

          if (data.topExpenseCategories?.length) {
            financialDataSummary += `- Top Expenses: ${data.topExpenseCategories.slice(0, 3).map(c => `${c.category} (${c.percentage}%)`).join(', ')}\n`;
          }
          if (data.goals?.length) {
            financialDataSummary += `- Goals: ${data.goals.map(g => `${g.title} (${g.percentage}%)`).join(', ')}\n`;
          }
        } else {
          // Fallback if structure is different
          if (typeof context === 'string') financialDataSummary = `User context: ${context}`;
        }
      } catch (e) {
        financialDataSummary = `User context: ${context}`;
      }
    }

    const defaultSystemInstructions = 'You are a helpful, knowledgeable financial advisor for SpendWise in Uganda. Be friendly, practical, and specific to the Ugandan context (e.g. suggesting SACCOs, mobile money, local markets). Use the provided financial data to give personalized advice.';

    // Start Chat Session
    let chat;
    try {
      chat = model.startChat({
        history: dbHistory,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });
    } catch (err) {
      // Fallback if history is malformed or throws validation errors
      console.warn('Invalid chat history format, starting clean session limit');
      chat = model.startChat({
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });
    }

    // Construct Prompt
    const contextBlock = `
[SYSTEM INSTRUCTIONS]
${systemInstructions || defaultSystemInstructions}

[FINANCIAL CONTEXT]
${financialDataSummary}
`;

    const fullPrompt = `${contextBlock}\n\nUser Question: ${message}`;

    // 4. Send Message to Gemini
    const result = await chat.sendMessage(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    // 5. Save AI Response to DB
    await pool.query(
      'INSERT INTO ai_chats (user_id, role, content) VALUES ($1, $2, $3)',
      [userId, 'model', reply]
    );

    res.json({ reply });
  } catch (error) {
    console.error('Gemini AI chat error:', error);
    res.status(500).json({
      error: 'Failed to get AI response. Please try again.',
      details: error && error.message ? error.message : String(error)
    });
  }
});

module.exports = router;
