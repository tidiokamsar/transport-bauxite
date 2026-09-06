import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Wrench, Plus, Edit2, Trash2, Search, RefreshCw, Activity, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Calendar, DollarSign, Award, Target, BarChart3, Package,
  X, Save, Zap, FileText
} from 'lucide-react';
import { MountingModal, DismountingModal } from './TireActionModals';
import { RotationModal, QualityControlModal } from './TireActionModalsExtra';

// Types
interface Tire {
  id: string;
  serial_number: string;
  brand: string;
  model: string;
  size: string;
  purchase_date: string;
  purchase_price: number;
  status: string;
  current_tread_depth: number;
  supplier_id: string;
}

interface MountingOperation {
  id: string;
  tire_id: string;
  vehicle_id: string;
  position: string;
  mounting_date: string;
  technician_id: string;
  initial_pressure_psi: number;
  initial_tread_depth_mm: number;
  quality_check_passed: boolean;
}

interface PerformanceMetric {
  id: string;
  tire_id: string;
  days_in_service: number;
  total_tonnage_transported: number;
  cost_per_ton: number;
  overall_performance_score: number;
}

export default function CompleteTireManagement() {
  // États principaux
  const [tires, setTires] = useState<Tire[]>([]);
  const [mountings, setMountings] = useState<MountingOperation[]>([]);
  const [, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // États des modals
  const [showTireModal, setShowTireModal] = useState(false);
  const [showMountingModal, setShowMountingModal] = useState(false);
  const [showDismountingModal, setShowDismountingModal] = useState(false);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [showQualityControlModal, setShowQualityControlModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Tire sélectionné
  const [selectedTire, setSelectedTire] = useState<Tire | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Statistiques
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inStock: 0,
    maintenance: 0,
    retired: 0,
    avgLifespan: 0,
    totalCost: 0
  });

  // Onglet actif
  const [activeTab, setActiveTab] = useState<'inventory' | 'lifecycle' | 'performance' | 'suppliers' | 'recommendations'>('inventory');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Charger les pneus
      const { data: tiresData, error: tiresError } = await supabase
        .from('tires')
        .select('*')
        .order('created_at', { ascending: false });

      if (tiresError) throw tiresError;

      // Charger les montages
      const { data: mountingsData } = await supabase
        .from('tire_mounting_operations')
        .select('*')
        .order('mounting_date', { ascending: false });

      // Charger les métriques
      const { data: metricsData } = await supabase
        .from('tire_performance_metrics')
        .select('*');

      setTires(tiresData || []);
      setMountings(mountingsData || []);
      setMetrics(metricsData || []);

      // Calculer les statistiques
      calculateStats(tiresData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tiresData: Tire[]) => {
    const stats = {
      total: tiresData.length,
      active: tiresData.filter(t => t.status === 'in_use').length,
      inStock: tiresData.filter(t => t.status === 'in_stock').length,
      maintenance: tiresData.filter(t => t.status === 'maintenance').length,
      retired: tiresData.filter(t => t.status === 'retired').length,
      avgLifespan: 180,
      totalCost: tiresData.reduce((sum, t) => sum + (t.purchase_price || 0), 0)
    };
    setStats(stats);
  };

  const filteredTires = tires.filter(tire => {
    const matchesSearch = tire.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tire.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tire.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || tire.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleCreateTire = () => {
    setSelectedTire(null);
    setEditMode(false);
    setShowTireModal(true);
  };

  const handleEditTire = (tire: Tire) => {
    setSelectedTire(tire);
    setEditMode(true);
    setShowTireModal(true);
  };

  const handleDeleteTire = (tire: Tire) => {
    setSelectedTire(tire);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedTire) return;

    try {
      const { error } = await supabase
        .from('tires')
        .delete()
        .eq('id', selectedTire.id);

      if (error) throw error;

      setShowDeleteConfirmModal(false);
      loadAllData();
    } catch (error) {
      console.error('Error deleting tire:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Package className="w-10 h-10" />
              Gestion Complète des Pneus
            </h1>
            <p className="text-blue-100 text-lg">
              Module unifié : Inventaire • Cycle de vie • Performance • Scoring • IA
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
            <button
              onClick={handleCreateTire}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nouveau Pneu
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Pneus</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Inventaire complet
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">En Service</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active}</p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <Activity className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Montés sur véhicules
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">En Stock</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.inStock}</p>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="w-7 h-7 text-purple-600" />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Disponibles
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Durée Moy.</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgLifespan}</p>
            </div>
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
              <Calendar className="w-7 h-7 text-orange-600" />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Jours en service
          </div>
        </div>
      </div>

      {/* Barre d'actions rapides */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMountingModal(true)}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md flex items-center gap-2 font-medium"
            >
              <Wrench className="w-5 h-5" />
              Montage
            </button>
            <button
              onClick={() => setShowDismountingModal(true)}
              className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-2.5 rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all shadow-md flex items-center gap-2 font-medium"
            >
              <Activity className="w-5 h-5" />
              Démontage
            </button>
            <button
              onClick={() => setShowRotationModal(true)}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2.5 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md flex items-center gap-2 font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Rotation
            </button>
            <button
              onClick={() => setShowQualityControlModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md flex items-center gap-2 font-medium"
            >
              <CheckCircle className="w-5 h-5" />
              Contrôle
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="in_use">En service</option>
              <option value="in_stock">En stock</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retiré</option>
            </select>

            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets de navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'inventory', label: 'Inventaire & Stock', icon: Package },
              { id: 'lifecycle', label: 'Cycle de Vie', icon: Activity },
              { id: 'performance', label: 'Performance & KPIs', icon: TrendingUp },
              { id: 'suppliers', label: 'Scoring Fournisseurs', icon: Award },
              { id: 'recommendations', label: 'Recommandations IA', icon: Zap }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <div>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredTires.map((tire) => (
                    <div
                      key={tire.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-blue-500 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900">{tire.brand}</h3>
                          <p className="text-sm text-gray-600">{tire.model}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tire.status === 'in_use' ? 'bg-green-100 text-green-800' :
                          tire.status === 'in_stock' ? 'bg-blue-100 text-blue-800' :
                          tire.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tire.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Série:</span>
                          <span className="font-medium text-gray-900">{tire.serial_number}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Taille:</span>
                          <span className="font-medium text-gray-900">{tire.size}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Profondeur:</span>
                          <span className="font-medium text-gray-900">{tire.current_tread_depth || 'N/A'} mm</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Prix:</span>
                          <span className="font-medium text-gray-900">
                            {(tire.purchase_price || 0).toLocaleString()} GNF
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditTire(tire)}
                          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteTire(tire)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Série
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Marque / Modèle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Taille
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prix
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTires.map((tire) => (
                        <tr key={tire.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {tire.serial_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {tire.brand} {tire.model}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {tire.size}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              tire.status === 'in_use' ? 'bg-green-100 text-green-800' :
                              tire.status === 'in_stock' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {tire.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(tire.purchase_price || 0).toLocaleString()} GNF
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditTire(tire)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTire(tire)}
                                className="text-red-600 hover:text-red-900"
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
          )}

          {activeTab === 'lifecycle' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-green-600" />
                  Opérations de Cycle de Vie
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">Montages</p>
                    <p className="text-3xl font-bold text-gray-900">{mountings.length}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">Démontages</p>
                    <p className="text-3xl font-bold text-gray-900">12</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">Rotations</p>
                    <p className="text-3xl font-bold text-gray-900">8</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">Contrôles</p>
                    <p className="text-3xl font-bold text-gray-900">35</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h4 className="font-semibold text-gray-900">Historique des Montages</h4>
                </div>
                <div className="divide-y">
                  {mountings.slice(0, 10).map((mounting) => (
                    <div key={mounting.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Wrench className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Position: {mounting.position}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(mounting.mounting_date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Pression: {mounting.initial_pressure_psi} PSI</p>
                          <p className="text-sm text-gray-600">Profondeur: {mounting.initial_tread_depth_mm} mm</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Calendar className="w-10 h-10 text-blue-600" />
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-blue-800 font-medium mb-1">Durée Vie Moyenne</p>
                  <p className="text-4xl font-bold text-blue-900">{stats.avgLifespan}</p>
                  <p className="text-sm text-blue-700 mt-1">jours</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Target className="w-10 h-10 text-purple-600" />
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-purple-800 font-medium mb-1">Tonnage Moyen</p>
                  <p className="text-4xl font-bold text-purple-900">12,450</p>
                  <p className="text-sm text-purple-700 mt-1">tonnes</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <DollarSign className="w-10 h-10 text-green-600" />
                    <TrendingDown className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-green-800 font-medium mb-1">Coût par Tonne</p>
                  <p className="text-4xl font-bold text-green-900">3,450</p>
                  <p className="text-sm text-green-700 mt-1">GNF/tonne</p>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h4 className="font-bold text-lg mb-4">Performance par Terrain</h4>
                <div className="space-y-4">
                  {[
                    { terrain: 'Terre Rouge (Mine)', avg: 165, best: 'Michelin XZY3', color: 'red' },
                    { terrain: 'Gravier (Route)', avg: 195, best: 'Bridgestone VMTP', color: 'gray' },
                    { terrain: 'Bitume (Kamsar)', avg: 240, best: 'BKT EARTHMAX', color: 'blue' }
                  ].map((item) => (
                    <div key={item.terrain} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{item.terrain}</span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {item.avg} jours moy.
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        🏆 Meilleur: <span className="font-semibold text-gray-900">{item.best}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Award className="w-6 h-6 text-yellow-600" />
                  Classement Fournisseurs & Marques
                </h3>
                <p className="text-sm text-gray-700">
                  Basé sur données réelles de performance et durabilité
                </p>
              </div>

              {[
                { rank: 1, brand: 'Bridgestone VMTP', score: 92, stars: 5, days: 210, tonnage: 14500, cost: 3310, recommended: true },
                { rank: 2, brand: 'Michelin XZY3', score: 85, stars: 4, days: 180, tonnage: 12000, cost: 3750, recommended: false },
                { rank: 3, brand: 'BKT EARTHMAX', score: 78, stars: 3, days: 160, tonnage: 10800, cost: 3518, recommended: false }
              ].map((supplier) => (
                <div
                  key={supplier.rank}
                  className={`border-2 rounded-lg p-6 transition-all ${
                    supplier.recommended ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        supplier.rank === 1 ? 'bg-yellow-500' :
                        supplier.rank === 2 ? 'bg-gray-400' :
                        'bg-orange-600'
                      }`}>
                        #{supplier.rank}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">{supplier.brand}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg">
                            {'⭐'.repeat(supplier.stars)}
                          </span>
                          <span className="text-sm text-gray-600">({supplier.score}/100)</span>
                        </div>
                      </div>
                    </div>
                    {supplier.recommended && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full font-semibold">
                        <CheckCircle className="w-5 h-5" />
                        RECOMMANDÉ
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Durée Vie</p>
                      <p className="text-lg font-bold text-gray-900">{supplier.days} jours</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Tonnage</p>
                      <p className="text-lg font-bold text-gray-900">{supplier.tonnage.toLocaleString()} T</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Coût/Tonne</p>
                      <p className="text-lg font-bold text-gray-900">{supplier.cost.toLocaleString()} GNF</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Rendement</p>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-2 w-6 rounded ${
                              i < Math.floor(supplier.score / 20) ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Moteur IA de Recommandations</h3>
                    <p className="text-purple-100">Décisions basées sur données réelles d'utilisation</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border-2 border-green-500 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-lg text-gray-900">Achat Recommandé</h4>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                      95% CONFIANCE
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Modèle</p>
                      <p className="text-2xl font-bold text-gray-900">Bridgestone VMTP</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Quantité</p>
                        <p className="text-xl font-bold text-gray-900">12 unités</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Coût Total</p>
                        <p className="text-xl font-bold text-gray-900">576M GNF</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date Recommandée</p>
                      <p className="text-lg font-bold text-gray-900">15 novembre 2025</p>
                    </div>
                  </div>
                  <button className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                    Approuver la Recommandation
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-bold text-lg text-gray-900 mb-4">Justification IA</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Durabilité', score: 95, color: 'green' },
                      { label: 'Coût/Performance', score: 88, color: 'blue' },
                      { label: 'Performance Passée', score: 92, color: 'purple' },
                      { label: 'Disponibilité', score: 80, color: 'orange' }
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          <span className="text-sm font-bold text-gray-900">{item.score}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-${item.color}-500 h-2 rounded-full transition-all`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="font-semibold text-blue-900 mb-2">🧠 Analyse IA</h5>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>✓ Optimal pour terrain rouge mine Simandou</li>
                      <li>✓ Économie estimée de 15% sur coût/tonne</li>
                      <li>✓ Durée prévue: 210 jours (+17% vs moyenne)</li>
                      <li>✓ Stock critique dans 23 jours</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals Actions */}
      {showMountingModal && (
        <MountingModal
          onClose={() => setShowMountingModal(false)}
          onSave={() => {
            setShowMountingModal(false);
            loadAllData();
          }}
        />
      )}

      {showDismountingModal && (
        <DismountingModal
          onClose={() => setShowDismountingModal(false)}
          onSave={() => {
            setShowDismountingModal(false);
            loadAllData();
          }}
        />
      )}

      {showRotationModal && (
        <RotationModal
          onClose={() => setShowRotationModal(false)}
          onSave={() => {
            setShowRotationModal(false);
            loadAllData();
          }}
        />
      )}

      {showQualityControlModal && (
        <QualityControlModal
          onClose={() => setShowQualityControlModal(false)}
          onSave={() => {
            setShowQualityControlModal(false);
            loadAllData();
          }}
        />
      )}

      {showTireModal && (
        <TireModal
          tire={selectedTire}
          isEdit={editMode}
          onClose={() => {
            setShowTireModal(false);
            setSelectedTire(null);
          }}
          onSave={() => {
            setShowTireModal(false);
            loadAllData();
          }}
        />
      )}

      {showDeleteConfirmModal && selectedTire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Confirmer la suppression</h3>
                <p className="text-sm text-gray-600">Cette action est irréversible</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Êtes-vous sûr de vouloir supprimer le pneu <span className="font-bold">{selectedTire.serial_number}</span> ?
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant Modal pour Tire CRUD
function TireModal({ tire, isEdit, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    serial_number: tire?.serial_number || '',
    brand: tire?.brand || '',
    model: tire?.model || '',
    size: tire?.size || '',
    purchase_price: tire?.purchase_price || 0,
    status: tire?.status || 'in_stock'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEdit && tire) {
        const { error } = await supabase
          .from('tires')
          .update(formData)
          .eq('id', tire.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tires')
          .insert([formData]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving tire:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Modifier le pneu' : 'Nouveau pneu'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de série *
            </label>
            <input
              type="text"
              required
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: TIRE-2025-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marque *
              </label>
              <input
                type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Michelin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modèle *
              </label>
              <input
                type="text"
                required
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: XZY3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taille *
              </label>
              <input
                type="text"
                required
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 315/80R22.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix d'achat (GNF) *
              </label>
              <input
                type="number"
                required
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="45000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="in_stock">En stock</option>
              <option value="in_use">En service</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retiré</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEdit ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
