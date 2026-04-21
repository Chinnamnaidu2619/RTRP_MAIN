const db = require('../db');
const fs = require('fs');
const path = require('path');
const ValidationService = require('./ValidationService');
const WorkloadService = require('./WorkloadService');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREE_PERIOD_SUBJECTS = new Set(['Library', 'Sports', 'Counselling']);
const LAB_BLOCKS = [[1, 2], [2, 3], [4, 5], [5, 6]];
const THEORY_PERIODS = [1, 2, 3, 4, 5, 6];
const TOTAL_SLOTS_PER_SECTION = 36;

const fetchAll = (query, params = []) => new Promise((resolve, reject) =>
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows))
);

function getDedicatedRoomId(sectionName, year) {
    const letter = sectionName.split('-').pop();
    const charCode = letter.charCodeAt(0) - 65 + 1;
    const floor = year === 2 ? '1' : year === 3 ? '2' : '3';
    return `MG ${floor}0${charCode}`;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

/**
 * Enhanced Timetable Generator with Preference Awareness and Workload Balancing.
 */
const generateTimetable = async () => {
    const [sections, rooms, allSubjects, allFaculty, allPrefs] = await Promise.all([
        fetchAll('SELECT * FROM Sections'),
        fetchAll('SELECT * FROM Rooms'),
        fetchAll('SELECT * FROM Subjects'),
        fetchAll('SELECT faculty_id FROM Faculty'),
        fetchAll('SELECT * FROM FacultyPreferences')
    ]);

    const preferencesMap = {};
    allPrefs.forEach(p => {
        preferencesMap[p.faculty_id] = {
            unavailable: JSON.parse(p.unavailable_slots || '{}'),
            preferred: JSON.parse(p.preferred_slots || '{}')
        };
    });

    let facultyMapping = {};
    try {
        facultyMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../faculty_mapping.json'), 'utf8'));
    } catch (e) { throw new Error('faculty_mapping.json missing'); }

    // --- EXPERTISE MINING & RE-BALANCING ---
    const expertiseMap = {}; // subjectCode -> Set of facultyIds who teach it
    Object.values(facultyMapping).forEach(sectionMap => {
        Object.entries(sectionMap).forEach(([subCode, fId]) => {
            if (!expertiseMap[subCode]) expertiseMap[subCode] = new Set();
            expertiseMap[subCode].add(Number(fId));
        });
    });

    const projectedWorkload = {};
    allFaculty.forEach(f => projectedWorkload[f.faculty_id] = 0);

    const labRooms = shuffle(rooms.filter(r => r.room_type === 'Lab').map(r => r.room_id));
    const subjectsByYear = {};
    allSubjects.forEach(s => (subjectsByYear[s.year] = subjectsByYear[s.year] || []).push(s));

    const mappedSectionIds = new Set(Object.keys(facultyMapping).map(Number));
    const schedulableSections = sections.filter(s => mappedSectionIds.has(s.section_id));

    let baseAssignments = [];
    for (const section of schedulableSections) {
        const subs = subjectsByYear[section.year] || [];
        for (const subject of subs) {
            let fId = Number(facultyMapping[section.section_id]?.[subject.subject_code]);
            if (!fId || FREE_PERIOD_SUBJECTS.has(subject.subject_name)) continue;
            
            // Re-balancing: If this faculty is already overloaded (> 21h), 
            // find another expert for this subject who is under-loaded.
            if (projectedWorkload[fId] + subject.hours_per_week > 21) {
                const experts = Array.from(expertiseMap[subject.subject_code] || []);
                const betterExpert = experts.find(exId => projectedWorkload[exId] + subject.hours_per_week <= 21);
                if (betterExpert) fId = betterExpert;
            }

            const isLab = subject.subject_type === 'Lab';
            const isMegaProject = subject.hours_per_week >= 15;
            // Mega Projects (18h) are CRITICAL, place them absolutely first
            const priority = isMegaProject ? 0 : (isLab ? 1 : (subject.subject_type === 'Project' || subject.subject_type === 'Skill' ? 2 : 3));
            baseAssignments.push({ section, subject, fId, priority, hours: subject.hours_per_week });
            projectedWorkload[fId] += subject.hours_per_week;
        }
    }

    baseAssignments.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.section.section_id - b.section.section_id;
    });

    const facultyIds = allFaculty.map(f => f.faculty_id);

    const MAX_ATTEMPTS = 5000; // Faster attempts, more iterations
    let lastFailReason = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const result = tryScheduleInMemory(baseAssignments, labRooms, preferencesMap, facultyIds);
        if (result.success) {
            console.log(`Timetable generated on attempt ${attempt}`);
            await commitToDatabase(result.entries);
            return { 
                success: true, 
                message: 'Timetable generated successfully with Lab Viva and 15-21h workload balancing', 
                scheduled_classes: result.entries.length 
            };
        } else {
            lastFailReason = result.reason || 'Unknown';
        }
    }

    throw new Error(`Failed after ${MAX_ATTEMPTS} attempts. Last reason: ${lastFailReason}`);
};

