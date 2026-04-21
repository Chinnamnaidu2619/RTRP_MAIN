const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

async function normalizeEmails() {
    return new Promise((resolve, reject) => {
        db.all('SELECT faculty_id, faculty_name FROM Faculty', [], (err, rows) => {
            if (err) return reject(err);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmt = db.prepare('UPDATE Faculty SET email = ? WHERE faculty_id = ?');

                rows.forEach(faculty => {
                    // Logic: Lowercase, remove all non-alphanumeric, add @mlrit.ac.in
                    const sanitizedName = faculty.faculty_name
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '');
                    const newEmail = sanitizedName + '@mlrit.ac.in';
                    
                    console.log(`Updating ${faculty.faculty_name} -> ${newEmail}`);
                    stmt.run(newEmail, faculty.faculty_id);
                });

                stmt.finalize();
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    });
}

normalizeEmails()
    .then(() => {
        console.log('Successfully normalized all faculty emails.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Failed to normalize emails:', err);
        process.exit(1);
    });
