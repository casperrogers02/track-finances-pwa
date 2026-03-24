const pool = require('../config/database');

async function checkDuplicates() {
    try {
        console.log('Checking for duplicate categories...\n');

        // Get all categories
        const result = await pool.query('SELECT id, name, type FROM categories ORDER BY type, name');

        console.log(`Total categories in database: ${result.rows.length}\n`);

        // Group by name and type to find duplicates
        const grouped = {};
        result.rows.forEach(cat => {
            const key = `${cat.type}-${cat.name}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(cat);
        });

        // Find duplicates
        let hasDuplicates = false;
        Object.keys(grouped).forEach(key => {
            if (grouped[key].length > 1) {
                hasDuplicates = true;
                console.log(`\n❌ DUPLICATE FOUND: ${key}`);
                console.log(`   Appears ${grouped[key].length} times with IDs:`, grouped[key].map(c => c.id));
            }
        });

        if (!hasDuplicates) {
            console.log('\n✅ No duplicates found in database');
        }

        console.log('\n\nAll categories:');
        result.rows.forEach(cat => {
            console.log(`  ${cat.type.padEnd(10)} | ${cat.name.padEnd(20)} | ID: ${cat.id}`);
        });

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
        process.exit(1);
    }
}

checkDuplicates();
