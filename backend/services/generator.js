const db = require('../db');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS_PER_DAY = 6;

// Helper to wrap db.all into promises
const fetchAll = (query) => {
    return new Promise((resolve, reject) => {
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const generateTimetable = async () => {
    try {
        // 1. Load Data
        const sections = await fetchAll('SELECT * FROM Sections ORDER BY year, section_name');
        const rooms = await fetchAll('SELECT * FROM Rooms');
        const allSubjects = await fetchAll(`
            SELECT s.*, f.faculty_name 
            FROM Subjects s 
            LEFT JOIN Faculty f ON s.faculty_id = f.faculty_id 
            ORDER BY s.year
        `);

        if (sections.length === 0 || allSubjects.length === 0 || rooms.length === 0) {
            throw new Error('Missing required data: Sections, Subjects, or Rooms. Please add these first.');
        }

        // 1.1 Pre-Generation Validation (per year)
        const maxSlotsPerWeek = DAYS.length * PERIODS_PER_DAY; // 36
        
        // Group sections and subjects by year
        const sectionsByYear = {};
        const subjectsByYear = {};
        
        sections.forEach(sec => {
            if (!sectionsByYear[sec.year]) sectionsByYear[sec.year] = [];
            sectionsByYear[sec.year].push(sec);
        });
        
        allSubjects.forEach(sub => {
            if (!subjectsByYear[sub.year]) subjectsByYear[sub.year] = [];
            subjectsByYear[sub.year].push(sub);
        });

        // Validate Faculty Hours per year
        for (const year in subjectsByYear) {
            const yearSubjects = subjectsByYear[year];
            const yearSectionCount = sectionsByYear[year]?.length || 0;
            
            // Check for subjects with NULL faculty_id
            const nullFacultySubjects = yearSubjects.filter(sub => !sub.faculty_id);
            if (nullFacultySubjects.length > 0) {
                const subjectCodes = nullFacultySubjects.map(s => s.subject_code).join(', ');
                throw new Error(`Year ${year} - No faculty assigned to subjects: ${subjectCodes}. Please verify faculty_email matches existing faculty records.`);
            }
            
            const facultyHours = {};
            yearSubjects.forEach(sub => {
                facultyHours[sub.faculty_id] = (facultyHours[sub.faculty_id] || 0) + sub.hours_per_week * yearSectionCount;
            });

            const minFacultyHours = 18;
            const maxFacultyHours = 21;

            for (const fId in facultyHours) {
                const assignedHours = facultyHours[fId];
                const facultyName = yearSubjects.find(s => s.faculty_id == fId)?.faculty_name || 'Unknown';

                if (assignedHours > maxFacultyHours) {
                    throw new Error(`Conflict: Faculty "${facultyName}" is over-scheduled with ${assignedHours} hours (Max allowed: ${maxFacultyHours}). Please reduce their teaching load.`);
                }

                if (assignedHours < minFacultyHours) {
                    throw new Error(`Conflict: Faculty "${facultyName}" is under-scheduled with ${assignedHours} hours (Min required: ${minFacultyHours}). Please assign more subjects to this faculty.`);
                }

                if (assignedHours > maxSlotsPerWeek) {
                    throw new Error(`Conflict: Faculty "${facultyName}" requests ${assignedHours} hours, which exceeds total weekly slots ${maxSlotsPerWeek}.`);
                }
            }
        }

        // Validate Section Hours per year
        for (const year in subjectsByYear) {
            const yearSubjects = subjectsByYear[year];
            const totalRequiredPerSection = yearSubjects.reduce((sum, sub) => sum + sub.hours_per_week, 0);
            if (totalRequiredPerSection > maxSlotsPerWeek) {
                throw new Error(`Conflict: Year ${year} - Total required hours per section (${totalRequiredPerSection}) exceeds weekly capacity (${maxSlotsPerWeek})`);
            }
        }

        // Validate Lab Capacity per year
        for (const year in subjectsByYear) {
            const yearSubjects = subjectsByYear[year];
            const yearSectionCount = sectionsByYear[year]?.length || 0;
            const labSubjects = yearSubjects.filter(s => s.subject_type === 'Lab');
            const totalLabHoursNeeded = labSubjects.reduce((sum, sub) => sum + sub.hours_per_week * yearSectionCount, 0);
            const labRooms = rooms.filter(r => r.room_type === 'Lab');
            const totalLabSlotsAvailable = labRooms.length * maxSlotsPerWeek;

            if (totalLabHoursNeeded > totalLabSlotsAvailable) {
                throw new Error(`Conflict: Year ${year} - Insufficient Lab rooms (${totalLabHoursNeeded} hours needed, ${totalLabSlotsAvailable} slots available)`);
            }
        }

        // Validate overall room capacity (Very Important)
        const totalSectionHours = sections.length * (allSubjects.reduce((sum, sub) => sum + sub.hours_per_week, 0) / (Object.keys(subjectsByYear).length || 1));
        const totalRoomSlots = rooms.length * maxSlotsPerWeek;
        if (totalSectionHours > totalRoomSlots) {
            throw new Error(`Critical Conflict: Total class hours needed (${totalSectionHours.toFixed(0)}) exceeds available room capacity (${totalRoomSlots}).\n\nSolution: Please add more classrooms in the Rooms upload.`);
        }

        // 2. Wrap the DB updates in a Promise so we can await the transaction
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM Timetable');
                db.run('DELETE FROM TimeSlots');
                
                // seed TimeSlots
                const insertSlot = db.prepare('INSERT INTO TimeSlots (day, period, start_time, end_time) VALUES (?, ?, ?, ?)');
                const timeSlotsData = [
                    { period: 1, start: '09:20', end: '10:20' },
                    { period: 2, start: '10:20', end: '11:20' },
                    { period: 3, start: '11:20', end: '12:20' },
                    { period: 4, start: '13:10', end: '14:10' },
                    { period: 5, start: '14:10', end: '15:10' },
                    { period: 6, start: '15:10', end: '16:10' }
                ];
                
                for (const day of DAYS) {
                    for (const slot of timeSlotsData) {
                        insertSlot.run(day, slot.period, slot.start, slot.end);
                    }
                }
                insertSlot.finalize();

                const facultySchedule = {};
                const roomSchedule = {};
                const sectionSchedule = {};
                let scheduledCount = 0;

                const insertTimetable = db.prepare(`
                    INSERT INTO Timetable (section_id, subject_code, faculty_id, room_id, day, period) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                let failureReason = null;

                for (const section of sections) {
                    const sectionSubjects = allSubjects.filter(sub => sub.year === section.year);
                    
                    for (const subject of sectionSubjects) {
                        let hoursNeeded = subject.hours_per_week;
                        
                        daysLoop: for (const day of DAYS) {
                            for (let p = 1; p <= PERIODS_PER_DAY; p++) {
                                if (hoursNeeded === 0) break daysLoop;

                                const fId = subject.faculty_id;
                                const sId = section.section_id;

                                if (sectionSchedule[sId]?.[day]?.[p]) continue;
                                if (facultySchedule[fId]?.[day]?.[p]) continue;

                                let selectedRoomId = null;
                                for (const room of rooms) {
                                    const requiredType = subject.subject_type === 'Lab' ? 'Lab' : 'Classroom';
                                    if (room.room_type === requiredType && !roomSchedule[room.room_id]?.[day]?.[p]) {
                                        selectedRoomId = room.room_id;
                                        break;
                                    }
                                }

                                if (!selectedRoomId) continue;

                                facultySchedule[fId] = facultySchedule[fId] || {};
                                facultySchedule[fId][day] = facultySchedule[fId][day] || {};
                                facultySchedule[fId][day][p] = true;

                                roomSchedule[selectedRoomId] = roomSchedule[selectedRoomId] || {};
                                roomSchedule[selectedRoomId][day] = roomSchedule[selectedRoomId][day] || {};
                                roomSchedule[selectedRoomId][day][p] = true;

                                sectionSchedule[sId] = sectionSchedule[sId] || {};
                                sectionSchedule[sId][day] = sectionSchedule[sId][day] || {};
                                sectionSchedule[sId][day][p] = true;

                                insertTimetable.run(sId, subject.subject_code, fId, selectedRoomId, day, p);
                                hoursNeeded--;
                                scheduledCount++;
                            }
                        }

                        if (hoursNeeded > 0) {
                            const facultyName = subject.faculty_name || 'Unknown';
                            failureReason = `Failed to schedule ${subject.subject_name} (${subject.subject_code}) for Section ${section.section_name}. \n` +
                                            `Still needed ${hoursNeeded} hours. Possible causes: \n` +
                                            `- Faculty "${facultyName}" has no free slots during section's free time.\n` +
                                            `- Section ${section.section_name} is fully booked.\n` +
                                            `- No free rooms of required type (${subject.subject_type === 'Lab' ? 'Lab' : 'Classroom'}) are available.`;
                            break;
                        }
                    }
                    if (failureReason) break;
                }
                
                insertTimetable.finalize();

                if (failureReason) {
                    db.run('ROLLBACK');
                    return reject(new Error(failureReason));
                }

                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    resolve({
                        message: 'Generation complete',
                        scheduled_classes: scheduledCount
                    });
                });
            });
        });
    } catch (error) {
        throw error;
    }
};

module.exports = { generateTimetable };
