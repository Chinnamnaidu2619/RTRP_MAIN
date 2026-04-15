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
 * Utility to post base64 data to the backend to trigger a native browser download,
 * completely immune to frontend download managers (like IDM) that mess up blobs.
 */
export const robustDownload = (filename, base64Content, contentType) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download';

    const inputFilename = document.createElement('input');
    inputFilename.type = 'hidden';
    inputFilename.name = 'filename';
    inputFilename.value = filename;

    const inputContent = document.createElement('input');
    inputContent.type = 'hidden';
    inputContent.name = 'content';
    inputContent.value = base64Content;

    const inputType = document.createElement('input');
    inputType.type = 'hidden';
    inputType.name = 'type';
    inputType.value = contentType;

    form.appendChild(inputFilename);
    form.appendChild(inputContent);
    form.appendChild(inputType);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
};

/**
 * Downloads a workbook with one or more sheets.
 * Uses backend echo download to bypass all frontend mangling.
 * @param {Object} sheets - Map of sheet names to worksheets { "Sheet1": ws1, "Sheet2": ws2 }
 * @param {string} filename - Filename to save as
 */
export const downloadWorkbook = (sheets, filename) => {
    try {
        const wb = XLSX.utils.book_new();
        Object.entries(sheets).forEach(([name, ws]) => {
            const safeName = name.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
            XLSX.utils.book_append_sheet(wb, ws, safeName);
        });

        const excelBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        robustDownload(filename, excelBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
        console.error('Error in downloadWorkbook:', err);
        alert('Export failed. Please check the console for details.');
    }
};
