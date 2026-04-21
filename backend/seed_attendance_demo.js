const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

const demoEntries = [
    { section_id: 120, subject_code: 'A6AI17', faculty_id: 162, room_id: 'MG 201', day: 'Monday', period: 3 },
    { section_id: 121, subject_code: 'A6IT11', faculty_id: 162, room_id: 'MG 202', day: 'Monday', period: 4 },
    { section_id: 113, subject_code: 'A6CS08', faculty_id: 161, room_id: 'MG 101', day: 'Monday', period: 3 },
    { section_id: 114, subject_code: 'A6CS09', faculty_id: 172, room_id: 'MG 102', day: 'Monday', period: 3 },
];

const expertiseData = [
    { faculty_id: 184, subject_code: 'A6AI17', year: 3 },
    { faculty_id: 170, subject_code: 'A6IT39', year: 3 },
    { faculty_id: 204, subject_code: 'A6IT11', year: 3 },
    { faculty_id: 159, subject_code: 'A6CS16', year: 3 },
];

db.serialize(() => {
    console.log('Clearing old demo data...');
    db.run("DELETE FROM Timetable WHERE day = 'Monday' AND section_id IN (113, 114, 120, 121)");
    db.run("DELETE FROM SubjectFaculty");

    console.log('Inserting demo Timetable entries...');
    const tStmt = db.prepare("INSERT INTO Timetable (section_id, subject_code, faculty_id, room_id, day, period) VALUES (?, ?, ?, ?, ?, ?)");
    demoEntries.forEach(e => tStmt.run(e.section_id, e.subject_code, e.faculty_id, e.room_id, e.day, e.period));
    tStmt.finalize();

    console.log('Inserting expertise mapping (SubjectFaculty)...');
    const eStmt = db.prepare("INSERT INTO SubjectFaculty (subject_code, year, faculty_id) VALUES (?, ?, ?)");
    expertiseData.forEach(e => eStmt.run(e.subject_code, e.year, e.faculty_id));
    eStmt.finalize();

    console.log('Demo attendance data seeded successfully.');
    db.close();
});
