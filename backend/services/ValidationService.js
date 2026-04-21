const db = require('../db');

/**
 * ValidationService provides core clash detection logic.
 */
class ValidationService {
    /**
     * Promisified db.get helper
     */
    static async get(query, params = []) {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
        });
    }

    /**
     * Checks if a faculty is free at a specific slot.
     * Considers both the main timetable and any active substitutions.
     */
    static async isFacultyAvailable(facultyId, day, period, date = null) {
        // 1. Check main timetable
        const ttConflict = await this.get(
            'SELECT id FROM Timetable WHERE faculty_id = ? AND day = ? AND period = ?',
            [facultyId, day, period]
        );
        if (ttConflict) return { available: false, reason: 'Faculty has a regular class assigned.' };

        // 2. Check active substitutions if date is provided
        if (date) {
            const subConflict = await this.get(
                'SELECT substitution_id FROM Substitutions WHERE substitute_faculty_id = ? AND date = ? AND timetable_id IN (SELECT id FROM Timetable WHERE day = ? AND period = ?)',
                [facultyId, date, day, period]
            );
            if (subConflict) return { available: false, reason: 'Faculty is already serving as a substitute.' };

            // 3. Check attendance
            const isAbsent = await this.get(
                'SELECT status FROM FacultyAttendance WHERE faculty_id = ? AND date = ? AND status = "Absent"',
                [facultyId, date]
            );
            if (isAbsent) return { available: false, reason: 'Faculty is marked as absent for this date.' };
        }

        return { available: true };
    }

    /**
     * Checks if a room/lab is available at a specific slot.
     */
    static async isRoomAvailable(roomId, day, period) {
        const conflict = await this.get(
            'SELECT id FROM Timetable WHERE room_id = ? AND day = ? AND period = ?',
            [roomId, day, period]
        );
        if (conflict) return { available: false, reason: 'Room is occupied by another section.' };
        return { available: true };
    }

    /**
     * Checks if a section (students) is available at a specific slot.
     */
    static async isSectionAvailable(sectionId, day, period) {
        const conflict = await this.get(
            'SELECT id FROM Timetable WHERE section_id = ? AND day = ? AND period = ?',
            [sectionId, day, period]
        );
        if (conflict) return { available: false, reason: 'Section already has a class scheduled.' };
        return { available: true };
    }
}

module.exports = ValidationService;
