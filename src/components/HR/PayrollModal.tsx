import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, User, TrendingUp, TrendingDown, Calculator, CheckCircle, Truck, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollId?: string;
  onSuccess: () => void;
}

export const PayrollModal = ({ isOpen, onClose, payrollId, onSuccess }: PayrollModalProps) => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [autoCalculation, setAutoCalculation] = useState<any>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    period_start: '',
    period_end: '',
    base_salary: 0,
    overtime_pay: 0,
    bonuses: 0,
    deductions: 0,
    tax_amount: 0,
    social_security: 0,
    net_salary: 0,
    status: 'draft',
    payment_method: 'Virement bancaire',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      if (payrollId) {
        fetchPayroll();
      } else {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFormData({
          ...formData,
          period_start: start.toISOString().split('T')[0],
          period_end: end.toISOString().split('T')[0],
        });
      }
    }
  }, [isOpen, payrollId]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, base_salary, position')
      .eq('status', 'active')
      .order('first_name');
    setEmployees(data || []);
  };

  const fetchPayroll = async () => {
    if (!payrollId) return;
    const { data } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('id', payrollId)
      .maybeSingle();
    if (data) {
      setFormData({
        employee_id: data.employee_id,
        period_start: data.period_start,
        period_end: data.period_end,
        base_salary: parseFloat(data.base_salary),
        overtime_pay: parseFloat(data.overtime_pay),
        bonuses: parseFloat(data.bonuses),
        deductions: parseFloat(data.deductions),
        tax_amount: parseFloat(data.tax_amount),
        social_security: parseFloat(data.social_security),
        net_salary: parseFloat(data.net_salary),
        status: data.status,
        payment_method: data.payment_method || 'Virement bancaire',
        notes: data.notes || '',
      });
    }
  };

  const autoCalculatePayroll = async () => {
    if (!formData.employee_id || !formData.period_start || !formData.period_end) {
      alert('Veuillez sélectionner un employé et une période');
      return;
    }

    setCalculating(true);
    try {
      const { data, error } = await supabase.rpc('calculate_employee_payroll', {
        p_employee_id: formData.employee_id,
        p_period_start: formData.period_start,
        p_period_end: formData.period_end,
      });

      if (error) throw error;

      setAutoCalculation(data);

      setFormData({
        ...formData,
        base_salary: parseFloat(data.salary.base_salary),
        overtime_pay: parseFloat(data.salary.overtime_pay),
        bonuses: parseFloat(data.salary.mission_bonus),
        deductions: parseFloat(data.deductions.total_deductions),
        tax_amount: parseFloat(data.deductions.tax_amount),
        social_security: parseFloat(data.deductions.social_security),
        net_salary: parseFloat(data.final.net_salary),
        notes: data.details.calculation_notes,
      });
    } catch (error: any) {
      console.error('Erreur calcul automatique:', error);
      alert('Erreur lors du calcul automatique: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (payrollId) {
        const { error } = await supabase
          .from('payroll_records')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', payrollId);
        if (error) throw error;
      } else {
        // Vérifier si une fiche existe déjà pour cet employé et cette période
        const { data: existing } = await supabase
          .from('payroll_records')
          .select('id')
          .eq('employee_id', formData.employee_id)
          .eq('period_start', formData.period_start)
          .eq('period_end', formData.period_end)
          .maybeSingle();

        if (existing) {
          if (confirm('Une fiche de paie existe déjà pour cet employé et cette période. Voulez-vous la mettre à jour?')) {
            const { error } = await supabase
              .from('payroll_records')
              .update({
                ...formData,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            setLoading(false);
            return;
          }
        } else {
          const { error } = await supabase.from('payroll_records').insert({
            ...formData,
          });
          if (error) throw error;
        }
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{payrollId ? 'Modifier Paie' : 'Générer Paie Automatique'}</h2>
            <p className="text-sm text-slate-600">Toutes les données sont chargées automatiquement depuis les autres modules</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sélection employé et période */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5" />
              Étape 1: Sélectionner l'employé et la période
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-sm font-medium mb-2">Employé *</label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => {
                    setFormData({ ...formData, employee_id: e.target.value });
                    setAutoCalculation(null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_number} - {emp.first_name} {emp.last_name} ({emp.position})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2"><Calendar className="w-4 h-4 inline mr-2" />Début *</label>
                <input
                  type="date"
                  required
                  value={formData.period_start}
                  onChange={(e) => {
                    setFormData({ ...formData, period_start: e.target.value });
                    setAutoCalculation(null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2"><Calendar className="w-4 h-4 inline mr-2" />Fin *</label>
                <input
                  type="date"
                  required
                  value={formData.period_end}
                  onChange={(e) => {
                    setFormData({ ...formData, period_end: e.target.value });
                    setAutoCalculation(null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={autoCalculatePayroll}
                  disabled={calculating || !formData.employee_id || !formData.period_start || !formData.period_end}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-2 font-semibold"
                >
                  <Calculator className="w-5 h-5" />
                  {calculating ? 'Calcul en cours...' : 'Calculer Automatiquement'}
                </button>
              </div>
            </div>
          </div>

          {/* Résultats du calcul automatique */}
          {autoCalculation && (
            <div className="space-y-4">
              {/* Statistiques présence */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Présences & Heures (depuis module Attendance)
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-slate-600">Jours présents</div>
                    <div className="text-2xl font-bold text-green-600">{autoCalculation.attendance.days_present}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-slate-600">Jours travaillés</div>
                    <div className="text-2xl font-bold text-slate-900">{autoCalculation.period.working_days}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-slate-600">Heures régulières</div>
                    <div className="text-2xl font-bold text-blue-600">{autoCalculation.attendance.regular_hours}h</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-slate-600">Heures supplémentaires</div>
                    <div className="text-2xl font-bold text-orange-600">{autoCalculation.attendance.overtime_hours}h</div>
                  </div>
                </div>
              </div>

              {/* Missions */}
              {autoCalculation.missions.completed_trips > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Missions Complétées (depuis module Trips)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-slate-600">Nombre de missions</div>
                      <div className="text-3xl font-bold text-green-600">{autoCalculation.missions.completed_trips}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-slate-600">Prime par mission</div>
                      <div className="text-xl font-bold text-slate-900">{autoCalculation.missions.bonus_per_trip.toLocaleString()} GNF</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-slate-600">Total primes missions</div>
                      <div className="text-xl font-bold text-green-600">{autoCalculation.missions.total_mission_bonus.toLocaleString()} GNF</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Salaire */}
              <div className="bg-white rounded-lg p-4 border-2">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Calcul du Salaire
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700">Salaire de base (GNF)</label>
                    <input
                      type="number"
                      readOnly
                      value={formData.base_salary}
                      className="w-full px-4 py-2 border rounded-lg bg-slate-50 font-bold text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-orange-700">
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Heures supplémentaires (GNF)
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={formData.overtime_pay}
                      className="w-full px-4 py-2 border rounded-lg bg-orange-50 font-bold text-lg text-orange-700"
                    />
                    <div className="text-xs text-slate-600 mt-1">
                      {autoCalculation.attendance.overtime_hours}h × {(autoCalculation.details.hourly_rate * 1.5).toFixed(0)} GNF/h
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-green-700">
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Primes missions (GNF)
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={formData.bonuses}
                      className="w-full px-4 py-2 border rounded-lg bg-green-50 font-bold text-lg text-green-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-red-700">
                      <TrendingDown className="w-4 h-4 inline mr-2" />
                      Déductions totales (GNF)
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={formData.deductions}
                      className="w-full px-4 py-2 border rounded-lg bg-red-50 font-bold text-lg text-red-700"
                    />
                  </div>
                </div>
              </div>

              {/* Détails déductions */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-bold text-slate-900 mb-3">Détails des Déductions</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white rounded p-3 border">
                    <div className="text-xs text-slate-600">Sécurité sociale (8%)</div>
                    <div className="text-lg font-bold text-slate-900">{autoCalculation.deductions.social_security.toLocaleString()} GNF</div>
                  </div>
                  <div className="bg-white rounded p-3 border">
                    <div className="text-xs text-slate-600">Impôts (5%)</div>
                    <div className="text-lg font-bold text-slate-900">{autoCalculation.deductions.tax_amount.toLocaleString()} GNF</div>
                  </div>
                  {autoCalculation.deductions.late_penalties > 0 && (
                    <div className="bg-white rounded p-3 border">
                      <div className="text-xs text-red-600">Pénalités retards</div>
                      <div className="text-lg font-bold text-red-600">{autoCalculation.deductions.late_penalties.toLocaleString()} GNF</div>
                    </div>
                  )}
                  {autoCalculation.deductions.absence_deduction > 0 && (
                    <div className="bg-white rounded p-3 border">
                      <div className="text-xs text-red-600">Absences ({autoCalculation.attendance.days_absent}j)</div>
                      <div className="text-lg font-bold text-red-600">{autoCalculation.deductions.absence_deduction.toLocaleString()} GNF</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Salaire net final */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm opacity-90">Salaire Net à Payer</div>
                    <div className="text-4xl font-bold mt-1">{formData.net_salary.toLocaleString()} GNF</div>
                  </div>
                  <CheckCircle className="w-16 h-16 opacity-50" />
                </div>
              </div>

              {/* Notes de calcul */}
              {autoCalculation.details.calculation_notes && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Notes de Calcul Automatique
                  </h3>
                  <p className="text-sm text-blue-900">{autoCalculation.details.calculation_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Paramètres finaux */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium mb-2">Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="draft">Brouillon</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="paid">Payé</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Méthode de paiement</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option>Virement bancaire</option>
                <option>Chèque</option>
                <option>Espèces</option>
                <option>Mobile Money</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border rounded-lg hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !autoCalculation}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-semibold"
            >
              {loading ? 'Enregistrement...' : payrollId ? 'Modifier' : 'Créer Fiche de Paie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
