const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public Routes
router.get('/sections', (req, res) => {
    db.all('SELECT * FROM Sections WHERE year >= 2 ORDER BY year, section_name', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.get('/timetable', (req, res) => {
    const query = `
        SELECT t.id, t.day, t.period, s.section_name, s.year, sub.subject_name, sub.subject_type, f.faculty_name, r.room_id
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Subjects sub ON t.subject_code = sub.subject_code AND sub.year = s.year
        JOIN Faculty f ON t.faculty_id = f.faculty_id
        JOIN Rooms r ON t.room_id = r.room_id
        ORDER BY s.year, t.day, t.period, s.section_name
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Protected Routes (Require Token)
router.use(verifyToken);

// GET Stats (Admin only)
router.get('/stats', isAdmin, (req, res) => {
    const stats = {
        faculty: 0,
        subjects: 0,
        sections: 0,
        rooms: 0
    };

    const queries = [
        { key: 'faculty', query: 'SELECT COUNT(*) as count FROM Faculty' },
        { key: 'subjects', query: 'SELECT COUNT(*) as count FROM Subjects' },
        { key: 'sections', query: 'SELECT COUNT(*) as count FROM Sections' },
        { key: 'rooms', query: 'SELECT COUNT(*) as count FROM Rooms' }
    ];

    let completed = 0;
    let errorOccurred = false;

    queries.forEach(q => {
        db.get(q.query, (err, row) => {
            if (errorOccurred) return;
            if (err) {
                errorOccurred = true;
                return res.status(500).json({ error: err.message });
            }
            stats[q.key] = row.count;
            completed++;

            if (completed === queries.length) {
                res.json(stats);
            }
        });
    });
});

// GET Lists
router.get('/faculty', (req, res) => {
    db.all('SELECT faculty_id, faculty_name, department, email FROM Faculty ORDER BY faculty_name', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET List of Faculty Emails (for reference when creating subject uploads)
router.get('/faculty-emails', (req, res) => {
    db.all('SELECT DISTINCT email, faculty_name FROM Faculty ORDER BY faculty_name', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Format as a list of valid emails with names
        const formatted = rows.map(r => `${r.email} (${r.faculty_name})`).join('\n');
        res.json({ 
            message: 'Valid faculty emails to use in Subject uploads',
            count: rows.length,
            emails: rows,
            formatted_list: formatted
        });
    });
});

router.get('/subjects', (req, res) => {
    db.all(`
        SELECT s.subject_code, s.year, s.subject_name, s.subject_type, s.hours_per_week, s.faculty_id, f.faculty_name 
        FROM Subjects s 
        LEFT JOIN Faculty f ON s.faculty_id = f.faculty_id
        ORDER BY s.year, s.subject_code
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.get('/rooms', (req, res) => {
    db.all('SELECT * FROM Rooms', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Removed redundant public sections/timetable routes from here建设

// GET Personal Timetable
router.get('/timetable/faculty/:facultyId', (req, res) => {
    // Only allow admin or the faculty member themselves
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.facultyId)) {
         return res.status(403).json({ error: 'Access denied' });
    }

    const query = `
        SELECT t.id, t.day, t.period, s.section_name, s.year, sub.subject_name, sub.subject_type, r.room_id
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Subjects sub ON t.subject_code = sub.subject_code AND sub.year = s.year
        JOIN Rooms r ON t.room_id = r.room_id
        WHERE t.faculty_id = ?
        ORDER BY s.year, t.day, t.period
    `;
    db.all(query, [req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
