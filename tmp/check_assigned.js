const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join('d:', 'RTRP', 'timetable_system', 'backend', 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking for unassigned subjects...');

db.serialize(() => {
    db.all('SELECT subject_code, subject_name, year, faculty_id FROM Subjects WHERE faculty_id IS NULL', (err, rows) => {
        if (err) {
            console.error('Error querying subjects:', err.message);
            return;
        }
        if (rows.length > 0) {
            console.log('--- Unassigned Subjects ---');
            rows.forEach(r => console.log(`${r.subject_code} - ${r.subject_name} (Year ${r.year})`));
            console.log('Total:', rows.length);
        } else {
            console.log('All subjects have faculty assigned.');
        }
    });
});

db.close();
