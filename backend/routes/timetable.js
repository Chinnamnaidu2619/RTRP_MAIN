const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const generatorService = require('../services/generator');

router.use(verifyToken);
router.use(isAdmin); // Timetable generation is admin only

router.post('/generate', async (req, res) => {
    try {
        const result = await generatorService.generateTimetable();
        res.json(result);
    } catch (error) {
        console.error('Generator error:', error);
        res.status(500).json({ error: 'Failed to generate timetable', details: error.message });
    }
});

module.exports = router;
