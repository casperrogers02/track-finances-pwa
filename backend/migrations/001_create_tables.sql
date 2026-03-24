-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone VARCHAR(50),
    preferred_currency VARCHAR(10) DEFAULT 'UGX',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    category VARCHAR(100) NOT NULL,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create income table
CREATE TABLE IF NOT EXISTS income (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    source VARCHAR(255) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_amount NUMERIC(12,2) NOT NULL,
    progress NUMERIC(12,2) DEFAULT 0,
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table (optional but recommended)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('expense', 'income')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Uganda-specific categories
INSERT INTO categories (name, type) VALUES
    ('Food & Groceries', 'expense'),
    ('Transport', 'expense'),
    ('Utilities', 'expense'),
    ('Rent', 'expense'),
    ('Healthcare', 'expense'),
    ('Education', 'expense'),
    ('Entertainment', 'expense'),
    ('Mobile Money', 'expense'),
    ('Shopping', 'expense'),
    ('Bills', 'expense'),
    ('Salary', 'income'),
    ('Business', 'income'),
    ('Freelance', 'income'),
    ('Investment', 'income'),
    ('Other Income', 'income')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_income_user_id ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

