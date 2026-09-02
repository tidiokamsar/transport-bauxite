import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Package, AlertTriangle, RefreshCw, Edit, Trash2, Droplet, MapPin, TrendingDown
} from 'lucide-react';
import { FuelStockModal } from './FuelStockModal';

interface FuelStock {
  id: string;
  site_id: string;
  fuel_type_id: string;
  tank_capacity: number;
  current_stock: number;
  minimum_stock: number;
  last_refill_date: string | null;
  site: { name: string } | null;
  fuel_type: { name: string } | null;
}

export const FuelStocksView = () => {
  const [stocks, setStocks] = useState<FuelStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<FuelStock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fuel_stocks')
        .select(`
          *,
          site:sites(name),
          fuel_type:fuel_types(name)
        `)
        .order('current_stock', { ascending: true });

      if (error) throw error;
      setStocks(data || []);
    } catch (error) {
      console.error('Error fetching fuel stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedStock(null);
    setIsModalOpen(true);
  };

  const handleEdit = (stock: FuelStock) => {
    setSelectedStock(stock);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce stock ?')) return;

    const { error } = await supabase
      .from('fuel_stocks')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchStocks();
    }
  };

  const handleModalClose = (saved: boolean) => {
    setIsModalOpen(false);
    setSelectedStock(null);
    if (saved) {
      fetchStocks();
    }
  };

  const filteredStocks = stocks.filter((stock) =>
    stock.site?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.fuel_type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCapacity = stocks.reduce((sum, s) => sum + s.tank_capacity, 0);
  const totalStock = stocks.reduce((sum, s) => sum + s.current_stock, 0);
  const lowStockCount = stocks.filter(s => s.current_stock <= s.minimum_stock).length;
  const criticalStockCount = stocks.filter(s => s.current_stock <= s.minimum_stock * 0.5).length;

  const getStockStatus = (stock: FuelStock) => {
    const percentage = (stock.current_stock / stock.tank_capacity) * 100;
    if (stock.current_stock <= stock.minimum_stock * 0.5) {
      return { label: 'Critique', color: 'bg-red-100 text-red-800 border-red-200', barColor: 'bg-red-600' };
    } else if (stock.current_stock <= stock.minimum_stock) {
      return { label: 'Faible', color: 'bg-orange-100 text-orange-800 border-orange-200', barColor: 'bg-orange-600' };
    } else if (percentage < 50) {
      return { label: 'Moyen', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', barColor: 'bg-yellow-600' };
    } else {
      return { label: 'Bon', color: 'bg-green-100 text-green-800 border-green-200', barColor: 'bg-green-600' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Chargement des stocks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Package className="w-10 h-10 text-blue-600" />
            Stocks Carburant par Dépôt
          </h1>
          <p className="text-slate-600 mt-2">Gestion des réservoirs et niveaux de stock</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStocks}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouveau Stock
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Capacité Totale</p>
              <p className="text-3xl font-bold mt-1">{totalCapacity.toLocaleString()} L</p>
            </div>
            <Package className="w-10 h-10 opacity-90" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Stock Actuel</p>
              <p className="text-3xl font-bold mt-1">{totalStock.toLocaleString()} L</p>
            </div>
            <Droplet className="w-10 h-10 opacity-90" />
          </div>
          <div className="mt-2 text-sm opacity-90">
            {((totalStock / totalCapacity) * 100).toFixed(1)}% de remplissage
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Stocks Faibles</p>
              <p className="text-3xl font-bold mt-1">{lowStockCount}</p>
            </div>
            <AlertTriangle className="w-10 h-10 opacity-90" />
          </div>
          <div className="mt-2 text-sm opacity-90">
            Dépôts à surveiller
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Stocks Critiques</p>
              <p className="text-3xl font-bold mt-1">{criticalStockCount}</p>
            </div>
            <TrendingDown className="w-10 h-10 opacity-90" />
          </div>
          <div className="mt-2 text-sm opacity-90">
            Réappro urgent
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par site ou type de carburant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Stocks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStocks.map((stock) => {
          const status = getStockStatus(stock);
          const percentage = (stock.current_stock / stock.tank_capacity) * 100;
          const isCritical = stock.current_stock <= stock.minimum_stock * 0.5;
          const isLow = stock.current_stock <= stock.minimum_stock;

          return (
            <div key={stock.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-bold text-slate-900">{stock.site?.name || 'N/A'}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-slate-500" />
                    <p className="text-sm text-slate-600">{stock.fuel_type?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(stock)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(stock.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-bold inline-block mb-4 ${status.color}`}>
                {status.label}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Niveau actuel</span>
                    <span className={`text-sm font-bold ${
                      isCritical ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {stock.current_stock.toLocaleString()} L ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${status.barColor}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Capacité</p>
                    <p className="text-lg font-bold text-slate-900">{stock.tank_capacity.toLocaleString()} L</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Stock min</p>
                    <p className="text-lg font-bold text-slate-900">{stock.minimum_stock.toLocaleString()} L</p>
                  </div>
                </div>

                {stock.last_refill_date && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-600">Dernier remplissage</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {new Date(stock.last_refill_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}

                {(isCritical || isLow) && (
                  <div className={`p-3 rounded-lg ${
                    isCritical ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'
                  }`}>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} />
                      <span className={`font-medium ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                        {isCritical ? 'Réapprovisionnement urgent !' : 'Prévoir un réapprovisionnement'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredStocks.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun stock trouvé</h3>
          <p className="text-slate-600 mb-6">
            {searchTerm ? 'Aucun résultat pour votre recherche' : 'Commencez par ajouter un stock de carburant'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto shadow-md transition-all"
            >
              <Plus className="w-5 h-5" />
              Ajouter un stock
            </button>
          )}
        </div>
      )}

      {isModalOpen && (
        <FuelStockModal
          stock={selectedStock}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};
