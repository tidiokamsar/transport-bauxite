import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AttendanceModal } from './AttendanceModal';
import { Calendar, Plus, Edit, Trash2, Download, Filter, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export const AttendanceView = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [filters, setFilters] = useState({ employee: 'all', status: 'all', month: new Date().toISOString().slice(0, 7) });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('id, first_name, last_name, employee_number').eq('status', 'active');
    setEmployees(emps || []);

    let query = supabase.from('employee_attendance').select(`*, employee:employees(first_name, last_name, employee_number)`).order('date', { ascending: false });
    if (filters.employee !== 'all') query = query.eq('employee_id', filters.employee);
    if (filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.month) {
      const [y, m] = filters.month.split('-');
      const start = `${y}-${m}-01`;
      const end = `${y}-${m}-${new Date(parseInt(y), parseInt(m), 0).getDate()}`;
      query = query.gte('date', start).lte('date', end);
    }
    const { data } = await query.limit(100);
    setAttendance(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer?')) return;
    await supabase.from('employee_attendance').delete().eq('id', id);
    fetchData();
  };

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => ['absent', 'sick_leave', 'leave'].includes(a.status)).length,
    late: attendance.filter(a => a.status === 'late').length,
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: any }> = {
      present: { label: 'Présent', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      late: { label: 'Retard', color: 'bg-orange-100 text-orange-700', icon: Clock },
      absent: { label: 'Absent', color: 'bg-red-100 text-red-700', icon: XCircle },
      half_day: { label: 'Demi-j.', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
      leave: { label: 'Congé', color: 'bg-blue-100 text-blue-700', icon: Calendar },
      sick_leave: { label: 'Maladie', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
      unpaid_leave: { label: 'Sans solde', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
    };
    const badge = badges[status] || badges.present;
    const Icon = badge.icon;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${badge.color}`}><Icon className="w-3 h-3" />{badge.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Présences & Absences</h1>
          <p className="text-slate-600 mt-1">Suivi quotidien de la présence des employés</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fetchData()} className="px-4 py-2 border rounded-lg hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-slate-50"><Download className="w-5 h-5" /></button>
          <button onClick={() => { setSelectedId(undefined); setIsModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-5 h-5" />Ajouter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Total', value: stats.total, color: 'blue', icon: Calendar },
          { label: 'Présents', value: stats.present, color: 'green', icon: CheckCircle },
          { label: 'Absents', value: stats.absent, color: 'red', icon: XCircle },
          { label: 'Retards', value: stats.late, color: 'orange', icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`bg-${color}-600 text-white p-6 rounded-lg`}>
            <div className="flex items-center gap-4">
              <Icon className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">{label}</p>
                <p className="text-3xl font-bold">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Employé</label>
            <select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
              <option value="all">Tous</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Statut</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
              <option value="all">Tous</option>
              <option value="present">Présent</option>
              <option value="late">Retard</option>
              <option value="absent">Absent</option>
              <option value="leave">Congé</option>
              <option value="sick_leave">Maladie</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Mois</label>
            <input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Heures</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">H. Supp.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Raison</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendance.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{a.employee?.first_name} {a.employee?.last_name}</div>
                      <div className="text-sm text-slate-600">{a.employee?.employee_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">{getStatusBadge(a.status)}</td>
                    <td className="px-6 py-4 text-sm">{a.hours_worked || '-'}h</td>
                    <td className="px-6 py-4 text-sm">{a.overtime_hours > 0 ? `${a.overtime_hours}h` : '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{a.absence_reason || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedId(a.id); setIsModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AttendanceModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedId(undefined); }} attendanceId={selectedId} onSuccess={fetchData} />
    </div>
  );
};
