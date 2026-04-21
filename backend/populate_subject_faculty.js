const db = require('./db');

console.log('Seeding SubjectFaculty from existing Subjects table...');

db.serialize(() => {
    // Get all subjects that have a primary faculty assigned
    db.all('SELECT subject_code, year, faculty_id FROM Subjects WHERE faculty_id IS NOT NULL', [], (err, subjects) => {
        if (err) {
            console.error('Error fetching subjects:', err.message);
            process.exit(1);
        }

        if (subjects.length === 0) {
            console.log('No subject-faculty assignments found in Subjects table.');
            process.exit(0);
        }

        const stmt = db.prepare('INSERT OR IGNORE INTO SubjectFaculty (subject_code, year, faculty_id) VALUES (?, ?, ?)');
        
        subjects.forEach(s => {
            stmt.run(s.subject_code, s.year, s.faculty_id);
        });

        stmt.finalize((err) => {
            if (err) console.error('Error finalizing seeding:', err.message);
            else console.log(`Successfully seeded ${subjects.length} expertise records into SubjectFaculty.`);
            process.exit(0);
        });
    });
});
