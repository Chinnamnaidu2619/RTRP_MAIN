const db = require('../db');
const fs = require('fs');
const path = require('path');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_RANGE = [1, 2, 3, 4, 5, 6];

const fetchAll = (query) => new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

/**
 * Returns the dedicated MG room for a theory section.
 * 2-CSE-A -> MG 101, 3-CSE-B -> MG 202, 4-CSE-G -> MG 307
 */
function getDedicatedRoomId(sectionName) {
    const parts = sectionName.split('-');
    const year = parts[0];
    const sectionIdentifier = parts[2]; // 'A', 'B'...
    const charCode = sectionIdentifier.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    const floorPrefix = year === '2' ? '1' : (year === '3' ? '2' : '3');
    return `MG ${floorPrefix}0${charCode}`;
}

const generateTimetable = async () => {
    try {
        const sections = await fetchAll('SELECT * FROM Sections');
        const rooms = await fetchAll('SELECT * FROM Rooms');
        const allSubjects = await fetchAll(`SELECT s.*, f.faculty_name FROM Subjects s LEFT JOIN Faculty f ON s.faculty_id = f.faculty_id`);

        let facultyMapping = {};
        try {
            facultyMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../faculty_mapping.json'), 'utf8'));
        } catch (err) {
            throw new Error('Faculty mapping missing.');
        }

        const assignments = [];
        const SPECIAL_BLOCK_LIST = ['Skill Development', 'Real Time Research Project', 'Constitution of India', 'Industry Training', 'Mini Project', 'Major Project', 'Internship'];
        const PERIOD_6_SPECIALS = ['Library', 'Sports', 'Counselling'];

        for (const section of sections) {
            const sId = section.section_id;
            const sectionSubjects = allSubjects.filter(sub => sub.year === section.year);
            for (const subject of sectionSubjects) {
                const fId = facultyMapping[sId]?.[subject.subject_code];
                if (!fId) continue;
                
                const isSpecial = SPECIAL_BLOCK_LIST.some(name => subject.subject_name.includes(name));
                const isLab = subject.subject_type === 'Lab';
                const isPeriod6Special = PERIOD_6_SPECIALS.includes(subject.subject_name);
                
                let p = 3; 
                if (isLab) p = 1;
                else if (isSpecial) p = 2;
                else if (isPeriod6Special) p = 0; // Highest priority for the 6th period!

                assignments.push({ section, subject, fId, priority: p, year: section.year });
            }
        }

        let result = null;
        let lastError = null;
        const MAX_ATTEMPTS = 5000; 

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const sessionAssignments = assignments.map(a => ({...a, hoursLeft: a.subject.hours_per_week}));
                
                for (let i = sessionAssignments.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sessionAssignments[i], sessionAssignments[j]] = [sessionAssignments[j], sessionAssignments[i]];
                }

                // Sorting: 0 (P6 Specials) > 1 (Labs) > 2 (Blocks) > 3 (Theory)
                sessionAssignments.sort((a,b) => a.priority - b.priority);

                result = await trySchedule(sessionAssignments, sections, rooms);
                console.log(`Success on attempt ${attempt}!`);
                return result; 
            } catch (err) {
                lastError = err.message;
            }
        }

        throw new Error(`Failed after ${MAX_ATTEMPTS} attempts. Last: ${lastError}`);
    } catch (error) { throw error; }
};

