const db = require('../db');
const ValidationService = require('./ValidationService');
const WorkloadService = require('./WorkloadService');

/**
 * SubstitutionService ranks and assigns substitutes for absent faculty.
 */
class SubstitutionService {
    static async fetchAll(query, params = []) {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    }

    /**
     * Finds and ranks possible substitutes for a specific timetable slot on a specific date.
     */
    static async getRankedSubstitutes(timetableId, date) {
        // 1. Get details of the class that needs a substitute
        const slotDetails = await new Promise((resolve, reject) => {
            db.get(`
                SELECT t.*, s.subject_name, s.subject_code, sec.section_name 
                FROM Timetable t
                JOIN Subjects s ON t.subject_code = s.subject_code
                JOIN Sections sec ON t.section_id = sec.section_id
                WHERE t.id = ?
            `, [timetableId], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!slotDetails) throw new Error('Timetable slot not found');

        const { day, period, subject_code } = slotDetails;

        // 2. Get all faculty
        const allFaculty = await this.fetchAll('SELECT faculty_id, faculty_name, department FROM Faculty');
        
        const candidates = [];

        for (const faculty of allFaculty) {
            // Check availability for that specific day, period, and date
            const availStatus = await ValidationService.isFacultyAvailable(faculty.faculty_id, day, period, date);
            
            if (availStatus.available) {
                // Calculate score/rank
                let score = 0;
                let reasons = [];

                // Priority 1: Same subject expertise
                const expertise = await new Promise((res) => {
                    db.get('SELECT 1 FROM Subjects WHERE faculty_id = ? AND subject_code = ?', 
                        [faculty.faculty_id, subject_code], (err, row) => res(!!row));
                });

                if (expertise) {
                    score += 100;
                    reasons.push('Expert in this subject');
                }

                // Priority 2: Same department
                if (faculty.department === slotDetails.department) {
                    score += 10;
                    reasons.push('Same department');
                }

                // Priority 3: Lower workload (more points for lower workload)
                const weeklyLoad = await WorkloadService.getWeeklyLoad(faculty.faculty_id);
                const workloadBonus = Math.max(0, 30 - weeklyLoad);
                score += workloadBonus;
                reasons.push(`Workload: ${weeklyLoad} hrs/week`);

                candidates.push({
                    ...faculty,
                    score,
                    reasons,
                    weeklyLoad
                });
            }
        }

        // Sort by score descending
        return candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * Assigns a substitute to a slot.
     */
    static async assignSubstitute(originalFacultyId, substituteFacultyId, timetableId, date) {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO Substitutions (original_faculty_id, substitute_faculty_id, timetable_id, date, status)
                VALUES (?, ?, ?, ?, 'Active')
            `, [originalFacultyId, substituteFacultyId, timetableId, date], function(err) {
                if (err) return reject(err);
                resolve({ substitution_id: this.lastID });
            });
        });
    }
}

module.exports = SubstitutionService;
