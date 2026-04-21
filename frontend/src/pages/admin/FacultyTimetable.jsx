import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Calendar, Download, Building, FileText, Users } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { generateFacultyExcelGrid, downloadWorkbook, robustDownload } from '../../utils/exporter';

const FacultyTimetable = () => {
    const [faculties, setFaculties] = useState([]);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(false);
    const printRef = useRef();

    useEffect(() => {
        // Fetch all faculties
        axios.get('http://localhost:5000/api/faculty', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => setFaculties(res.data))
        .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!selectedFacultyId) {
            setTimetable([]);
            return;
        }

        setLoading(true);
        axios.get(`http://localhost:5000/api/timetable/faculty/${selectedFacultyId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => {
            setTimetable(res.data);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [selectedFacultyId]);

    const handleDownloadPDF = () => {
        if (timetable.length === 0 || !selectedFacultyId) return;

        const faculty = faculties.find(f => f.faculty_id === parseInt(selectedFacultyId));
        const filename = `Timetable_${faculty?.faculty_name.replace(/\s+/g, '_')}.pdf`;
        
        const element = printRef.current;
        const opt = {
            margin: 0.5,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        
        html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            const pdfBase64 = pdf.output('datauristring');
            robustDownload(opt.filename, pdfBase64, 'application/pdf');
        }).catch(err => console.error(err));
    };

    const handleDownloadExcel = () => {
        if (timetable.length === 0 || !selectedFacultyId) return;

        const faculty = faculties.find(f => f.faculty_id === parseInt(selectedFacultyId));
        const filename = `Timetable_${faculty?.faculty_name.replace(/\s+/g, '_')}.xlsx`;
        
        const ws = generateFacultyExcelGrid(timetable, faculty.faculty_name);
        downloadWorkbook({ [faculty.faculty_name]: ws }, filename);
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periods = [1, 2, 3, 4, 5, 6];

    const getSlot = (day, period) => {
        return timetable.find(t => t.day === day && t.period === period);
    };

    const displaySectionName = (year, name) => {
        const yearMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
        return `${yearMap[year] || year}-CSE-${name}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-indigo-600" />
                        Faculty Schedules
                    </h1>
                    <p className="text-gray-500 mt-2">View and export individual faculty timetables.</p>
                </div>
                
                <div className="flex gap-4">
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={selectedFacultyId}
                        onChange={(e) => setSelectedFacultyId(e.target.value)}
                    >
                        <option value="">Select Faculty...</option>
                        {faculties.map(f => (
                            <option key={f.faculty_id} value={f.faculty_id}>
                                {f.faculty_name} ({f.department})
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={timetable.length === 0 || !selectedFacultyId}
                        className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        <FileText className="w-5 h-5 mr-2" /> PDF
                    </button>
                    <button
                        onClick={handleDownloadExcel}
                        disabled={timetable.length === 0 || !selectedFacultyId}
                        className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                        <Download className="w-5 h-5 mr-2" /> Excel
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">Loading timetable...</div>
            ) : selectedFacultyId && timetable.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" ref={printRef}>
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800">
                            {faculties.find(f => f.faculty_id === parseInt(selectedFacultyId))?.faculty_name}'s Timetable 
                            <span className="ml-2 text-indigo-600">
                                (Workload: {timetable.length} hours/week)
                            </span>
                        </h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100/50">
                                <tr>
                                    <th className="px-4 py-3 border-b border-r bg-gray-50 text-center w-32">Day / Period</th>
                                    {periods.map(p => (
                                        <React.Fragment key={p}>
                                            <th className="px-4 py-3 border-b text-center font-bold text-gray-600 w-40">Period {p}</th>
                                            {p === 3 && <th className="px-4 py-3 border-b bg-amber-50 text-amber-700 text-center w-24">LUNCH</th>}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {days.map(day => (
                                    <tr key={day} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-4 font-semibold text-gray-900 border-r bg-gray-50/30 text-center">
                                            {day}
                                        </td>
                                        {periods.map(p => {
                                            const slot = getSlot(day, p);
                                            return (
                                                <React.Fragment key={p}>
                                                    <td className="px-3 py-3 text-center border-r last:border-r-0">
                                                        {slot ? (
                                                            <div className={`flex flex-col gap-1 inline-flex p-2 rounded-lg border w-full min-h-[5rem] justify-center shadow-sm ${
                                                                slot.role === 'viva' 
                                                                    ? 'bg-purple-50 border-purple-100 hover:border-purple-300' 
                                                                    : 'bg-indigo-50 border-indigo-100 hover:border-indigo-300'
                                                            }`}>
                                                                 <div className="flex justify-between items-start">
                                                                    <span className="font-bold border-b border-transparent group-hover:border-current line-clamp-2" title={slot.subject_name}>
                                                                        {slot.subject_name}
                                                                    </span>
                                                                    {slot.role === 'viva' && (
                                                                        <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">VIVA</span>
                                                                    )}
                                                                </div>
                                                                <span className={`text-xs font-semibold py-0.5 px-2 rounded-full w-max mx-auto border ${
                                                                    slot.role === 'viva' ? 'text-purple-600 bg-purple-100/50 border-purple-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                                                }`}>
                                                                    {displaySectionName(slot.year, slot.section_name)}
                                                                </span>
                                                                <div className="flex items-center justify-between gap-1 text-[10px] text-gray-500 mt-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <Building className="w-3 h-3" />
                                                                        <span>{slot.room_id}</span>
                                                                    </div>
                                                                    {slot.viva_faculty_name && (
                                                                        <div className="flex items-center gap-1 italic truncate max-w-[80px]">
                                                                            <span>v: {slot.viva_faculty_name.split(' ').pop()}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    {p === 3 && (
                                                        <td className="px-2 py-3 bg-amber-50 border-r border-amber-100">
                                                            <div className="h-full flex items-center justify-center">
                                                                <div className="w-1 h-12 bg-amber-200/50 rounded-full"></div>
                                                            </div>
                                                        </td>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : selectedFacultyId ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500">No classes assigned to this faculty member.</p>
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <Calendar className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Faculty</h3>
                    <p className="text-gray-500">Choose a faculty member from the dropdown to view their timetable.</p>
                </div>
            )}
        </div>
    );
};

export default FacultyTimetable;
