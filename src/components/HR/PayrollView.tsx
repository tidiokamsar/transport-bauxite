import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PayrollModal } from './PayrollModal';
import { PayrollDetailsModal } from './PayrollDetailsModal';
import { DollarSign, Plus, Edit, Trash2, Download, CheckCircle, Clock, XCircle, TrendingUp, Eye, FileText, Send, UserCircle } from 'lucide-react';

export const PayrollView = () => {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedPayroll] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayrollId, setSelectedPayrollId] = useState<string>('');
  const [filters, setFilters] = useState({ status: 'all', month: new Date().toISOString().slice(0, 7) });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from('payroll_records').select(`*, employee:employees(first_name, last_name, employee_number)`).order('period_start', { ascending: false });
    if (filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.month) {
      const [y, m] = filters.month.split('-');
      const start = `${y}-${m}-01`;
      const endOfMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
      const end = `${y}-${m}-${endOfMonth}`;
      query = query.gte('period_start', start).lte('period_start', end);
    }
    const { data } = await query.limit(50);
    setPayroll(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette fiche de paie?')) return;
    await supabase.from('payroll_records').delete().eq('id', id);
    fetchData();
  };

  const handleApprove = async (id: string) => {
    await supabase.from('payroll_records').update({ status: 'approved', approval_date: new Date().toISOString() }).eq('id', id);
    fetchData();
  };

  const handlePay = async (id: string) => {
    await supabase.from('payroll_records').update({ status: 'paid', payment_date: new Date().toISOString() }).eq('id', id);
    fetchData();
  };

  const handleViewDetails = (id: string) => {
    setSelectedPayrollId(id);
    setShowDetailModal(true);
  };

  const handleGenerateMonth = () => {
    setSelectedId(undefined);
    setIsModalOpen(true);
  };

  const stats = {
    total: payroll.reduce((sum, p) => sum + parseFloat(p.net_salary), 0),
    pending: payroll.filter(p => p.status === 'pending').length,
    paid: payroll.filter(p => p.status === 'paid').length,
    records: payroll.length,
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: any }> = {
      draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700', icon: Clock },
      pending: { label: 'En attente', color: 'bg-orange-100 text-orange-700', icon: Clock },
      approved: { label: 'Approuvé', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      paid: { label: 'Payé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${badge.color}`}><Icon className="w-3 h-3" />{badge.label}</span>;
  };

  const exportToCSV = () => {
    const filename = `paie_${filters.month || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = [
      'Numéro employé', 'Nom', 'Prénom', 'Période début', 'Période fin',
      'Jours travaillés', 'Salaire de base', 'Primes missions', 'Primes performances',
      'Bonus', 'Autres primes', 'Total primes', 'Déductions', 'Salaire brut',
      'Salaire net', 'Statut', 'Date paiement'
    ];

    const data = payroll.map(p => [
      p.employee?.employee_number || 'N/A',
      p.employee?.last_name || 'N/A',
      p.employee?.first_name || 'N/A',
      new Date(p.period_start).toLocaleDateString('fr-FR'),
      new Date(p.period_end).toLocaleDateString('fr-FR'),
      p.days_worked || 0,
      p.base_salary?.toFixed(0) || '0',
      p.mission_bonuses?.toFixed(0) || '0',
      p.performance_bonuses?.toFixed(0) || '0',
      p.other_bonuses?.toFixed(0) || '0',
      p.additional_allowances?.toFixed(0) || '0',
      p.total_bonuses?.toFixed(0) || '0',
      p.deductions?.toFixed(0) || '0',
      p.gross_salary?.toFixed(0) || '0',
      p.net_salary?.toFixed(0) || '0',
      p.status === 'paid' ? 'Payé' : p.status === 'approved' ? 'Approuvé' : p.status === 'pending' ? 'En attente' : 'Brouillon',
      p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion de la Paie</h1>
          <p className="text-slate-600 mt-1">Calcul automatique des salaires et bulletin de paie</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            title="Exporter CSV"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button onClick={handleGenerateMonth} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-5 h-5" />Générer Paie
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Total Salaires', value: `${(stats.total / 1000000).toFixed(1)}M GNF`, color: 'blue', icon: DollarSign },
          { label: 'Enregistrements', value: stats.records, color: 'green', icon: TrendingUp },
          { label: 'En attente', value: stats.pending, color: 'orange', icon: Clock },
          { label: 'Payés', value: stats.paid, color: 'green', icon: CheckCircle },
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
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Statut</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
              <option value="all">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="paid">Payé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Période</label>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Période</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salaire Base</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">H. Supp.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Primes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Déductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salaire Net</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payroll.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(p.id)}
                        className="text-left hover:text-blue-600 transition-colors"
                      >
                        <div className="font-medium flex items-center gap-2">
                          <UserCircle className="w-4 h-4" />
                          {p.employee?.first_name} {p.employee?.last_name}
                        </div>
                        <div className="text-sm text-slate-600">{p.employee?.employee_number}</div>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(p.period_start).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{(parseFloat(p.base_salary) / 1000).toFixed(0)}k GNF</td>
                    <td className="px-6 py-4 text-sm">{(parseFloat(p.overtime_pay) / 1000).toFixed(0)}k</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(p.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {(parseFloat(p.bonuses) / 1000).toFixed(0)}k GNF
                      </button>
                      {p.notes && <div className="text-xs text-slate-500 mt-0.5">{p.notes}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">-{(parseFloat(p.deductions) + parseFloat(p.tax_amount) + parseFloat(p.social_security)) / 1000}k</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-green-600">{(parseFloat(p.net_salary) / 1000).toFixed(0)}k GNF</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleViewDetails(p.id)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedId(p.id); setIsModalOpen(true); }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {p.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(p.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Approuver"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {p.status === 'approved' && (
                          <button
                            onClick={() => handlePay(p.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Marquer comme payé"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PayrollModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedId(undefined); }} payrollId={selectedId} onSuccess={fetchData} />

      <PayrollDetailsModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        payrollId={selectedPayrollId}
        onSuccess={fetchData}
      />

      {/* OLD MODAL - TO REMOVE */}
      {/* eslint-disable-next-line no-constant-binary-expression -- bloc desactive, a supprimer en Vague B (HR) */}
      {false && showDetailModal && selectedPayroll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Détails de la Paie</h2>
                  <p className="text-slate-600 mt-1">
                    {selectedPayroll.employee?.first_name} {selectedPayroll.employee?.last_name} -
                    {new Date(selectedPayroll.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-200 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600">Matricule</label>
                    <p className="font-medium">{selectedPayroll.employee?.employee_number}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Poste</label>
                    <p className="font-medium">{selectedPayroll.employee?.position}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Période</label>
                    <p className="font-medium">
                      {new Date(selectedPayroll.period_start).toLocaleDateString('fr-FR')} -
                      {new Date(selectedPayroll.period_end).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600">Jours travaillés</label>
                    <p className="font-medium">{selectedPayroll.days_worked} jours</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Jours absents</label>
                    <p className="font-medium">{selectedPayroll.days_absent} jours</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Heures travaillées</label>
                    <p className="font-medium">{selectedPayroll.hours_worked}h</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-bold mb-3">Rémunération</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Salaire de base</span>
                    <span className="font-medium">{parseFloat(selectedPayroll.base_salary).toLocaleString()} GNF</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Heures supplémentaires</span>
                    <span className="font-medium text-blue-600">+{parseFloat(selectedPayroll.overtime_pay || 0).toLocaleString()} GNF</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Primes</span>
                    <span className="font-medium text-green-600">+{parseFloat(selectedPayroll.bonuses || 0).toLocaleString()} GNF</span>
                  </div>
                </div>
              </div>

              {selectedPayroll.bonuses && selectedPayroll.bonuses.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-3">Détail des Primes</h3>
                  <div className="space-y-2">
                    {selectedPayroll.bonuses.map((bonus: any) => (
                      <div key={bonus.id} className="flex justify-between py-2 bg-green-50 px-3 rounded">
                        <div>
                          <p className="font-medium">{bonus.bonus_type === 'mission_completion' ? 'Primes missions' : bonus.bonus_type}</p>
                          <p className="text-xs text-slate-600">{bonus.description}</p>
                        </div>
                        <span className="font-medium text-green-600">{parseFloat(bonus.amount).toLocaleString()} GNF</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-bold mb-3">Déductions</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Sécurité sociale</span>
                    <span className="font-medium text-red-600">-{parseFloat(selectedPayroll.social_security || 0).toLocaleString()} GNF</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Impôts</span>
                    <span className="font-medium text-red-600">-{parseFloat(selectedPayroll.tax_amount || 0).toLocaleString()} GNF</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Autres déductions</span>
                    <span className="font-medium text-red-600">-{parseFloat(selectedPayroll.deductions || 0).toLocaleString()} GNF</span>
                  </div>
                </div>
              </div>

              <div className="border-t-2 pt-4">
                <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg">
                  <span className="text-lg font-bold">Salaire Net</span>
                  <span className="text-2xl font-bold text-green-600">{parseFloat(selectedPayroll.net_salary).toLocaleString()} GNF</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" />
                  Télécharger bulletin
                </button>
                <button className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Envoyer par email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
