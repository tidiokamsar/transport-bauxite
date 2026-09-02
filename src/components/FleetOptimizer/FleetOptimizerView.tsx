import { useState, useEffect } from 'react';
import {
  Zap,
  Calendar,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Target,
  Clock,
  Activity,
  Gauge,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Fuel,
  DollarSign,
  Download,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  UserPlus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  FleetTaskModal,
  TaskAssignmentModal,
  ShiftPlanModal,
  OptimizationScenarioModal
} from './FleetOptimizerModals';

interface ShiftPlan {
  id: string;
  plan_number: string;
  shift_date: string;
  shift_type: string;
  shift_start_time: string;
  shift_end_time: string;
  target_production_tonnes: number;
  allocated_vehicles_count: number;
  status: string;
  optimization_score: number;
  total_estimated_cost: number;
  total_estimated_fuel_liters: number;
}

interface FleetTask {
  id: string;
  task_number: string;
  task_type: string;
  status: string;
  target_tonnage: number;
  priority: number;
  distance_km: number;
  estimated_duration_minutes: number;
  origin_site_id: string;
  destination_site_id: string;
  material_type: string;
  planned_start_time: string;
  planned_end_time: string;
  required_vehicle_type: string;
  required_capacity_tonnes: number;
  shift_id: string;
}

interface PerformanceKPI {
  kpi_date: string;
  vehicle_utilization_rate: number;
  total_cycles_completed: number;
  total_tonnage_moved: number;
  average_cycle_time_minutes: number;
  total_fuel_consumed_liters: number;
  fuel_per_tonne: number;
  cost_per_tonne: number;
  idle_time_rate: number;
  optimization_effectiveness_score: number;
}

interface OptimizationScenario {
  id: string;
  scenario_name: string;
  scenario_type: string;
  status: string;
  estimated_production_tonnes: number;
  estimated_total_cost: number;
  estimated_fuel_consumption_liters: number;
  utilization_rate: number;
  production_variance_percent: number;
  cost_variance_percent: number;
  efficiency_score: number;
}

