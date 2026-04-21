const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/timetable.db');

const labRooms = [
    'MG 001', 'MG 002', 'MG 003', 'MG 004', 'MG 005', 'MG 006',
    'MG 403', 'MG 404', 'MG 405', 'MG 406'
];

db.serialize(() => {
    // Set type to 'Lab' for all requested rooms
    const placeholders = labRooms.map(() => '?').join(',');
    db.run(`UPDATE Rooms SET room_type = 'Lab' WHERE room_id IN (${placeholders})`, labRooms, function(err) {
        if (err) console.error('Update failed:', err.message);
        else console.log(`Updated ${this.changes} rooms to Lab type.`);
    });

    // Just to be sure, check if they exist first. If not, insert them?
    // User probably has them as classrooms.
    
    // Log final state
    db.all("SELECT room_id, room_type FROM Rooms WHERE room_type = 'Lab'", (err, rows) => {
        if (err) console.error(err);
        else console.log('Final Lab Rooms in System:', JSON.stringify(rows));
    });
});

db.close();
