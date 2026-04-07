import * as XLSX from 'xlsx';

/**
 * Formats a list of timetable classes into a 2D grid for Excel.
 * @param {Array} classes - List of class objects { day, period, subject_name, faculty_name, room_id, ... }
 * @param {string} sectionName - Name of the section
 */
export const generateExcelGrid = (classes, sectionName) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periods = [1, 2, 3, 4, 5, 6];
    
    // Header Row
    const headerRow = ['Day / Period', 'Period 1', 'Period 2', 'Period 3', 'LUNCH', 'Period 4', 'Period 5', 'Period 6'];
    const data = [
        [`Timetable for Section: ${sectionName}`], // Title row
        [], // spacing
        headerRow
    ];

    days.forEach(day => {
        const row = [day];
        periods.forEach(p => {
            const slot = classes.find(c => c.day === day && c.period === p);
            if (slot) {
                row.push(`${slot.subject_name}\n(${slot.faculty_name})\nRoom: ${slot.room_id}`);
            } else {
                row.push('-');
            }
            
            // Add Lunch after P3
            if (p === 3) {
                row.push('LUNCH');
            }
        });
        data.push(row);
    });

    return XLSX.utils.aoa_to_sheet(data);
};

/**
 * Formats a list of classes for a specific faculty member into a grid.
 */
export const generateFacultyExcelGrid = (classes, facultyName) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periods = [1, 2, 3, 4, 5, 6];
    
    const headerRow = ['Day / Period', 'Period 1', 'Period 2', 'Period 3', 'LUNCH', 'Period 4', 'Period 5', 'Period 6'];
    const data = [
        [`Personal Timetable for: ${facultyName}`],
        [],
        headerRow
    ];

    days.forEach(day => {
        const row = [day];
        periods.forEach(p => {
            const slot = classes.find(c => c.day === day && c.period === p);
            if (slot) {
                // For faculty, show Section instead of Faculty Name
                row.push(`${slot.subject_name}\nSection: ${slot.section_name}\nRoom: ${slot.room_id}`);
            } else {
                row.push('-');
            }
            if (p === 3) row.push('LUNCH');
        });
        data.push(row);
    });

    return XLSX.utils.aoa_to_sheet(data);
};

/**
 * Downloads a workbook with one or more sheets using Blob for browser compatibility.
 * @param {Object} sheets - Map of sheet names to worksheets { "Sheet1": ws1, "Sheet2": ws2 }
 * @param {string} filename - Filename to save as
 */
export const downloadWorkbook = (sheets, filename) => {
    try {
        const wb = XLSX.utils.book_new();
        Object.entries(sheets).forEach(([name, ws]) => {
            // Sheet names must be <= 31 chars
            const safeName = name.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
            XLSX.utils.book_append_sheet(wb, ws, safeName);
        });

        // Use write to get buffer instead of writeFile which can be unreliable in some bundlers
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error in downloadWorkbook:', err);
        throw err;
    }
};
