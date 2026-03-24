-- Allow income_id to be NULL in goal_allocations (for manual allocations not tied to income)
-- This is needed because the original schema had income_id as NOT NULL

ALTER TABLE goal_allocations 
    ALTER COLUMN income_id DROP NOT NULL;

-- Add transaction_id column to income and expenses for duplicate checking
ALTER TABLE income
    ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

-- Add unique index on transaction_id for income (per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_transaction_id 
    ON income(user_id, transaction_id) 
    WHERE transaction_id IS NOT NULL;

-- Add unique index on transaction_id for expenses (per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_transaction_id 
    ON expenses(user_id, transaction_id) 
    WHERE transaction_id IS NOT NULL;
