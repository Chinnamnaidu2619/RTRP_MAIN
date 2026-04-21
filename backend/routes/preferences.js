const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

/**
 * GET preferences for the logged-in faculty.
 */
router.get('/', (req, res) => {
    db.get('SELECT * FROM FacultyPreferences WHERE faculty_id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ unavailable_slots: '{}', preferred_slots: '{}' });
        res.json(row);
    });
});

/**
 * POST update preferences.
 */
router.post('/', (req, res) => {
    const { unavailable_slots, preferred_slots } = req.body;
    
    const query = `
        INSERT INTO FacultyPreferences (faculty_id, unavailable_slots, preferred_slots)
        VALUES (?, ?, ?)
        ON CONFLICT(faculty_id) DO UPDATE SET 
            unavailable_slots=excluded.unavailable_slots,
            preferred_slots=excluded.preferred_slots
    `;
    db.run(query, [req.user.id, JSON.stringify(unavailable_slots), JSON.stringify(preferred_slots)], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;
