import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PayrollModal } from './PayrollModal';
import { PayrollDetailsModal } from './PayrollDetailsModal';
import { DollarSign, Plus, Edit, Download, CheckCircle, Clock, TrendingUp, Eye, UserCircle } from 'lucide-react';

export const PayrollView = () => {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
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

    </div>
  );
};
