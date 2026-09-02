import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Wrench, Package, Calendar, AlertTriangle, CheckCircle, Clock, TrendingUp, Download } from 'lucide-react';
import { MaintenanceModal } from './MaintenanceModal';
import { PartsModal } from './PartsModal';
import { ScheduleModal } from './ScheduleModal';

interface WorkOrder {
  id: string;
  work_order_number: string;
  title: string;
  description: string;
  maintenance_type: string;
  priority: string;
  status: string;
  scheduled_date: string;
  completion_date: string | null;
  km_at_maintenance: number;
  labor_hours: number;
  labor_cost: number;
  estimated_cost: number;
  actual_cost: number;
  vehicle: { registration: string; brand_model: string } | null;
  site: { name: string } | null;
}

interface SparePart {
  id: string;
  part_number: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  supplier: string;
}

interface PartInventory {
  id: string;
  part_reference: string;
  description: string;
  quantity_in_stock: number;
  minimum_threshold: number;
  unit_price: number;
  supplier: string;
}

interface MaintenanceSchedule {
  id: string;
  title: string;
  description: string;
  maintenance_type: string;
  frequency_type: string;
  frequency_value: number;
  next_service_date: string | null;
  next_service_km: number | null;
  estimated_cost: number;
  vehicle: { registration: string; brand_model: string } | null;
}

