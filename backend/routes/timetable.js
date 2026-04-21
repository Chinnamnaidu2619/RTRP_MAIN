const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const generatorService = require('../services/generator');
const db = require('../db');

// PUBLIC ROUTES (No token required for Student View)
router.get('/', (req, res) => {
    const query = `
        SELECT t.*, s.section_name, s.year,
               sub.subject_name, sub.subject_type, r.room_id,
               f.faculty_name, vf.faculty_name as viva_faculty_name
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Rooms r ON t.room_id = r.room_id
        JOIN Subjects sub ON sub.subject_code = t.subject_code AND sub.year = s.year
        LEFT JOIN Faculty f ON t.faculty_id = f.faculty_id
        LEFT JOIN Faculty vf ON t.viva_faculty_id = vf.faculty_id
        ORDER BY s.year, s.section_name, t.day, t.period
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.get('/labs', (req, res) => {
    const query = `
        SELECT t.*, s.section_name, s.year,
               sub.subject_name, sub.subject_type, r.room_id,
               f.faculty_name, vf.faculty_name as viva_faculty_name
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Rooms r ON t.room_id = r.room_id
        JOIN Subjects sub ON sub.subject_code = t.subject_code AND sub.year = s.year
        LEFT JOIN Faculty f ON t.faculty_id = f.faculty_id
        LEFT JOIN Faculty vf ON t.viva_faculty_id = vf.faculty_id
        WHERE sub.subject_type = 'Lab'
        ORDER BY r.room_id, t.day, t.period
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// PROTECTED ROUTES (Require Token)
router.use(verifyToken);

// Faculty timetable — accessible by the faculty member themselves OR admin
router.get('/faculty/:facultyId', (req, res) => {
    if (req.user.role !== 'admin' && String(req.user.id) !== String(req.params.facultyId)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const query = `
        SELECT t.id, t.day, t.period, s.section_name, s.year,
               sub.subject_name, sub.subject_type, r.room_id,
               vf.faculty_name as viva_faculty_name,
               'main' as role
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Rooms r ON t.room_id = r.room_id
        JOIN Subjects sub ON sub.subject_code = t.subject_code AND sub.year = s.year
        LEFT JOIN Faculty vf ON t.viva_faculty_id = vf.faculty_id
        WHERE t.faculty_id = ?

        UNION ALL

        SELECT t.id, t.day, t.period, s.section_name, s.year,
               sub.subject_name, sub.subject_type, r.room_id,
               mf.faculty_name as viva_faculty_name,
               'viva' as role
        FROM Timetable t
        JOIN Sections s ON t.section_id = s.section_id
        JOIN Rooms r ON t.room_id = r.room_id
        JOIN Subjects sub ON sub.subject_code = t.subject_code AND sub.year = s.year
        JOIN Faculty mf ON t.faculty_id = mf.faculty_id
        WHERE t.viva_faculty_id = ?

        ORDER BY day, period
    `;
    db.all(query, [req.params.facultyId, req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin-only routes
router.post('/generate', isAdmin, async (req, res) => {
    try {
        const result = await generatorService.generateTimetable();
        res.json(result);
    } catch (error) {
        console.error('Generator error:', error);
        res.status(500).json({ error: 'Failed to generate timetable', details: error.message });
    }
});

module.exports = router;
