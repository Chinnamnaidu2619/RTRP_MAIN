const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/timetable.db');

const query = `
    SELECT t.period, COUNT(*) as count 
    FROM Timetable t 
    JOIN Subjects s ON t.subject_code = s.subject_code 
    WHERE s.subject_type = 'Lab' AND t.viva_faculty_id IS NOT NULL
    GROUP BY t.period
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Viva Faculty distribution by period:');
        console.table(rows);
        
        const invalidPeriods = rows.filter(r => ![2, 3, 5, 6].includes(r.period));
        if (invalidPeriods.length === 0) {
            console.log('SUCCESS: All viva assignments are in the 2nd period of lab blocks (2, 3, 5, 6).');
        } else {
            console.log('FAILURE: Some viva assignments are in invalid periods:', invalidPeriods);
        }
    }
    db.close();
});