export const FleetOptimizerView = () => {
  const [activeTab, setActiveTab] = useState<'planning' | 'realtime' | 'simulation' | 'kpis'>('planning');
  const [currentShift, setCurrentShift] = useState<ShiftPlan | null>(null);
  const [tasks, setTasks] = useState<FleetTask[]>([]);
  const [kpis, setKPIs] = useState<PerformanceKPI | null>(null);
  const [scenarios, setScenarios] = useState<OptimizationScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FleetTask | undefined>();
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState<string | undefined>();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const { data: shiftData } = await supabase
        .from('shift_plans')
        .select('*')
        .eq('shift_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active')
        .maybeSingle();

      if (shiftData) {
        setCurrentShift(shiftData);

        const { data: tasksData } = await supabase
          .from('fleet_tasks')
          .select('*')
          .eq('shift_id', shiftData.id)
          .order('priority', { ascending: false })
          .limit(50);

        setTasks(tasksData || []);
      }

      const { data: kpiData } = await supabase
        .from('performance_kpis')
        .select('*')
        .eq('kpi_date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      setKPIs(kpiData);

      const { data: scenariosData } = await supabase
        .from('optimization_scenarios')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setScenarios(scenariosData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const runOptimization = async () => {
    setOptimizing(true);
    setTimeout(() => {
      setOptimizing(false);
      fetchData();
    }, 3000);
  };

  const handleEditTask = (task: FleetTask) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      await supabase.from('fleet_tasks').delete().eq('id', taskId);
      fetchData();
    }
  };

  const handleAssignTask = (taskId: string) => {
    setSelectedTaskForAssignment(taskId);
    setShowAssignmentModal(true);
  };

  const handleRunScenario = async (scenarioId: string) => {
    await supabase
      .from('optimization_scenarios')
      .update({
        status: 'running',
        run_at: new Date().toISOString()
      })
      .eq('id', scenarioId);

    setTimeout(async () => {
      const estimatedProduction = 4200 + Math.random() * 800;
      const baseProduction = 4500;
      const productionVariance = ((estimatedProduction - baseProduction) / baseProduction) * 100;

      await supabase
        .from('optimization_scenarios')
        .update({
          status: 'completed',
          completion_time: new Date().toISOString(),
          estimated_production_tonnes: estimatedProduction,
          estimated_total_cycles: Math.floor(estimatedProduction / 35),
          estimated_fuel_consumption_liters: estimatedProduction * 0.75,
          estimated_total_cost: estimatedProduction * 5500,
          utilization_rate: 85 + Math.random() * 10,
          production_variance_percent: productionVariance,
          cost_variance_percent: productionVariance * 1.2,
          efficiency_score: 80 + Math.random() * 15
        })
        .eq('id', scenarioId);

      fetchData();
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'in_progress': case 'completed': return 'text-green-600 bg-green-50';
      case 'assigned': case 'approved': return 'text-blue-600 bg-blue-50';
      case 'pending': case 'draft': return 'text-yellow-600 bg-yellow-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Actif',
      in_progress: 'En cours',
      completed: 'Terminé',
      assigned: 'Affecté',
      approved: 'Approuvé',
      pending: 'En attente',
      draft: 'Brouillon',
      cancelled: 'Annulé',
      running: 'En cours'
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Zap className="w-8 h-8 text-blue-600" />
            FleetOptimiser
          </h1>
          <p className="text-gray-600 mt-1">Optimisation intelligente de flotte minière</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowShiftModal(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Nouveau shift
          </button>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={runOptimization}
            disabled={optimizing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {optimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Optimisation...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Optimiser maintenant
              </>
            )}
          </button>
        </div>
      </div>

      {currentShift && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Shift actuel: {currentShift.plan_number}</h2>
              <p className="text-blue-100">
                {currentShift.shift_type.charAt(0).toUpperCase() + currentShift.shift_type.slice(1)} - {new Date(currentShift.shift_start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(currentShift.shift_end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{currentShift.optimization_score}%</div>
              <div className="text-blue-100">Score d'optimisation</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-blue-500">
            <div>
              <div className="text-2xl font-bold">{currentShift.allocated_vehicles_count}</div>
              <div className="text-blue-100 text-sm">Véhicules alloués</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{currentShift.target_production_tonnes}</div>
              <div className="text-blue-100 text-sm">Cible tonnes</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{(currentShift.total_estimated_fuel_liters || 0).toLocaleString()}</div>
              <div className="text-blue-100 text-sm">Litres carburant</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{((currentShift.total_estimated_cost || 0) / 1000000).toFixed(1)}M</div>
              <div className="text-blue-100 text-sm">GNF coût estimé</div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {[
            { id: 'planning', label: 'Planification', icon: Calendar },
            { id: 'realtime', label: 'Temps Réel', icon: Activity },
            { id: 'simulation', label: 'Simulation What-if', icon: Target },
            { id: 'kpis', label: 'KPIs & Performance', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
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
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'planning' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Tâches planifiées ({tasks.length})</h3>
              <div className="flex gap-3">
                <div className="flex gap-2">
                  {['pending', 'assigned', 'in_progress', 'completed'].map(status => (
                    <div key={status} className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                      {tasks.filter(t => t.status === status).length} {getStatusLabel(status)}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSelectedTask(undefined);
                    setShowTaskModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle tâche
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {tasks.slice(0, 20).map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-500">{task.task_number}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.priority >= 7 ? 'bg-red-100 text-red-700' :
                          task.priority >= 5 ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          Priorité {task.priority}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {task.distance_km} km
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {task.estimated_duration_minutes} min
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {task.target_tonnage} tonnes
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAssignTask(task.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Affecter véhicule"
                      >
                        <UserPlus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEditTask(task)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'realtime' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-600" />
                Vue en temps réel
              </h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 font-medium">En opération</span>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-3xl font-bold text-green-900">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </div>
                  <div className="text-sm text-green-600 mt-1">véhicules actifs</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-700 font-medium">En attente</span>
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="text-3xl font-bold text-yellow-900">
                    {tasks.filter(t => t.status === 'assigned').length}
                  </div>
                  <div className="text-sm text-yellow-600 mt-1">prêts à démarrer</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Complétés</span>
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-3xl font-bold text-blue-900">
                    {tasks.filter(t => t.status === 'completed').length}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">missions terminées</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold mb-4">Alertes et événements</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-900">File d'attente détectée - Zone 1</div>
                    <div className="text-sm text-yellow-700">6 véhicules en attente, temps moyen 18 min</div>
                    <div className="text-xs text-yellow-600 mt-1">Il y a 20 minutes</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">Panne véhicule GN-015-1015</div>
                    <div className="text-sm text-red-700">Moteur surchauffe détectée - 3 tâches réaffectées</div>
                    <div className="text-xs text-red-600 mt-1">Il y a 45 minutes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Scénarios d'optimisation What-if</h3>
              <button
                onClick={() => setShowScenarioModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouveau scénario
              </button>
            </div>
            <div className="grid gap-4">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{scenario.scenario_name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(scenario.status)}`}>
                        {getStatusLabel(scenario.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{scenario.efficiency_score?.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">Score efficacité</div>
                      </div>
                      {scenario.status === 'pending' && (
                        <button
                          onClick={() => handleRunScenario(scenario.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                          <Activity className="w-4 h-4" />
                          Lancer
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Production</div>
                      <div className="font-semibold">{scenario.estimated_production_tonnes?.toLocaleString()} t</div>
                      {scenario.production_variance_percent !== null && scenario.production_variance_percent !== undefined && (
                        <div className={`text-xs ${scenario.production_variance_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {scenario.production_variance_percent > 0 ? '+' : ''}{scenario.production_variance_percent.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Coût total</div>
                      <div className="font-semibold">{((scenario.estimated_total_cost || 0) / 1000000).toFixed(1)}M GNF</div>
                      {scenario.cost_variance_percent !== null && scenario.cost_variance_percent !== undefined && (
                        <div className={`text-xs ${scenario.cost_variance_percent <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {scenario.cost_variance_percent > 0 ? '+' : ''}{scenario.cost_variance_percent.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Carburant</div>
                      <div className="font-semibold">{scenario.estimated_fuel_consumption_liters?.toLocaleString()} L</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Utilisation</div>
                      <div className="font-semibold">{scenario.utilization_rate?.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'kpis' && kpis && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Utilisation flotte</span>
                  <Gauge className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{kpis.vehicle_utilization_rate.toFixed(1)}%</div>
                <div className="text-sm text-gray-500 mt-1">Taux d'utilisation véhicules</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Cycles complétés</span>
                  <RotateCcw className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{kpis.total_cycles_completed}</div>
                <div className="text-sm text-gray-500 mt-1">{kpis.average_cycle_time_minutes.toFixed(1)} min moyen</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Production</span>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{kpis.total_tonnage_moved.toLocaleString()}</div>
                <div className="text-sm text-gray-500 mt-1">tonnes déplacées</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Efficacité carburant</span>
                  <Fuel className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{kpis.fuel_per_tonne.toFixed(2)}</div>
                <div className="text-sm text-gray-500 mt-1">L/tonne</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Coûts opérationnels
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Coût par tonne</span>
                    <span className="font-semibold">{kpis.cost_per_tonne.toLocaleString()} GNF</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Carburant par tonne</span>
                    <span className="font-semibold">{(kpis.fuel_per_tonne * 13500).toLocaleString()} GNF</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  Performance globale
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Temps improductif</span>
                    <span className="font-semibold">{kpis.idle_time_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Score optimisation</span>
                    <span className="font-semibold text-blue-600">{kpis.optimization_effectiveness_score.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <FleetTaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(undefined);
        }}
        onSave={fetchData}
        task={selectedTask}
        shiftId={currentShift?.id}
      />

      <TaskAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false);
          setSelectedTaskForAssignment(undefined);
        }}
        onSave={fetchData}
        taskId={selectedTaskForAssignment}
      />

      <ShiftPlanModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onSave={fetchData}
      />

      <OptimizationScenarioModal
        isOpen={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
        onSave={fetchData}
      />
    </div>
  );
};