export const MaintenanceView = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [inventory, setInventory] = useState<PartInventory[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'work-orders' | 'parts' | 'schedules'>('work-orders');

  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [isPartsModalOpen, setIsPartsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, catalogRes, inventoryRes, schedulesRes] = await Promise.all([
        supabase
          .from('maintenance_orders')
          .select(`
            *,
            vehicle:vehicles(registration, brand_model),
            site:sites(name)
          `)
          .order('scheduled_date', { ascending: false }),
        supabase
          .from('spare_parts_catalog')
          .select('*')
          .eq('active', true)
          .order('category', { ascending: true }),
        supabase
          .from('parts_inventory')
          .select('*')
          .order('part_reference', { ascending: true }),
        supabase
          .from('maintenance_schedules')
          .select(`
            *,
            vehicle:vehicles(registration, brand_model)
          `)
          .eq('active', true)
          .order('next_service_date', { ascending: true })
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (catalogRes.error) throw catalogRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (schedulesRes.error) throw schedulesRes.error;

      setWorkOrders(ordersRes.data || []);
      setParts(catalogRes.data || []);
      setInventory(inventoryRes.data || []);
      setSchedules(schedulesRes.data || []);
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorkOrder = () => {
    setSelectedItem(null);
    setIsWorkOrderModalOpen(true);
  };

  const handleAddPart = () => {
    setSelectedItem(null);
    setIsPartsModalOpen(true);
  };

  const handleAddSchedule = () => {
    setSelectedItem(null);
    setIsScheduleModalOpen(true);
  };

  const handleEditWorkOrder = (order: WorkOrder) => {
    setSelectedItem(order);
    setIsWorkOrderModalOpen(true);
  };

  const handleEditPart = (part: SparePart | PartInventory) => {
    setSelectedItem(part);
    setIsPartsModalOpen(true);
  };

  const handleEditSchedule = (schedule: MaintenanceSchedule) => {
    setSelectedItem(schedule);
    setIsScheduleModalOpen(true);
  };

  const handleModalClose = (saved: boolean) => {
    setIsWorkOrderModalOpen(false);
    setIsPartsModalOpen(false);
    setIsScheduleModalOpen(false);
    setSelectedItem(null);
    if (saved) {
      fetchData();
    }
  };

  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.vehicle?.registration?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredParts = parts.filter((p) =>
    p.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInventory = inventory.filter((i) =>
    i.part_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalWorkOrders = workOrders.length;
  const openOrders = workOrders.filter(wo => wo.status === 'open').length;
  const inProgressOrders = workOrders.filter(wo => wo.status === 'in_progress').length;
  const completedOrders = workOrders.filter(wo => wo.status === 'completed').length;
  const totalMaintenanceCost = workOrders
    .filter(wo => wo.status === 'completed')
    .reduce((sum, wo) => sum + (wo.actual_cost || wo.estimated_cost || 0), 0);
  const lowStockParts = inventory.filter(i => i.quantity_in_stock <= i.minimum_threshold).length;
  const upcomingServices = schedules.filter(s => {
    if (!s.next_service_date) return false;
    const daysUntil = Math.ceil((new Date(s.next_service_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil >= 0;
  }).length;

  const getStatusColor = (status: string) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      open: 'Ouvert',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return colors[priority as keyof typeof colors] || 'bg-slate-100 text-slate-700';
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
      critical: 'Critique',
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getMaintenanceTypeLabel = (type: string) => {
    const labels = {
      preventive: 'Préventive',
      corrective: 'Corrective',
      predictive: 'Prédictive',
      emergency: 'Urgence',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const exportToCSV = () => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    if (activeTab === 'work-orders') {
      filename = `ordres_maintenance_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Numéro', 'Titre', 'Type', 'Priorité', 'Statut', 'Véhicule', 'Date programmée', 'Coût estimé', 'Coût réel'];
      data = filteredWorkOrders.map(wo => [
        wo.work_order_number,
        wo.title,
        getMaintenanceTypeLabel(wo.maintenance_type),
        getPriorityLabel(wo.priority),
        getStatusLabel(wo.status),
        wo.vehicle?.registration || 'N/A',
        new Date(wo.scheduled_date).toLocaleDateString('fr-FR'),
        wo.estimated_cost.toFixed(0),
        wo.actual_cost?.toFixed(0) || '0'
      ]);
    } else if (activeTab === 'parts') {
      filename = `pieces_detachees_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Référence', 'Description', 'Stock actuel', 'Seuil minimum', 'Prix unitaire', 'Fournisseur'];
      data = filteredInventory.map(inv => [
        inv.part_reference,
        inv.description,
        inv.quantity_in_stock,
        inv.minimum_threshold,
        inv.unit_price.toFixed(0),
        inv.supplier || 'N/A'
      ]);
    } else if (activeTab === 'schedules') {
      filename = `planning_maintenance_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Titre', 'Type', 'Véhicule', 'Fréquence', 'Prochaine date', 'Prochain KM', 'Coût estimé'];
      data = schedules.map(sch => [
        sch.title,
        getMaintenanceTypeLabel(sch.maintenance_type),
        sch.vehicle?.registration || 'N/A',
        `${sch.frequency_value} ${sch.frequency_type}`,
        sch.next_service_date ? new Date(sch.next_service_date).toLocaleDateString('fr-FR') : 'N/A',
        sch.next_service_km || 'N/A',
        sch.estimated_cost.toFixed(0)
      ]);
    }

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
          <h1 className="text-3xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-600 mt-1">Gestion de la maintenance et des pièces détachées</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Exporter CSV
          </button>
          {activeTab === 'work-orders' && (
            <button
              onClick={handleAddWorkOrder}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouvel ordre de travail
            </button>
          )}
          {activeTab === 'parts' && (
            <button
              onClick={handleAddPart}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouvelle pièce
            </button>
          )}
          {activeTab === 'schedules' && (
            <button
              onClick={handleAddSchedule}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau planning
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Ordres ouverts</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{openOrders + inProgressOrders}</p>
            </div>
            <Wrench className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Terminés</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{completedOrders}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Coût total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{(totalMaintenanceCost / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-slate-500 mt-0.5">GNF</p>
            </div>
            <TrendingUp className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Alertes</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{lowStockParts + upcomingServices}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('work-orders')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'work-orders'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Ordres de travail
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'parts'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Pièces détachées
                {lowStockParts > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {lowStockParts}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'schedules'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Planification
                {upcomingServices > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {upcomingServices}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'work-orders' && (
          <>
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par numéro, titre ou véhicule..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="open">Ouverts</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminés</option>
                  <option value="cancelled">Annulés</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      N° Ordre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Titre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Véhicule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Priorité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date prévue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Coût
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        Aucun ordre de travail trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredWorkOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleEditWorkOrder(order)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title="Voir les détails"
                          >
                            {order.work_order_number}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900 font-medium">{order.title}</div>
                          {order.description && (
                            <div className="text-sm text-slate-500 truncate max-w-xs">{order.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{order.vehicle?.registration || '-'}</div>
                          {order.vehicle?.brand_model && (
                            <div className="text-sm text-slate-500">{order.vehicle.brand_model}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">
                            {getMaintenanceTypeLabel(order.maintenance_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(order.priority)}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          {order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {((order.actual_cost || order.estimated_cost || 0) / 1000).toLocaleString()}K GNF
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'parts' && (
          <>
            <div className="p-6 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par référence, nom ou catégorie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredInventory.map((item) => {
                  const isLowStock = item.quantity_in_stock <= item.minimum_threshold;
                  const stockPercentage = (item.quantity_in_stock / (item.minimum_threshold * 2)) * 100;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleEditPart(item)}
                      className="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900">{item.part_reference}</h3>
                          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                        </div>
                        {isLowStock && (
                          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 ml-2" />
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-600">Stock actuel</span>
                            <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                              {item.quantity_in_stock} unités
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${isLowStock ? 'bg-red-600' : 'bg-green-600'}`}
                              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex justify-between text-sm pt-2 border-t border-slate-300">
                          <span className="text-slate-600">Seuil minimum</span>
                          <span className="font-medium text-slate-900">{item.minimum_threshold}</span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Prix unitaire</span>
                          <span className="font-medium text-slate-900">{item.unit_price.toLocaleString()} GNF</span>
                        </div>

                        <div className="pt-2 border-t border-slate-300">
                          <p className="text-xs text-slate-500">Fournisseur: {item.supplier}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'schedules' && (
          <div className="p-6">
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Aucun planning de maintenance configuré
                </div>
              ) : (
                schedules.map((schedule) => {
                  const daysUntilService = schedule.next_service_date
                    ? Math.ceil((new Date(schedule.next_service_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isUpcoming = daysUntilService !== null && daysUntilService <= 30 && daysUntilService >= 0;

                  return (
                    <div
                      key={schedule.id}
                      onClick={() => handleEditSchedule(schedule)}
                      className="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900">{schedule.title}</h3>
                            {isUpcoming && (
                              <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">
                                Bientôt
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-4">{schedule.description}</p>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Véhicule</p>
                              <p className="font-medium text-slate-900">{schedule.vehicle?.registration || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Type</p>
                              <p className="font-medium text-slate-900">
                                {getMaintenanceTypeLabel(schedule.maintenance_type)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Fréquence</p>
                              <p className="font-medium text-slate-900">
                                {schedule.frequency_value.toLocaleString()}{' '}
                                {schedule.frequency_type === 'kilometers' ? 'km' : 'jours'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Prochain service</p>
                              <p className="font-medium text-slate-900">
                                {schedule.next_service_date
                                  ? new Date(schedule.next_service_date).toLocaleDateString('fr-FR')
                                  : schedule.next_service_km
                                  ? `${schedule.next_service_km.toLocaleString()} km`
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Clock className={`w-6 h-6 ${isUpcoming ? 'text-orange-500' : 'text-slate-400'} flex-shrink-0 ml-4`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {isWorkOrderModalOpen && (
        <MaintenanceModal workOrder={selectedItem} onClose={handleModalClose} />
      )}

      {isPartsModalOpen && (
        <PartsModal part={selectedItem} onClose={handleModalClose} />
      )}

      {isScheduleModalOpen && (
        <ScheduleModal schedule={selectedItem} onClose={handleModalClose} />
      )}
    </div>
  );
};
