const pool = require('../config/database');

async function removeDuplicates() {
    try {
        console.log('Starting duplicate removal...\n');

        // Delete duplicates, keeping only the one with the lowest ID for each name+type combination
        const deleteQuery = `
            DELETE FROM categories
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM categories
                GROUP BY name, type
            )
        `;

        const result = await pool.query(deleteQuery);
        console.log(`✅ Removed ${result.rowCount} duplicate categories\n`);

        // Show remaining categories
        const remaining = await pool.query('SELECT id, name, type FROM categories ORDER BY type, name');
        console.log(`Remaining categories: ${remaining.rows.length}\n`);

        remaining.rows.forEach(cat => {
            console.log(`  ${cat.type.padEnd(10)} | ${cat.name.padEnd(20)} | ID: ${cat.id}`);
        });

        await pool.end();
        console.log('\n✅ Cleanup complete!');
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
        process.exit(1);
    }
}

removeDuplicates();
