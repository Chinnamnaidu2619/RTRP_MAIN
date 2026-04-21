import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Save, Clock, Star, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const PreferencesManager = () => {
  const [unavailable, setUnavailable] = useState({}); // { Monday: [1, 2], ... }
  const [preferred, setPreferred] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await axios.get('/api/preferences');
      setUnavailable(JSON.parse(res.data.unavailable_slots || '{}'));
      setPreferred(JSON.parse(res.data.preferred_slots || '{}'));
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (day, period, type) => {
    const setter = type === 'unavailable' ? setUnavailable : setPreferred;
    const current = type === 'unavailable' ? unavailable : preferred;
    const other = type === 'unavailable' ? preferred : unavailable;

    const list = [...(current[day] || [])];
    const index = list.indexOf(period);

    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(period);
      // Remove from other type if it exists to avoid conflicts
      const otherList = [...(other[day] || [])];
      const otherIndex = otherList.indexOf(period);
      if (otherIndex > -1) {
        otherList.splice(otherIndex, 1);
        (type === 'unavailable' ? setPreferred : setUnavailable)({ ...other, [day]: otherList });
      }
    }

    setter({ ...current, [day]: list });
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/preferences', {
        unavailable_slots: unavailable,
        preferred_slots: preferred
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">My Schedule Preferences</h1>
          <p className="text-slate-500 mt-1">Set your preferred and unavailable time slots for the next generation.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg
            ${success ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}
          `}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mb-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center text-sm font-medium text-slate-600">
            <div className="w-4 h-4 rounded bg-rose-100 border border-rose-200 mr-2"></div>
            Unavailable (Hard constraint)
        </div>
        <div className="flex items-center text-sm font-medium text-slate-600">
            <div className="w-4 h-4 rounded bg-indigo-100 border border-indigo-200 mr-2"></div>
            Preferred (Soft constraint)
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[120px_repeat(6,1fr)] bg-slate-50 border-b border-slate-200">
          <div className="p-4"></div>
          {PERIODS.map(p => (
            <div key={p} className="p-4 text-center text-xs font-bold text-slate-500 uppercase">
              Period {p}
            </div>
          ))}
        </div>

        {DAYS.map(day => (
          <div key={day} className="grid grid-cols-[120px_repeat(6,1fr)] border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors">
            <div className="p-4 flex items-center font-bold text-slate-700 text-sm">{day}</div>
            {PERIODS.map(period => {
              const isUnavailable = unavailable[day]?.includes(period);
              const isPreferred = preferred[day]?.includes(period);

              return (
                <div key={period} className="p-2 border-l border-slate-50 group relative">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => toggleSlot(day, period, 'unavailable')}
                      className={`
                        w-full h-8 rounded-lg flex items-center justify-center transition-all
                        ${isUnavailable ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100'}
                      `}
                      title="Mark as Unavailable"
                    >
                      {isUnavailable ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleSlot(day, period, 'preferred')}
                      className={`
                        w-full h-8 rounded-lg flex items-center justify-center transition-all
                        ${isPreferred ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-100'}
                      `}
                      title="Mark as Preferred"
                    >
                      {isPreferred ? <Star className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PreferencesManager;
