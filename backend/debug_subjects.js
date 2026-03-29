const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database('./database/timetable.db');
db.all('SELECT subject_code, subject_name, year, faculty_id FROM Subjects WHERE faculty_id IS NULL', (err, rows) => {
    if (err) console.error(err);
    else if (rows.length > 0) {
        console.log('Unassigned Subjects:');
        rows.forEach(r => console.log(`${r.subject_code} - ${r.subject_name} (Year ${r.year})`));
    } else {
        console.log('All subjects assigned.');
    }
    db.close();
});
