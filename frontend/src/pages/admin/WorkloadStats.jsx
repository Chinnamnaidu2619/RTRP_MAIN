import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Info, Download, Loader2 } from 'lucide-react';

const WorkloadStats = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/stats'); // This is a bit different from our custom ReportService report but we can adapt it or add a dedicated route.
            // Let's assume we use /api/faculty/workload if we wanted but we'll use the stats we have or pull faculty list and calc.
            // Actually, I'll add a specific route /api/faculty/workload in api.js next.
            const facultyRes = await axios.get('/api/faculty');
            // Mocking the workload for now until the route is added
            setStats(facultyRes.data.map(f => ({ ...f, weekly_load: Math.floor(Math.random() * 24) + 12 })));
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500 w-10 h-10" /></div>;

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="p-6 space-y-8"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Faculty Workload Reports</h1>
                    <p className="text-slate-500">Overview of teaching hours and distribution across departments.</p>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all font-semibold shadow-lg">
                    <Download className="w-4 h-4" /> Export Report
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Avg Weekly Load', value: '18.4 hrs', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Max Load', value: '26 hrs', icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Target Load', value: '20 hrs', icon: Info, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <th className="px-8 py-5">Faculty Member</th>
                            <th className="px-8 py-5">Department</th>
                            <th className="px-8 py-5">Weekly Hours</th>
                            <th className="px-8 py-5">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stats.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-5 font-semibold text-slate-700">{row.faculty_name}</td>
                                <td className="px-8 py-5 text-slate-600">{row.department}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full w-32 overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(row.weekly_load / 28) * 100}%` }}
                                                className={`h-full rounded-full ${row.weekly_load > 22 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                            />
                                        </div>
                                        <span className="font-bold text-slate-700">{row.weekly_load}h</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                                        row.weekly_load > 22 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        {row.weekly_load > 22 ? 'Near Overload' : 'Optimal'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default WorkloadStats;
