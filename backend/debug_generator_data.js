const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/timetable.db');

db.serialize(() => {
    console.log('--- Faculty Emails ---');
    db.all('SELECT email, faculty_name FROM Faculty', (err, rows) => {
        if (err) return console.error(err);
        rows.forEach(r => console.log(`${r.email} (${r.faculty_name})`));
    });

    console.log('\n--- All Subjects (assigned and unassigned) ---');
    db.all('SELECT subject_code, subject_name, year, faculty_id FROM Subjects', (err, rows) => {
        if (err) return console.error(err);
        rows.forEach(r => console.log(`${r.subject_code} - ${r.subject_name} (Year ${r.year}) -> Faculty ID: ${r.faculty_id}`));
    });
});

db.close();
