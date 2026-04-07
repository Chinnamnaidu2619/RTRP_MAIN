import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileText, Calendar } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { generateFacultyExcelGrid, downloadWorkbook } from '../../utils/exporter';

const FacultyDashboard = () => {
    const { user } = useAuth();
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef(null);

    useEffect(() => {
        if (user?.faculty_id) {
            axios.get(`http://localhost:5000/api/timetable/faculty/${user.faculty_id}`)
                .then(res => setTimetable(res.data))
                .finally(() => setLoading(false));
        }
    }, [user]);

    const handleDownloadPDF = () => {
        const element = printRef.current;
        const opt = {
            margin: 0.5,
            filename: `Timetable_${user.name?.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    };

    const handleDownloadExcel = () => {
        const ws = generateFacultyExcelGrid(timetable, user.name);
        downloadWorkbook({ "My_Timetable": ws }, `Timetable_${user.name?.replace(/\s+/g, '_')}.xlsx`);
    };

    const displaySectionName = (year, name) => {
        let cleanName = name.startsWith(`${year}-`) ? name : `${year}-${name}`;
        return cleanName.toUpperCase();
    };

    if (loading) return <div className="text-center mt-10">Loading personal schedule...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome, {user?.name}</h2>
                    <p className="text-gray-500 mt-2">Here is your personalized weekly teaching schedule.</p>
                </div>
                <div className="flex flex-wrap gap-3 mt-6 md:mt-0">
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={timetable.length === 0}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-3 rounded-xl flex items-center font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        <FileText className="w-5 h-5 mr-3" /> PDF
                    </button>
                    <button 
                        onClick={handleDownloadExcel}
                        disabled={timetable.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl flex items-center font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        <Download className="w-5 h-5 mr-3" /> Excel
                    </button>
                </div>
            </div>

            {timetable.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-500">
                    No classes assigned yet. Please contact administration.
                </div>
            ) : (
                <div ref={printRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
                     <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 print:bg-white print:border-black">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center">
                            <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                            My Weekly Timetable
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase tracking-wider text-xs font-bold">
                                    <th className="p-4">Day</th>
                                    <th className="p-4">Period</th>
                                    <th className="p-4">Section (Class)</th>
                                    <th className="p-4">Subject</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Room</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {timetable.sort((a,b) => a.period - b.period).reduce((acc, cls, idx, arr) => {
                                    acc.push(cls);
                                    // If this is period 3 and the next one (if any) is >= 4, or if this is the last p3
                                    if (cls.period === 3) {
                                        // Insert a break row
                                        acc.push({
                                            isBreak: true,
                                            id: `break-${cls.day}-${cls.period}`,
                                            day: cls.day
                                        });
                                    }
                                    return acc;
                                }, []).map((item) => (
                                    item.isBreak ? (
                                        <tr key={item.id} className="bg-orange-50/20">
                                            <td className="p-4 font-bold text-orange-400 text-[10px] bg-orange-50/10 border-r border-orange-100">{item.day}</td>
                                            <td colSpan="5" className="p-4 text-center text-[10px] font-bold text-orange-500/50 uppercase tracking-[0.5em]">
                                                --- Lunch Break ---
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={item.id} className="hover:bg-indigo-50/40 transition-colors">
                                            <td className="p-4 font-semibold text-gray-800">{item.day}</td>
                                            <td className="p-4">Period {item.period}</td>
                                            <td className="p-4 font-bold text-indigo-700">{displaySectionName(item.year, item.section_name)}</td>
                                            <td className="p-4 text-gray-700 font-medium">{item.subject_name}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.subject_type === 'Lab' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {item.subject_type}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-gray-500">Room {item.room_id}</td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacultyDashboard;
