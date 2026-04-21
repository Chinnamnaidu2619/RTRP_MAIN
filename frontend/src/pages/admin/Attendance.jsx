import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { UserX, UserCheck, RefreshCw, Calendar, AlertTriangle, Loader2, CheckCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TODAY = new Date().toISOString().split('T')[0];

const Attendance = () => {
    const [date, setDate] = useState(TODAY);
    const [faculty, setFaculty] = useState([]);
    const [absences, setAbsences] = useState([]);
    const [substitutes, setSubstitutes] = useState([]);
    const [freeFacultyByPeriod, setFreeFacultyByPeriod] = useState({});
    const [loading, setLoading] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const [viewingTimetable, setViewingTimetable] = useState(null); // { id: 1, name: '...', timetable: [] }
    
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchFaculty = async () => {
        try {
            const r = await axios.get('/api/faculty', { headers });
            setFaculty(Array.isArray(r.data) ? r.data : []);
        } catch (err) {
            console.error('Error fetching faculty:', err);
            setError('Failed to fetch faculty list');
        }
    };

    useEffect(() => {
        fetchFaculty();
    }, []);

    useEffect(() => {
        fetchAbsences();
    }, [date]);

    const fetchAbsences = async () => {
        setLoading(true);
        setError(null);
        try {
            const [absRes, subRes] = await Promise.all([
                axios.get(`/api/attendance/absent?date=${date}`, { headers }),
                axios.get(`/api/attendance/substitutes?date=${date}`, { headers }),
            ]);
            
            const absData = Array.isArray(absRes.data) ? absRes.data : [];
            const subData = Array.isArray(subRes.data) ? subRes.data : [];
            
            setAbsences(absData);
            setSubstitutes(subData);
            
            if (subData.length > 0) {
                await fetchFreeFacultyForSubstitutes(subData);
            } else {
                setFreeFacultyByPeriod({});
            }
        } catch (err) {
            console.error('Error fetching attendance data:', err);
            setError('Error loading attendance or substitute data');
        } finally {
            setLoading(false);
        }
    };

    const fetchFreeFacultyForSubstitutes = async (subs) => {
        if (!Array.isArray(subs) || subs.length === 0) return;
        
        try {
            const uniquePeriods = [...new Set(subs.map(s => s.period))];
            const results = await Promise.all(
                uniquePeriods.map(async p => {
                    try {
                        const r = await axios.get(`/api/attendance/free-faculty?date=${date}&period=${p}`, { headers });
                        return { period: p, faculty: Array.isArray(r.data) ? r.data : [] };
                    } catch {
                        return { period: p, faculty: [] };
                    }
                })
            );
            
            const map = {};
            results.forEach(({ period, faculty }) => { map[period] = faculty; });
            setFreeFacultyByPeriod(map);
        } catch (err) {
            console.error('Error in fetchFreeFacultyForSubstitutes:', err);
        }
    };

    const markAbsent = async (facultyId) => {
        setSubLoading(true);
        try {
            await axios.post('/api/attendance/absent', { faculty_id: facultyId, date }, { headers });
            await fetchAbsences();
        } catch (e) {
            alert(e.response?.data?.error || 'Error marking absent');
        } finally {
            setSubLoading(false);
        }
    };

    const markPresent = async (facultyId) => {
        setSubLoading(true);
        try {
            await axios.delete('/api/attendance/absent', { headers, data: { faculty_id: facultyId, date } });
            await fetchAbsences();
        } catch (e) {
            alert(e.response?.data?.error || 'Error removing absence');
        } finally {
            setSubLoading(false);
        }
    };

    const overrideSubstitute = async (timetableId, newSubId) => {
        if (!newSubId) return;
        try {
            await axios.put(`/api/attendance/substitutes/${timetableId}`, { date, substitute_faculty_id: newSubId }, { headers });
            await fetchAbsences();
        } catch (e) {
            alert(e.response?.data?.error || 'Error updating substitute');
        }
    };

    const fetchFacultyTodayTimetable = async (fId, fName) => {
        try {
            const r = await axios.get(`/api/timetable/faculty/${fId}`, { headers });
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
            const todaySlots = r.data.filter(s => s.day === dayName);
            setViewingTimetable({ id: fId, name: fName, timetable: todaySlots });
        } catch (err) {
            console.error('Error fetching today timetable:', err);
        }
    };

    const filteredFaculty = (faculty || []).filter(f => 
        (f?.faculty_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f?.department || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const absentIds = new Set((absences || []).map(a => a.faculty_id));
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden"
            >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <UserX className="w-10 h-10 text-blue-200" />
                                Attendance & Substitutions
                            </h1>
                            <p className="text-blue-100 mt-2 text-lg">
                                Manage daily absences and auto-allocated replacements
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4">
                            <Calendar className="w-6 h-6 text-blue-200" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-transparent border-none text-white focus:ring-0 font-semibold cursor-pointer outline-none"
                            />
                            <button 
                                onClick={fetchAbsences}
                                className="p-2 hover:bg-white/20 rounded-xl transition-all"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="px-8 py-4 bg-blue-50/50 border-t border-blue-100 flex items-center justify-between">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            <span className="text-sm font-medium text-gray-600">{absences.length} Absent</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <span className="text-sm font-medium text-gray-600">{substitutes.length} Substitutions</span>
                        </div>
                    </div>
                    {error && <span className="text-red-500 text-xs font-bold bg-red-50 px-3 py-1 rounded-full border border-red-100">{error}</span>}
                    <div className="text-sm font-bold text-blue-800 uppercase tracking-widest">
                        {dayName}
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Faculty List Panel */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-1 bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 p-6 flex flex-col h-[600px]"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <UserCheck className="w-6 h-6 text-green-500" />
                            Faculty List
                        </h2>
                        {loading && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input 
                            type="text"
                            placeholder="Search faculty..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                        {filteredFaculty.length === 0 && !loading && (
                            <div className="text-center py-10 text-gray-400 text-sm italic">No faculty found</div>
                        )}
                        <AnimatePresence>
                            {filteredFaculty.map(f => {
                                const isAbsent = absentIds.has(f.faculty_id);
                                return (
                                    <motion.div 
                                        layout
                                        key={f.faculty_id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                            isAbsent 
                                                ? 'bg-red-50 border-red-100 shadow-sm' 
                                                : 'bg-gray-50 border-gray-50 hover:border-gray-200'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{f.faculty_name}</p>
                                            <p className="text-xs text-gray-500">{f.department}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <button
                                                disabled={subLoading}
                                                onClick={() => isAbsent ? markPresent(f.faculty_id) : markAbsent(f.faculty_id)}
                                                className={`w-full px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                                    isAbsent 
                                                        ? 'bg-red-500 text-white shadow-lg shadow-red-200 hover:bg-red-600' 
                                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {isAbsent ? 'ABSENT' : 'PRESENT'}
                                            </button>
                                            <button 
                                                onClick={() => fetchFacultyTodayTimetable(f.faculty_id, f.faculty_name)}
                                                className="text-[10px] text-blue-600 hover:underline font-semibold"
                                            >
                                                View Today's Slots
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Substitute Timetable Panel */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 p-6 flex flex-col h-[600px]"
                >
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-blue-500" />
                        Daily Substitution View
                    </h2>

                    {substitutes.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                            <CheckCircle className="w-16 h-16 mb-4 text-green-200" />
                            <p className="text-lg font-medium">No active substitutions</p>
                            <p className="text-sm">Mark a faculty as absent to view auto-allocated slots</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {substitutes.map((s, idx) => {
                                const freeFaculty = freeFacultyByPeriod[s.period] || [];
                                const currentSubInList = s.substitute_faculty_id && !freeFaculty.find(f => f.faculty_id === s.substitute_faculty_id)
                                    ? [{ faculty_id: s.substitute_faculty_id, faculty_name: s.substitute_faculty_name + ' (current)' }]
                                    : [];
                                const options = [...currentSubInList, ...freeFaculty];

                                return (
                                    <motion.div 
                                        key={`${s.timetable_id}-${idx}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                                P{s.period}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900">{s.year} - {s.section_name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        s.subject_type === 'Lab' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                        {s.subject_type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500">{s.subject_name}</p>
                                                <p className="text-xs text-gray-400 mt-1 italic">Orig: {s.original_faculty_name}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Substitute Assigned</span>
                                                {s.substitute_faculty_name ? (
                                                    <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">
                                                        {s.substitute_faculty_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" /> No substitute
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <select 
                                                className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                value={s.substitute_faculty_id || ""}
                                                onChange={e => overrideSubstitute(s.timetable_id, e.target.value)}
                                            >
                                                <option value="" disabled>Manual Override...</option>
                                                {options.map(f => (
                                                    <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </div>

            {subLoading && (
                <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl flex items-center gap-4 border border-gray-100">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        <span className="font-bold text-gray-700">Updating...</span>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {viewingTimetable && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-center">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-4xl w-full"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-900">{viewingTimetable.name}'s Schedule ({dayName})</h3>
                                <button 
                                    onClick={() => setViewingTimetable(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                                >
                                    <UserCheck className="w-6 h-6" />
                                </button>
                            </div>
                            
                            {viewingTimetable.timetable.length === 0 ? (
                                <p className="py-20 text-gray-500 italic">No classes scheduled for today.</p>
                            ) : (
                                <div className="grid grid-cols-6 gap-3 pb-4 overflow-x-auto">
                                    {[1,2,3,4,5,6].map(p => {
                                        const slot = viewingTimetable.timetable.find(s => s.period === p);
                                        return (
                                            <div key={p} className={`p-4 rounded-2xl border ${slot ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-50 opacity-40'}`}>
                                                <p className="text-[10px] font-black text-gray-400 mb-2">PERIOD {p}</p>
                                                {slot ? (
                                                    <>
                                                        <p className="text-xs font-bold text-indigo-900 mb-1">{slot.subject_name}</p>
                                                        <p className="text-[10px] font-semibold text-indigo-600">{slot.section_name}</p>
                                                        <p className="text-[9px] text-gray-500 mt-2">Room {slot.room_id}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-gray-300 font-medium italic">Free</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            <button 
                                onClick={() => setViewingTimetable(null)}
                                className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                            >
                                Close
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Attendance;
