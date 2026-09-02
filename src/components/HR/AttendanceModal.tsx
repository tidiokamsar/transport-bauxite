import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceId?: string;
  employeeId?: string;
  date?: string;
  onSuccess: () => void;
}

interface AttendanceForm {
  employee_id: string;
  date: string;
  status: string;
  check_in_time: string;
  check_out_time: string;
  hours_worked: number;
  overtime_hours: number;
  absence_reason: string;
  notes: string;
}

const STATUS_OPTIONS = [
  { value: 'present', label: 'Présent', color: 'green' },
  { value: 'late', label: 'Retard', color: 'orange' },
  { value: 'absent', label: 'Absent', color: 'red' },
  { value: 'half_day', label: 'Demi-journée', color: 'yellow' },
  { value: 'leave', label: 'Congé', color: 'blue' },
  { value: 'sick_leave', label: 'Congé maladie', color: 'purple' },
  { value: 'unpaid_leave', label: 'Congé sans solde', color: 'gray' },
];

export const AttendanceModal = ({
  isOpen,
  onClose,
  attendanceId,
  employeeId,
  date,
  onSuccess,
}: AttendanceModalProps) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState<AttendanceForm>({
    employee_id: employeeId || '',
    date: date || new Date().toISOString().split('T')[0],
    status: 'present',
    check_in_time: '08:00',
    check_out_time: '17:00',
    hours_worked: 8,
    overtime_hours: 0,
    absence_reason: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      if (attendanceId) {
        fetchAttendance();
      } else {
        resetForm();
      }
    }
  }, [isOpen, attendanceId]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number')
      .eq('status', 'active')
      .order('first_name');
    setEmployees(data || []);
  };

  const fetchAttendance = async () => {
    if (!attendanceId) return;

    const { data, error } = await supabase
      .from('employee_attendance')
      .select('*')
      .eq('id', attendanceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching attendance:', error);
      return;
    }

    if (data) {
      setFormData({
        employee_id: data.employee_id,
        date: data.date,
        status: data.status,
        check_in_time: data.check_in_time || '08:00',
        check_out_time: data.check_out_time || '17:00',
        hours_worked: parseFloat(data.hours_worked) || 0,
        overtime_hours: parseFloat(data.overtime_hours) || 0,
        absence_reason: data.absence_reason || '',
        notes: data.notes || '',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: employeeId || '',
      date: date || new Date().toISOString().split('T')[0],
      status: 'present',
      check_in_time: '08:00',
      check_out_time: '17:00',
      hours_worked: 8,
      overtime_hours: 0,
      absence_reason: '',
      notes: '',
    });
  };

  const calculateHours = () => {
    if (formData.check_in_time && formData.check_out_time) {
      const [inH, inM] = formData.check_in_time.split(':').map(Number);
      const [outH, outM] = formData.check_out_time.split(':').map(Number);
      const hours = outH - inH + (outM - inM) / 60;
      const regularHours = Math.min(hours, 8);
      const overtimeHours = Math.max(0, hours - 8);
      setFormData({
        ...formData,
        hours_worked: regularHours,
        overtime_hours: overtimeHours,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        check_in_time: ['present', 'late'].includes(formData.status) ? formData.check_in_time : null,
        check_out_time: ['present', 'late'].includes(formData.status) ? formData.check_out_time : null,
        hours_worked: ['present', 'late', 'half_day'].includes(formData.status) ? formData.hours_worked : 0,
        overtime_hours: ['present', 'late'].includes(formData.status) ? formData.overtime_hours : 0,
        updated_at: new Date().toISOString(),
      };

      if (attendanceId) {
        const { error } = await supabase
          .from('employee_attendance')
          .update(payload)
          .eq('id', attendanceId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_attendance')
          .insert(payload);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showTimeFields = ['present', 'late'].includes(formData.status);
  const showAbsenceReason = ['absent', 'leave', 'sick_leave', 'unpaid_leave'].includes(formData.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {attendanceId ? 'Modifier Présence' : 'Enregistrer Présence'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Suivi quotidien de présence
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Employé *
              </label>
              <select
                required
                disabled={!!employeeId}
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un employé</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_number} - {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Statut *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {showTimeFields && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Heure d'arrivée
                  </label>
                  <input
                    type="time"
                    value={formData.check_in_time}
                    onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                    onBlur={calculateHours}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Heure de départ
                  </label>
                  <input
                    type="time"
                    value={formData.check_out_time}
                    onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                    onBlur={calculateHours}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Heures travaillées
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.hours_worked}
                    onChange={(e) => setFormData({ ...formData, hours_worked: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Heures supplémentaires
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.overtime_hours}
                    onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {showAbsenceReason && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Raison de l'absence *
                </label>
                <input
                  type="text"
                  required
                  value={formData.absence_reason}
                  onChange={(e) => setFormData({ ...formData, absence_reason: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Congé annuel, Maladie, etc."
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Notes additionnelles..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : attendanceId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
