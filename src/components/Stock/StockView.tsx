import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Package, AlertTriangle, TrendingDown, RefreshCw,
  Edit, Eye, ArrowUpCircle, ArrowDownCircle, History
} from 'lucide-react';
import { StockItemModal } from './StockItemModal';
import { StockEntryModal } from './StockEntryModal';
import { StockMovementModal } from './StockMovementModal';

interface StockItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category_id: string;
  warehouse_location: string;
  unit: string;
  quantity: number | string;
  min_quantity: number | string;
  unit_price: number;
  status: string;
  category?: { name: string } | null;
}

export const StockView = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<StockItem | undefined>();
  const [showItemModal, setShowItemModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [entryType, setEntryType] = useState<'entry' | 'exit'>('entry');

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_items')
        .select(`
          *,
          category:stock_categories(name)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuantity = (item: StockItem) => {
    return typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
  };

  const getMinQuantity = (item: StockItem) => {
    return typeof item.min_quantity === 'string' ? parseFloat(item.min_quantity) : item.min_quantity;
  };

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const qty = getQuantity(item);
    const minQty = getMinQuantity(item);

    if (stockFilter === 'low') {
      return matchesSearch && qty <= minQty && qty > 0;
    } else if (stockFilter === 'out') {
      return matchesSearch && qty === 0;
    }

    return matchesSearch;
  });

  const totalValue = items.reduce((sum, item) => {
    const qty = getQuantity(item);
    return sum + (qty * item.unit_price);
  }, 0);

  const lowStockItems = items.filter(item => {
    const qty = getQuantity(item);
    const minQty = getMinQuantity(item);
    return qty <= minQty && qty > 0;
  }).length;

  const outOfStockItems = items.filter(item => getQuantity(item) === 0).length;

  const getStockStatus = (item: StockItem) => {
    const qty = getQuantity(item);
    const minQty = getMinQuantity(item);

    if (qty === 0) return { label: 'Rupture', color: 'bg-red-100 text-red-800' };
    if (qty <= minQty) return { label: 'Stock faible', color: 'bg-orange-100 text-orange-800' };
    return { label: 'Normal', color: 'bg-green-100 text-green-800' };
  };

  const handleEntry = (item: StockItem) => {
    setSelectedItem(item);
    setEntryType('entry');
    setShowEntryModal(true);
  };

  const handleExit = (item: StockItem) => {
    setSelectedItem(item);
    setEntryType('exit');
    setShowEntryModal(true);
  };

  const handleHistory = (item: StockItem) => {
    setSelectedItem(item);
    setShowMovementModal(true);
  };

  const handleEdit = (item: StockItem) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

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
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Stocks</h1>
          <p className="text-slate-600 mt-1">Inventaire des pièces et consommables</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStock}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setSelectedItem(undefined);
              setEntryType('entry');
              setShowEntryModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowUpCircle className="w-5 h-5" />
            Entrée stock
          </button>
          <button
            onClick={() => {
              setSelectedItem(undefined);
              setShowItemModal(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouvel article
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total articles</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{items.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Valeur totale</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(totalValue / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-slate-500 mt-0.5">GNF</p>
            </div>
            <Package className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Stock faible</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{lowStockItems}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En rupture</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{outOfStockItems}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par code ou nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les articles</option>
              <option value="low">Stock faible</option>
              <option value="out">En rupture</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Article</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entrepôt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">En stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Seuil min</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Prix unitaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valeur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    Aucun article trouvé
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const status = getStockStatus(item);
                  const qty = getQuantity(item);
                  const minQty = getMinQuantity(item);
                  const totalValue = qty * item.unit_price;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{item.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-slate-500">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {item.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {item.warehouse_location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {qty.toLocaleString()} {item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {minQty.toLocaleString()} {item.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {((item.unit_price || 0) / 1000).toFixed(0)}K
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-green-600">
                          {(totalValue / 1000000).toFixed(2)}M
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEntry(item)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Entrée"
                          >
                            <ArrowUpCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleExit(item)}
                            className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Sortie"
                          >
                            <ArrowDownCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleHistory(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Historique"
                          >
                            <History className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(lowStockItems > 0 || outOfStockItems > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Alertes de réapprovisionnement
          </h3>
          <div className="space-y-3">
            {outOfStockItems > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Rupture de stock</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {outOfStockItems} article(s) en rupture - Commande urgente requise
                  </p>
                </div>
              </div>
            )}
            {lowStockItems > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <TrendingDown className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Stock faible</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {lowStockItems} article(s) sous le seuil minimum
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <StockItemModal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setSelectedItem(undefined);
        }}
        onSuccess={() => {
          fetchStock();
          setShowItemModal(false);
          setSelectedItem(undefined);
        }}
        item={selectedItem}
      />

      <StockEntryModal
        isOpen={showEntryModal}
        onClose={() => {
          setShowEntryModal(false);
          setSelectedItem(undefined);
        }}
        onSuccess={() => {
          fetchStock();
          setShowEntryModal(false);
          setSelectedItem(undefined);
        }}
        item={selectedItem}
        type={entryType}
      />

      <StockMovementModal
        isOpen={showMovementModal}
        onClose={() => {
          setShowMovementModal(false);
          setSelectedItem(undefined);
        }}
        item={selectedItem}
      />
    </div>
  );
};
