const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join('d:', 'RTRP', 'timetable_system', 'backend', 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database counts...');

db.serialize(() => {
    db.get('SELECT COUNT(*) as count FROM Faculty', (err, row) => {
        console.log('Faculty count:', row ? row.count : 'Error: ' + err);
    });
    db.get('SELECT COUNT(*) as count FROM Subjects', (err, row) => {
        console.log('Subjects count:', row ? row.count : 'Error: ' + err);
    });
    db.get('SELECT COUNT(*) as count FROM Sections', (err, row) => {
        console.log('Sections count:', row ? row.count : 'Error: ' + err);
    });
    db.get('SELECT COUNT(*) as count FROM Rooms', (err, row) => {
        console.log('Rooms count:', row ? row.count : 'Error: ' + err);
    });
});

db.close();
