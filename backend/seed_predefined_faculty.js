const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'timetable.db');
const db = new sqlite3.Database(dbPath);

const FACULTY_DATA = [
    { name: 'Dr K Pushpa Rani', id: 161, dept: 'CSE' },
    { name: 'Mrs M Umrez', id: 530, dept: 'CSE' },
    { name: 'Mr Mohammad Sirajuddin', id: 531, dept: 'CSE' },
    { name: 'Mr S K Lokesh Naik', id: 170, dept: 'CSE' },
    { name: 'Mr B Murali Krishna', id: 172, dept: 'CSE' },
    { name: 'Mrs A Sangeetha', id: 174, dept: 'CSE' },
    { name: 'Mrs E N Vijaya Kumari', id: 185, dept: 'CSE' },
    { name: 'Mrs M Soma Sabitha', id: 189, dept: 'CSE' },
    { name: 'Mrs B Ratnamala', id: 205, dept: 'CSE' },
    { name: 'Mr P Santhosh Kumar', id: 188, dept: 'CSE' },
    { name: 'Mr Nagarjuna Tandra', id: 176, dept: 'CSE' },
    { name: 'Mrs M Vineesha', id: 187, dept: 'CSE' },
    { name: 'Mr S Lingaiah', id: 183, dept: 'CSE' },
    { name: 'Mrs B Vedavidya', id: 182, dept: 'CSE' },
    { name: 'Mrs J MahaLakshmi', id: 166, dept: 'CSE' },
    { name: 'Mrs A Nagamani', id: 173, dept: 'CSE' },
    { name: 'Mrs B Manjusha', id: 195, dept: 'CSE' },
    { name: 'Ms J Chaitanya', id: 202, dept: 'CSE' },
    { name: 'Mr B Devananda Rao', id: 169, dept: 'CSE' },
    { name: 'Dr K Phalguna Rao', id: 165, dept: 'CSE' },
    { name: 'Mrs K Swetha', id: 184, dept: 'CSE' },
    { name: 'Mrs P Sasmitha Kumari', id: 190, dept: 'CSE' },
    { name: 'Mr K Shekar', id: 192, dept: 'CSE' },
    { name: 'Dr K Gagan Kumar', id: 160, dept: 'CSE' },
    { name: 'Dr P Radhika', id: 167, dept: 'CSE' },
    { name: 'Mrs Zeenath Jaha Begum', id: 204, dept: 'CSE' },
    { name: 'Mr P Purushotham', id: 180, dept: 'CSE' },
    { name: 'Mr P Victor Emmanuel', id: 181, dept: 'CSE' },
    { name: 'Mrs B Srilatha', id: 191, dept: 'CSE' },
    { name: 'Mrs A Swathi', id: 179, dept: 'CSE' },
    { name: 'Mrs D Hrudayamma', id: 532, dept: 'CSE' },
    { name: 'Dr G Jostna Kumar', id: 529, dept: 'CSE' },
    { name: 'Mr V Sai Krishna', id: 171, dept: 'CSE' },
    { name: 'Dr K Venkata Subbaiah', id: 159, dept: 'CSE' },
    { name: 'Mr M Srinivasa Rao', id: 168, dept: 'CSE' },
    { name: 'Mrs I Sapthami', id: 178, dept: 'CSE' },
    { name: 'Dr V Thrimurthulu', id: 163, dept: 'CSE' },
    { name: 'Dr K Chinnaiah', id: 164, dept: 'CSE' },
    { name: 'Dr G John Samuel Babu', id: 162, dept: 'CSE' },
    { name: 'Mr P Hareesh', id: 198, dept: 'CSE' },
    { name: 'Mr G Nagarjuna Rao', id: 197, dept: 'CSE' },
    { name: 'Mr R Madhu', id: 199, dept: 'CSE' },
    { name: 'Mr G Praveen', id: 194, dept: 'CSE' },
    { name: 'Mr V Bala Krishna Reddy', id: 203, dept: 'CSE' },
    { name: 'Dr Rajgopal Reddy', id: 533, dept: 'CSE' }
];

db.serialize(() => {
    console.log('Clearing dummy faculty...');
    db.run("DELETE FROM Faculty WHERE faculty_name LIKE 'Library_%' OR faculty_name LIKE 'Sports_%' OR faculty_name LIKE 'Counselling_%' OR faculty_id >= 1000");

    console.log('Inserting predefined faculty...');
    const stmt = db.prepare("INSERT OR REPLACE INTO Faculty (faculty_id, faculty_name, department, email, password) VALUES (?, ?, ?, ?, ?)");
    FACULTY_DATA.forEach(f => {
        const email = f.name.toLowerCase().replace(/[\.\s]/g, '') + '@example.com';
        const password = 'password123'; // Default password for seeding
        stmt.run(f.id, f.name, f.dept, email, password);
    });
    stmt.finalize();

    console.log('Predefined faculty seeded successfully.');
    db.close();
});
