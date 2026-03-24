const pool = require('../config/database');

async function runMigration() {
    try {
        console.log('Starting enhanced notifications migration...\n');

        // Drop existing notifications table
        console.log('Dropping existing notifications table...');
        await pool.query('DROP TABLE IF EXISTS notifications CASCADE');
        console.log('✅ Dropped existing table\n');

        // Create enhanced notifications table
        console.log('Creating enhanced notifications table...');
        await pool.query(`
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
            )
        `);
        console.log('✅ Created notifications table\n');

        // Create indexes
        console.log('Creating indexes...');
        await pool.query('CREATE INDEX idx_notifications_user_id ON notifications(user_id)');
        await pool.query('CREATE INDEX idx_notifications_is_read ON notifications(is_read)');
        await pool.query('CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC)');
        await pool.query('CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false');
        await pool.query('CREATE INDEX idx_notifications_type ON notifications(type)');
        await pool.query('CREATE INDEX idx_notifications_priority ON notifications(priority)');
        await pool.query('CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC)');
        console.log('✅ Created all indexes\n');

        // Add comments
        await pool.query("COMMENT ON TABLE notifications IS 'Enhanced notifications table with event-driven architecture support'");
        await pool.query("COMMENT ON COLUMN notifications.type IS 'Notification type: goal, expense, income, security, report, sync, alert'");
        await pool.query("COMMENT ON COLUMN notifications.priority IS 'Priority level: low, medium, high'");
        await pool.query("COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for notification context'");

        console.log('✅ Migration completed successfully!\n');

        // Verify the table
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            ORDER BY ordinal_position
        `);

        console.log('Notifications table schema:');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
