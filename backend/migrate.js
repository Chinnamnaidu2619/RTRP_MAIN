const db = require('./db');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } else {
        console.log('Migration successful: All tables are ready.');
        process.exit(0);
    }
});
