const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

const password = 'faculty123';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Hash error:', err);
        return;
    }
    console.log('Generated hash:', hash);
    db.run('UPDATE Faculty SET password = ?', [hash], function(err) {
        if (err) {
            console.error('Update error:', err);
        } else {
            console.log(`SUCCESS: Updated ${this.changes} faculty passwords to "faculty123"`);
        }
        db.close();
    });
});
