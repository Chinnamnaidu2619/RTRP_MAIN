const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/timetable.db');

const roomsToConvert = ['MG 001', 'MG 004', 'MG 006', 'MG 405'];

db.serialize(() => {
    const placeholders = roomsToConvert.map(() => '?').join(',');
    db.run(`UPDATE Rooms SET room_type = 'Lab' WHERE room_id IN (${placeholders})`, roomsToConvert, function(err) {
        if (err) {
            console.error('Update failed:', err.message);
        } else {
            console.log(`Updated ${this.changes} rooms to Lab type.`);
        }
    });

    db.all("SELECT room_id, room_type FROM Rooms WHERE room_id IN ('MG 001', 'MG 002', 'MG 003', 'MG 004', 'MG 005', 'MG 006', 'MG 405')", (err, rows) => {
        if (err) console.error(err);
        else console.log('Current Lab Room Status:', JSON.stringify(rows, null, 2));
    });
});

db.close();