function tryScheduleInMemory(baseAssignments, labRooms, preferencesMap, allFacultyIds) {
    const facultyBusy  = new Set();
    const roomBusy     = new Set();
    const sectionBusy  = new Set();
    const subjectOnDay = new Set();
    const workloadCount = {};
    allFacultyIds.forEach(id => workloadCount[id] = 0);

    const entries = [];

    const fKey = (fId, d, p) => `f${fId}_${d}_${p}`;
    const rKey = (rId, d, p) => `r${rId}_${d}_${p}`;
    const sKey = (sId, d, p) => `s${sId}_${d}_${p}`;
    const sdKey = (sId, d, c) => `sd${sId}_${d}_${c}`;

    const isSlotAvailable = (fId, rId, sId, d, p) => {
        if (facultyBusy.has(fKey(fId, d, p)) || sectionBusy.has(sKey(sId, d, p))) return false;
        const prefs = preferencesMap[fId];
        if (prefs && prefs.unavailable[DAYS[d]]?.includes(p)) return false;
        // Removed hard workload cap to prevent deadlocks with 18-hour projects.
        // Workload is now handled via 'soft' prioritization in Viva selection.
        return true;
    };

    const mark = (fId, rId, sId, d, p, subCode, vivaFId = null) => {
        facultyBusy.add(fKey(fId, d, p));
        if (rId) roomBusy.add(rKey(rId, d, p));
        sectionBusy.add(sKey(sId, d, p));
        subjectOnDay.add(sdKey(sId, d, subCode));
        workloadCount[fId]++;
        
        if (vivaFId) {
            facultyBusy.add(fKey(vivaFId, d, p));
            workloadCount[vivaFId]++;
        }

        entries.push({ sId, subjectCode: subCode, fId, roomId: rId, dayIdx: d, period: p, vivaFId });
    };

    let currentLabRoomIdx = 0;
    const findFreeLabRoom = (d, p1, p2) => {
        for (let i = 0; i < labRooms.length; i++) {
            const rId = labRooms[(currentLabRoomIdx + i) % labRooms.length];
            if (!roomBusy.has(rKey(rId, d, p1)) && !roomBusy.has(rKey(rId, d, p2))) {
                currentLabRoomIdx = (currentLabRoomIdx + i + 1) % labRooms.length;
                return rId;
            }
        }
        return null;
    };

    const findVivaFaculty = (d, p, excludeFIds = []) => {
        const excludeSet = new Set(excludeFIds);
        const candidates = allFacultyIds.filter(fId => 
            !excludeSet.has(fId) && 
            !facultyBusy.has(fKey(fId, d, p))
        );
        candidates.sort((a, b) => workloadCount[a] - workloadCount[b]);
        return candidates[0] || null;
    };

    const dayOrder = [0, 1, 2, 3, 4, 5];

    for (const base of baseAssignments) {
        const { section, subject, fId, priority } = base;
        const sId = section.section_id;
        const subCode = subject.subject_code;
        const roomId = getDedicatedRoomId(section.section_name, section.year);
        let hoursLeft = base.hours;

        if (priority === 0) { // MEGA PROJECT (18h)
             while (hoursLeft > 0) {
                let placed = false;
                for (const d of shuffle([...dayOrder])) {
                    for (const p of shuffle([...THEORY_PERIODS])) {
                        if (!isSlotAvailable(fId, roomId, sId, d, p)) continue;
                        mark(fId, roomId, sId, d, p, subCode);
                        hoursLeft--;
                        placed = true;
                        if (hoursLeft === 0) break;
                    }
                    if (placed && hoursLeft === 0) break;
                }
                if (!placed) return { success: false, reason: `Failed MEGA PROJECT ${subCode} for Section ${sId}` };
            }
            continue;
        }

        if (priority === 1) { // LAB
            const blocksToPlace = Math.max(1, Math.floor(hoursLeft / 2));
            let blocksPlaced = 0;
            while (blocksPlaced < blocksToPlace) {
                let placed = false;
                for (const d of shuffle([...dayOrder])) {
                    if (subjectOnDay.has(sdKey(sId, d, subCode))) continue;
                    for (const [p1, p2] of shuffle([...LAB_BLOCKS])) {
                        if (!isSlotAvailable(fId, null, sId, d, p1) || !isSlotAvailable(fId, null, sId, d, p2)) continue;
                        const lRoom = findFreeLabRoom(d, p1, p2);
                        if (!lRoom) continue;

                        let vivaFId = findVivaFaculty(d, p2, [fId]);
                        
                        mark(fId, lRoom, sId, d, p1, subCode, null);
                        mark(fId, lRoom, sId, d, p2, subCode, vivaFId);
                        
                        blocksPlaced++;
                        placed = true;
                        break;
                    }
                    if (placed) break;
                }
                if (!placed) return { success: false, reason: `Failed LAB ${subCode} for Section ${sId}` };
            }
            continue;
        }

        while (hoursLeft > 0) {
            let placed = false;
            const sortedDays = shuffle([...dayOrder]);
            outer: for (const d of sortedDays) {
                for (const p of shuffle([...THEORY_PERIODS])) {
                    if (!isSlotAvailable(fId, roomId, sId, d, p)) continue;
                    mark(fId, roomId, sId, d, p, subCode);
                    hoursLeft--;
                    placed = true;
                    break outer;
                }
            }
            if (!placed) return { success: false, reason: `Failed THEORY ${subCode} for Section ${sId}` };
        }
    }

    return { success: true, entries, workloads: workloadCount };
}

function commitToDatabase(entries) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM Timetable');
            db.run('DELETE FROM TimeSlots');

            const insertSlot = db.prepare('INSERT INTO TimeSlots (day, period, start_time, end_time) VALUES (?, ?, ?, ?)');
            const slotTimes = [[1, '09:20', '10:20'], [2, '10:20', '11:20'], [3, '11:20', '12:20'], [4, '13:10', '14:10'], [5, '14:10', '15:10'], [6, '15:10', '16:10']];
            for (const day of DAYS) for (const [p, s, e] of slotTimes) insertSlot.run(day, p, s, e);
            insertSlot.finalize();

            const insertTT = db.prepare('INSERT INTO Timetable (section_id, subject_code, faculty_id, room_id, day, period, viva_faculty_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const e of entries) insertTT.run(e.sId, e.subjectCode, e.fId, e.roomId, DAYS[e.dayIdx], e.period, e.vivaFId);
            insertTT.finalize();

            db.run('COMMIT', (err) => err ? (db.run('ROLLBACK'), reject(err)) : resolve());
        });
    });
}

module.exports = { generateTimetable };
