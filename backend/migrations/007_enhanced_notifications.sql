-- Enhanced Notifications Table Migration
-- Drops existing table and recreates with advanced features

-- Drop existing notifications table
DROP TABLE IF EXISTS notifications CASCADE;

-- Create enhanced notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('goal', 'expense', 'income', 'security', 'report', 'sync', 'alert')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);

-- Create composite index for common query pattern
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'Enhanced notifications table with event-driven architecture support';
COMMENT ON COLUMN notifications.type IS 'Notification type: goal, expense, income, security, report, sync, alert';
COMMENT ON COLUMN notifications.priority IS 'Priority level: low, medium, high';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for notification context';