const trySchedule = (assignments, sections, rooms) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM Timetable');
            db.run('DELETE FROM TimeSlots');
            
            const insertSlot = db.prepare('INSERT INTO TimeSlots (day, period, start_time, end_time) VALUES (?, ?, ?, ?)');
            const timeSlotsData = [
                { period: 1, start: '09:20', end: '10:20' }, { period: 2, start: '10:20', end: '11:20' },
                { period: 3, start: '11:20', end: '12:20' }, { period: 4, start: '13:10', end: '14:10' },
                { period: 5, start: '14:10', end: '15:10' }, { period: 6, start: '15:10', end: '16:10' }
            ];
            for (const day of DAYS) for (const slot of timeSlotsData) insertSlot.run(day, slot.period, slot.start, slot.end);
            insertSlot.finalize();

            const facultySchedule = {}, roomSchedule = {}, sectionSchedule = {};
            const subjectDaySchedule = {};
            let scheduledCount = 0;
            const insertTimetable = db.prepare(`INSERT INTO Timetable (section_id, subject_code, faculty_id, room_id, day, period) VALUES (?, ?, ?, ?, ?, ?)`);

            const PERIOD_6_SPECIALS = ['Library', 'Sports', 'Counselling'];

            // 1. PHASE: All 2-hour blocks
            const blockItems = assignments.filter(a => a.priority <= 2 && a.priority > 0 && a.hoursLeft >= 2).sort(() => Math.random() - 0.5);
            for (const item of blockItems) {
                const { section, subject, fId } = item;
                const sId = section.section_id;
                const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
                const blocks = [[1, 2], [2, 3], [4, 5], [5, 6]].sort(() => Math.random() - 0.5);
                
                blockSearch: for (const day of shuffledDays) {
                    for (const [p1, p2] of blocks) {
                        if (!sectionSchedule[sId]?.[day]?.[p1] && !sectionSchedule[sId]?.[day]?.[p2] &&
                            !facultySchedule[fId]?.[day]?.[p1] && !facultySchedule[fId]?.[day]?.[p2]) {
                            
                            let selectedRoomId = null;
                            if (subject.subject_type === 'Theory') {
                                selectedRoomId = getDedicatedRoomId(section.section_name);
                            } else {
                                // Lab or other
                                for (const room of rooms) {
                                    if (room.room_type === subject.subject_type && !roomSchedule[room.room_id]?.[day]?.[p1] && !roomSchedule[room.room_id]?.[day]?.[p2]) {
                                        selectedRoomId = room.room_id;
                                        break;
                                    }
                                }
                            }

                            if (selectedRoomId) {
                                [p1, p2].forEach(p => {
                                    facultySchedule[fId] = facultySchedule[fId] || {}; facultySchedule[fId][day] = facultySchedule[fId][day] || {}; facultySchedule[fId][day][p] = true;
                                    roomSchedule[selectedRoomId] = roomSchedule[selectedRoomId] || {}; roomSchedule[selectedRoomId][day] = roomSchedule[selectedRoomId][day] || {}; roomSchedule[selectedRoomId][day][p] = true;
                                    sectionSchedule[sId] = sectionSchedule[sId] || {}; sectionSchedule[sId][day] = sectionSchedule[sId][day] || {}; sectionSchedule[sId][day][p] = true;
                                    insertTimetable.run(sId, subject.subject_code, fId, selectedRoomId, day, p);
                                    scheduledCount++;
                                });
                                subjectDaySchedule[sId] = subjectDaySchedule[sId] || {}; subjectDaySchedule[sId][day] = subjectDaySchedule[sId][day] || {}; subjectDaySchedule[sId][day][subject.subject_code] = true;
                                item.hoursLeft -= 2;
                                break blockSearch;
                            }
                        }
                    }
                }
            }

            // 2. PHASE: All single hours (Theory, Specials, Lab-tails)
            const singleItems = assignments.filter(a => a.hoursLeft > 0).sort(() => Math.random() - 0.5);
            // Put Prize 0 (P6 specials) at the front of single items
            singleItems.sort((a,b) => a.priority - b.priority);

            for (const item of singleItems) {
                const { section, subject, fId } = item;
                const sId = section.section_id;
                const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
                const isP6Special = PERIOD_6_SPECIALS.includes(subject.subject_name);

                dayLoop: for (const day of shuffledDays) {
                    if (item.hoursLeft <= 0) break;
                    if (subjectDaySchedule[sId]?.[day]?.[subject.subject_code]) continue;

                    let periodsToTry = isP6Special ? [6] : [1,2,3,4,5,6].sort(() => Math.random() - 0.5);

                    for (const p of periodsToTry) {
                        if (!sectionSchedule[sId]?.[day]?.[p] && !facultySchedule[fId]?.[day]?.[p]) {
                            let selectedRoomId = null;
                            if (subject.subject_type === 'Theory') {
                                selectedRoomId = getDedicatedRoomId(section.section_name);
                            } else {
                                for (const room of rooms) {
                                    if (room.room_type === subject.subject_type && !roomSchedule[room.room_id]?.[day]?.[p]) {
                                        selectedRoomId = room.room_id;
                                        break;
                                    }
                                }
                            }

                            if (selectedRoomId) {
                                facultySchedule[fId] = facultySchedule[fId] || {}; facultySchedule[fId][day] = facultySchedule[fId][day] || {}; facultySchedule[fId][day][p] = true;
                                roomSchedule[selectedRoomId] = roomSchedule[selectedRoomId] || {}; roomSchedule[selectedRoomId][day] = roomSchedule[selectedRoomId][day] || {}; roomSchedule[selectedRoomId][day][p] = true;
                                sectionSchedule[sId] = sectionSchedule[sId] || {}; sectionSchedule[sId][day] = sectionSchedule[sId][day] || {}; sectionSchedule[sId][day][p] = true;
                                subjectDaySchedule[sId] = subjectDaySchedule[sId] || {}; subjectDaySchedule[sId][day] = subjectDaySchedule[sId][day] || {}; subjectDaySchedule[sId][day][subject.subject_code] = true;
                                insertTimetable.run(sId, subject.subject_code, fId, selectedRoomId, day, p);
                                scheduledCount++;
                                item.hoursLeft--;
                                continue dayLoop;
                            }
                        }
                    }
                }
            }

            for (const item of assignments) {
                if (item.hoursLeft > 0) {
                    db.run('ROLLBACK');
                    return reject(new Error(`Failed ${item.subject.subject_name} for ${item.section.section_name} (${item.hoursLeft}h left)`));
                }
            }

            insertTimetable.finalize();
            db.run('COMMIT', (err) => {
                if (err) { db.run('ROLLBACK'); return reject(err); }
                resolve({ message: 'Success', scheduled_classes: scheduledCount });
            });
        });
    });
};

module.exports = { generateTimetable };
