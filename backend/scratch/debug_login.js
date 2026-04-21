const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./database/timetable.db');

const email = 'drajmeerakiran@mlrit.ac.in';
const password = 'faculty123';

console.log('Testing login for:', email);

db.get('SELECT * FROM Faculty WHERE email = ?', [email], (err, faculty) => {
    if (err) {
        console.error('DB Error:', err);
        return;
    }
    if (!faculty) {
        console.log('Faculty not found');
        return;
    }
    console.log('Faculty found. Hash in DB:', faculty.password);
    
    bcrypt.compare(password, faculty.password, (err, isValid) => {
        if (err) {
            console.error('Bcrypt Error:', err);
        } else {
            console.log('Password is valid:', isValid);
        }
        db.close();
    });
});
