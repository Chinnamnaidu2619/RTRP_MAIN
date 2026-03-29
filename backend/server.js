const express = require('express');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // For parsing application/json

const authRoutes = require('./routes/auth').router;
const apiRoutes = require('./routes/api');
const timetableRoutes = require('./routes/timetable');

// Test route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
