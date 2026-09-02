import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, RefreshCw,
  Fuel, Wrench, Users, FileText, BarChart3, Calendar
} from 'lucide-react';

interface Cost {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  payment_method: string | null;
  cost_categories: { name: string; type: string } | null;
  vehicles: { registration_number: string } | null;
}

export const CostsView = () => {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('costs')
        .select(`
          *,
          cost_categories(name, type),
          vehicles(registration_number)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setCosts(data || []);
    } catch (error) {
      console.error('Error fetching costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const ranges = {
      today: new Date(now.setHours(0, 0, 0, 0)),
      week: new Date(now.setDate(now.getDate() - 7)),
      month: new Date(now.setMonth(now.getMonth() - 1)),
      year: new Date(now.setFullYear(now.getFullYear() - 1)),
    };
    return ranges[periodFilter as keyof typeof ranges] || ranges.month;
  };

  const filteredCosts = costs.filter(cost => {
    const matchesSearch =
      cost.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cost.reference?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || cost.cost_categories?.type === categoryFilter;

    const dateRange = getDateRange();
    const matchesDate = new Date(cost.date) >= dateRange;

    return matchesSearch && matchesCategory && matchesDate;
  });

  const totalCosts = filteredCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const fixedCosts = filteredCosts
    .filter(c => c.cost_categories?.type === 'fixed')
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const variableCosts = filteredCosts
    .filter(c => c.cost_categories?.type === 'variable')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const categoryBreakdown = filteredCosts.reduce((acc, cost) => {
    const category = cost.cost_categories?.name || 'Non catégorisé';
    acc[category] = (acc[category] || 0) + (cost.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Coûts</h1>
          <p className="text-slate-600 mt-1">Suivi des charges et dépenses d'exploitation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchCosts}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <Plus className="w-5 h-5" />
            Nouvelle dépense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Total dépenses</h3>
            <DollarSign className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{(totalCosts / 1000000).toFixed(1)}M</p>
          <p className="text-sm opacity-90 mt-1">GNF</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Charges fixes</h3>
            <TrendingUp className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{(fixedCosts / 1000000).toFixed(1)}M</p>
          <p className="text-sm opacity-90 mt-1">
            {totalCosts > 0 ? ((fixedCosts / totalCosts) * 100).toFixed(0) : 0}% du total
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Charges variables</h3>
            <TrendingDown className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{(variableCosts / 1000000).toFixed(1)}M</p>
          <p className="text-sm opacity-90 mt-1">
            {totalCosts > 0 ? ((variableCosts / totalCosts) * 100).toFixed(0) : 0}% du total
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Transactions</h3>
            <FileText className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{filteredCosts.length}</p>
          <p className="text-sm opacity-90 mt-1">dépenses enregistrées</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="all">Toutes catégories</option>
                <option value="fixed">Charges fixes</option>
                <option value="variable">Charges variables</option>
                <option value="operational">Opérationnelles</option>
              </select>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="year">Cette année</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Catégorie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Véhicule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Montant</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredCosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Aucune dépense trouvée
                    </td>
                  </tr>
                ) : (
                  filteredCosts.map((cost) => (
                    <tr key={cost.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {new Date(cost.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{cost.description}</div>
                        <div className="text-xs text-slate-500">{cost.reference || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
                          {cost.cost_categories?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {cost.vehicles?.registration_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-red-600">
                          -{((cost.amount || 0) / 1000000).toFixed(2)}M
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Répartition par catégorie
            </h3>
            <div className="space-y-3">
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, amount]) => {
                  const percentage = totalCosts > 0 ? (amount / totalCosts) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 truncate">{category}</span>
                        <span className="font-semibold">{((amount as number) / 1000000).toFixed(1)}M</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Période d'analyse
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Début:</span>
                <span className="font-medium">{getDateRange().toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Fin:</span>
                <span className="font-medium">{new Date().toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-900">Total période:</span>
                  <span className="text-red-600">{(totalCosts / 1000000).toFixed(2)}M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
