-- Add currency_rates table for currency conversion
CREATE TABLE IF NOT EXISTS currency_rates (
    id SERIAL PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    rate NUMERIC(12, 6) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(base_currency, target_currency)
);

-- Add default UGX conversion rates (1 USD = 3800 UGX as an example)
INSERT INTO currency_rates (base_currency, target_currency, rate) VALUES
    ('USD', 'UGX', 3800.00),
    ('UGX', 'USD', 0.0002632)
ON CONFLICT (base_currency, target_currency) DO NOTHING;

-- Add sms_imports table for mobile money SMS tracking
CREATE TABLE IF NOT EXISTS sms_imports (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    transaction_type VARCHAR(50) NOT NULL,
    reference TEXT,
    sender TEXT,
    recipient TEXT,
    transaction_date TIMESTAMP,
    is_processed BOOLEAN DEFAULT FALSE,
    expense_id INT REFERENCES expenses(id) ON DELETE SET NULL,
    income_id INT REFERENCES income(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add goal_allocations table for tracking income-to-goal allocations
CREATE TABLE IF NOT EXISTS goal_allocations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    income_id INT NOT NULL REFERENCES income(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(goal_id, income_id)
);

-- Add mobile_money_settings table for user sync preferences
CREATE TABLE IF NOT EXISTS mobile_money_settings (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sync_enabled BOOLEAN DEFAULT FALSE,
    sync_incomes BOOLEAN DEFAULT TRUE,
    sync_expenses BOOLEAN DEFAULT TRUE,
    auto_approve BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add uploads table for file uploads
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add goal_progress table for tracking goal progress over time
CREATE TABLE IF NOT EXISTS goal_progress (
    id SERIAL PRIMARY KEY,
    goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    progress_amount NUMERIC(12, 2) NOT NULL,
    progress_percentage NUMERIC(5, 2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user_preferences table for user-specific settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    default_currency VARCHAR(10) DEFAULT 'UGX',
    notification_enabled BOOLEAN DEFAULT TRUE,
    weekly_report_enabled BOOLEAN DEFAULT FALSE,
    monthly_report_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_currency_rates_base ON currency_rates(base_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_target ON currency_rates(target_currency);
CREATE INDEX IF NOT EXISTS idx_sms_imports_user ON sms_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_imports_date ON sms_imports(transaction_date);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_user ON goal_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal ON goal_allocations(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_income ON goal_allocations(income_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_date ON goal_allocations(allocation_date);

-- Add column to track goal allocation in income table
ALTER TABLE income 
    ADD COLUMN IF NOT EXISTS is_allocated_to_goal BOOLEAN DEFAULT FALSE;

-- Add column to track currency in goals
ALTER TABLE goals
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX';

-- Add column to track if expense is linked to a goal
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS goal_id INT REFERENCES goals(id) ON DELETE SET NULL;

-- Add column to track transaction method in expenses
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

-- Add column to track transaction method in income
ALTER TABLE income
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

-- Add column to track transaction source (manual, sms_sync, statement_upload) in expenses
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual';

-- Add column to track transaction source (manual, sms_sync, statement_upload) in income
ALTER TABLE income
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual';

-- Add column for notes in goals
ALTER TABLE goals
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add column for color in categories
ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#4CAF50';

-- Update existing categories with colors
UPDATE categories SET 
    color = CASE 
        WHEN name = 'Food & Groceries' THEN '#4CAF50'
        WHEN name = 'Transport' THEN '#2196F3'
        WHEN name = 'Utilities' THEN '#9C27B0'
        WHEN name = 'Rent' THEN '#F44336'
        WHEN name = 'Healthcare' THEN '#E91E63'
        WHEN name = 'Education' THEN '#00BCD4'
        WHEN name = 'Entertainment' THEN '#FF9800'
        WHEN name = 'Mobile Money' THEN '#8BC34A'
        WHEN name = 'Shopping' THEN '#FF5722'
        WHEN name = 'Bills' THEN '#795548'
        WHEN name = 'Salary' THEN '#4CAF50'
        WHEN name = 'Business' THEN '#3F51B5'
        WHEN name = 'Freelance' THEN '#009688'
        WHEN name = 'Investment' THEN '#FFC107'
        WHEN name = 'Other Income' THEN '#9E9E9E'
        ELSE '#4CAF50'
    END;

-- Add default preferences for existing users
INSERT INTO user_preferences (user_id)
    SELECT id FROM users
    WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;
