const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/income');
const goalRoutes = require('./routes/goals');
const goalAllocationsRoutes = require('./routes/goal-allocations');
const reportRoutes = require('./routes/reports');
const categoryRoutes = require('./routes/categories');

const aiRoutes = require('./routes/ai');
const mobileMoneyRoutes = require('./routes/mobile-money');
const notificationRoutes = require('./routes/notifications');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'https://track-finances-pwa-production.up.railway.app',
  'https://track-finances-pwa.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, server-to-server, etc.)
    if (!origin) return callback(null, true);
    // Allow exact matches
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any Vercel preview deployment
    if (origin.match(/^https:\/\/track-finances-pwa.*\.vercel\.app$/)) return callback(null, true);
    // Reject others
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors()); // Enable pre-flight for all routes


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/goal-allocations', goalAllocationsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mobile-money', mobileMoneyRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SpendWise API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

