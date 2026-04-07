const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/timetable.db');

db.serialize(() => {
    // 1. Identify which rooms should be Labs (if they have 'Lab' or 'L' in the name, or just some of them)
    db.run("UPDATE Rooms SET room_type = 'Lab' WHERE room_id LIKE '%L%' OR room_id IN ('MG101', 'MG102', 'MG103', 'MG104', 'MG105')");
    console.log('Room types updated to include Labs.');
    db.close();
});
