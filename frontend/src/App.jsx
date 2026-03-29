import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components (We will create these next)
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import FacultyDashboard from './pages/faculty/Dashboard';
import AdminLayout from './layouts/AdminLayout';
import FacultyLayout from './layouts/FacultyLayout';
import Uploads from './pages/admin/Uploads';
import SubjectsList from './pages/admin/SubjectsList';
import FacultyList from './pages/admin/FacultyList';
import RoomsList from './pages/admin/RoomsList';
import TimetableManager from './pages/admin/TimetableManager';
import SectionsTimetable from './pages/admin/SectionsTimetable';
import StudentTimetable from './pages/StudentTimetable';

const ProtectedRoute = ({ children, allowedRole }) => {
    const { user, loading } = useAuth();

    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/" />;
    if (allowedRole && user.role !== allowedRole) {
        return <Navigate to={user.role === 'admin' ? '/admin' : '/faculty'} />;
    }

    return children;
};

const App = () => {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/student" element={<StudentTimetable />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRole="admin">
                            <AdminLayout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<AdminDashboard />} />
                        <Route path="uploads" element={<Uploads />} />
                        <Route path="faculty" element={<FacultyList />} />
                        <Route path="subjects" element={<SubjectsList />} />
                        <Route path="rooms" element={<RoomsList />} />
                        <Route path="timetable" element={<TimetableManager />} />
                        <Route path="sections" element={<SectionsTimetable />} />
                    </Route>

                    {/* Faculty Routes */}
                    <Route path="/faculty" element={
                        <ProtectedRoute allowedRole="faculty">
                            <FacultyLayout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<FacultyDashboard />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
};

export default App;
