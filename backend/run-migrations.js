const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

async function runMigrations() {
    try {
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sort to ensure migrations run in order

        console.log('Running migrations...\n');

        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`Running ${file}...`);
            await pool.query(sql);
            console.log(`✓ ${file} completed\n`);
        }

        console.log('All migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

runMigrations();
