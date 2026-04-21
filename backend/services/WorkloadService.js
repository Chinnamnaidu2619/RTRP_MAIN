const db = require('../db');

/**
 * WorkloadService handles faculty class load calculations.
 */
class WorkloadService {
    static async fetchAll(query, params = []) {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    }

    /**
     * Gets total hours assigned to a faculty per week.
     */
    static async getWeeklyLoad(facultyId) {
        const rows = await this.fetchAll(
            'SELECT COUNT(*) as count FROM Timetable WHERE faculty_id = ? OR viva_faculty_id = ?',
            [facultyId, facultyId]
        );
        return rows[0] ? rows[0].count : 0;
    }

    /**
     * Gets total hours assigned to a faculty on a specific day.
     */
    static async getDailyLoad(facultyId, day) {
        const rows = await this.fetchAll(
            'SELECT COUNT(*) as count FROM Timetable WHERE (faculty_id = ? OR viva_faculty_id = ?) AND day = ?',
            [facultyId, facultyId, day]
        );
        return rows[0] ? rows[0].count : 0;
    }

    /**
     * Gets a comprehensive report for all faculty loads.
     */
    static async getWorkloadReport() {
        const query = `
            SELECT f.faculty_id, f.faculty_name, f.department,
                   (SELECT COUNT(*) FROM Timetable t WHERE t.faculty_id = f.faculty_id OR t.viva_faculty_id = f.faculty_id) as weekly_load
            FROM Faculty f
            ORDER BY weekly_load DESC
        `;
        return await this.fetchAll(query);
    }
}

module.exports = WorkloadService;
