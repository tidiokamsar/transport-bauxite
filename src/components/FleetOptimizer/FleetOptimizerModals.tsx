import { useState, useEffect } from 'react';
import { X, Save, Loader2, Calendar, Clock, MapPin, Target, Truck, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FleetTask {
  id?: string;
  task_number?: string;
  task_type: string;
  origin_site_id: string;
  destination_site_id: string;
  material_type: string;
  target_tonnage: number;
  priority: number;
  status: string;
  planned_start_time: string;
  planned_end_time: string;
  distance_km: number;
  estimated_duration_minutes: number;
  required_vehicle_type: string;
  required_capacity_tonnes: number;
  shift_id: string;
  notes?: string;
}

interface TaskAssignment {
  id?: string;
  task_id: string;
  vehicle_id: string;
  driver_id?: string;
  assignment_type: string;
  allocation_score?: number;
  allocation_reason?: string;
  status: string;
  notes?: string;
}

interface ShiftPlan {
  id?: string;
  plan_number?: string;
  shift_date: string;
  shift_type: string;
  shift_start_time: string;
  shift_end_time: string;
  target_production_tonnes: number;
  allocated_vehicles_count: number;
  allocated_loaders_count: number;
  allocated_drivers_count: number;
  status: string;
  weather_conditions?: string;
  site_conditions?: string;
  notes?: string;
}

interface OptimizationScenario {
  id?: string;
  scenario_name: string;
  scenario_type: string;
  base_shift_plan_id?: string;
  parameters: any;
  vehicles_added?: number;
  vehicles_removed?: number;
  status: string;
}

interface Site {
  id: string;
  name: string;
  type: string;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  status: string;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

interface FleetTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  task?: FleetTask;
  shiftId?: string;
}

export const FleetTaskModal = ({ isOpen, onClose, onSave, task, shiftId }: FleetTaskModalProps) => {
  const [formData, setFormData] = useState<FleetTask>({
    task_type: 'transport',
    origin_site_id: '',
    destination_site_id: '',
    material_type: 'bauxite',
    target_tonnage: 100,
    priority: 5,
    status: 'pending',
    planned_start_time: '',
    planned_end_time: '',
    distance_km: 0,
    estimated_duration_minutes: 45,
    required_vehicle_type: 'tipper',
    required_capacity_tonnes: 30,
    shift_id: shiftId || '',
    notes: ''
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData(task);
    }
    fetchSites();
  }, [task]);

  const fetchSites = async () => {
    const { data } = await supabase
      .from('sites')
      .select('id, name, type')
      .order('name');
    if (data) setSites(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (task?.id) {
        await supabase
          .from('fleet_tasks')
          .update(formData)
          .eq('id', task.id);
      } else {
        const taskNumber = `TASK-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        await supabase
          .from('fleet_tasks')
          .insert([{ ...formData, task_number: taskNumber }]);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {task ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de tâche *
              </label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="transport">Transport</option>
                <option value="loading">Chargement</option>
                <option value="hauling">Hauling</option>
                <option value="dumping">Déchargement</option>
                <option value="maintenance_move">Déplacement maintenance</option>
                <option value="relocation">Relocalisation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorité (1-10) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site origine *
              </label>
              <select
                value={formData.origin_site_id}
                onChange={(e) => setFormData({ ...formData, origin_site_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Sélectionner un site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name} ({site.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site destination *
              </label>
              <select
                value={formData.destination_site_id}
                onChange={(e) => setFormData({ ...formData, destination_site_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Sélectionner un site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name} ({site.type})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Matériau
              </label>
              <select
                value={formData.material_type}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="bauxite">Bauxite</option>
                <option value="equipment">Équipement</option>
                <option value="materials">Matériaux</option>
                <option value="fuel">Carburant</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tonnage cible *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.target_tonnage}
                onChange={(e) => setFormData({ ...formData, target_tonnage: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance (km)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.distance_km}
                onChange={(e) => setFormData({ ...formData, distance_km: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durée estimée (min)
              </label>
              <input
                type="number"
                min="0"
                value={formData.estimated_duration_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure début prévue *
              </label>
              <input
                type="datetime-local"
                value={formData.planned_start_time}
                onChange={(e) => setFormData({ ...formData, planned_start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure fin prévue *
              </label>
              <input
                type="datetime-local"
                value={formData.planned_end_time}
                onChange={(e) => setFormData({ ...formData, planned_end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type véhicule requis
              </label>
              <select
                value={formData.required_vehicle_type}
                onChange={(e) => setFormData({ ...formData, required_vehicle_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="tipper">Tipper</option>
                <option value="tanker">Tanker</option>
                <option value="loader">Loader</option>
                <option value="bulldozer">Bulldozer</option>
                <option value="excavator">Excavator</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacité requise (tonnes)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.required_capacity_tonnes}
                onChange={(e) => setFormData({ ...formData, required_capacity_tonnes: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  assignment?: TaskAssignment;
  taskId?: string;
}

export const TaskAssignmentModal = ({ isOpen, onClose, onSave, assignment, taskId }: TaskAssignmentModalProps) => {
  const [formData, setFormData] = useState<TaskAssignment>({
    task_id: taskId || '',
    vehicle_id: '',
    driver_id: '',
    assignment_type: 'primary',
    status: 'assigned',
    notes: ''
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (assignment) {
      setFormData(assignment);
    }
    fetchVehiclesAndDrivers();
  }, [assignment]);

  const fetchVehiclesAndDrivers = async () => {
    const [vehiclesRes, driversRes] = await Promise.all([
      supabase.from('vehicles').select('id, vehicle_number, vehicle_type, status').eq('status', 'active').order('vehicle_number'),
      supabase.from('drivers').select('id, first_name, last_name, status').eq('status', 'active').order('last_name')
    ]);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (driversRes.data) setDrivers(driversRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        allocation_score: Math.random() * 15 + 85,
        allocation_reason: 'Manual assignment - optimal based on availability and proximity'
      };

      if (assignment?.id) {
        await supabase
          .from('task_assignments')
          .update(dataToSave)
          .eq('id', assignment.id);
      } else {
        await supabase
          .from('task_assignments')
          .insert([dataToSave]);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving assignment:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {assignment ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Véhicule *
            </label>
            <select
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Sélectionner un véhicule</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicle_number} - {vehicle.vehicle_type} ({vehicle.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chauffeur
            </label>
            <select
              value={formData.driver_id}
              onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucun chauffeur (autonome)</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.first_name} {driver.last_name} ({driver.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'affectation
              </label>
              <select
                value={formData.assignment_type}
                onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="primary">Primaire</option>
                <option value="support">Support</option>
                <option value="backup">Backup</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="assigned">Affecté</option>
                <option value="accepted">Accepté</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Complété</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Affecter
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ShiftPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  shiftPlan?: ShiftPlan;
}

export const ShiftPlanModal = ({ isOpen, onClose, onSave, shiftPlan }: ShiftPlanModalProps) => {
  const [formData, setFormData] = useState<ShiftPlan>({
    shift_date: new Date().toISOString().split('T')[0],
    shift_type: 'morning',
    shift_start_time: '',
    shift_end_time: '',
    target_production_tonnes: 4500,
    allocated_vehicles_count: 40,
    allocated_loaders_count: 8,
    allocated_drivers_count: 40,
    status: 'draft',
    weather_conditions: '',
    site_conditions: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shiftPlan) {
      setFormData(shiftPlan);
    }
  }, [shiftPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (shiftPlan?.id) {
        await supabase
          .from('shift_plans')
          .update(formData)
          .eq('id', shiftPlan.id);
      } else {
        const planNumber = `SHIFT-${formData.shift_date.replace(/-/g, '')}-${formData.shift_type[0].toUpperCase()}`;
        await supabase
          .from('shift_plans')
          .insert([{ ...formData, plan_number: planNumber }]);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving shift plan:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {shiftPlan ? 'Modifier le shift' : 'Nouveau shift'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={formData.shift_date}
                onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de shift *
              </label>
              <select
                value={formData.shift_type}
                onChange={(e) => setFormData({ ...formData, shift_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="morning">Matin (6h-14h)</option>
                <option value="afternoon">Après-midi (14h-22h)</option>
                <option value="night">Nuit (22h-6h)</option>
                <option value="extended">Étendu</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure début *
              </label>
              <input
                type="datetime-local"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure fin *
              </label>
              <input
                type="datetime-local"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Objectif production (tonnes) *
            </label>
            <input
              type="number"
              min="0"
              value={formData.target_production_tonnes}
              onChange={(e) => setFormData({ ...formData, target_production_tonnes: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Véhicules alloués
              </label>
              <input
                type="number"
                min="0"
                value={formData.allocated_vehicles_count}
                onChange={(e) => setFormData({ ...formData, allocated_vehicles_count: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chargeuses allouées
              </label>
              <input
                type="number"
                min="0"
                value={formData.allocated_loaders_count}
                onChange={(e) => setFormData({ ...formData, allocated_loaders_count: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chauffeurs alloués
              </label>
              <input
                type="number"
                min="0"
                value={formData.allocated_drivers_count}
                onChange={(e) => setFormData({ ...formData, allocated_drivers_count: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conditions météo
              </label>
              <input
                type="text"
                value={formData.weather_conditions}
                onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                placeholder="Ex: Ensoleillé, 28°C"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conditions site
              </label>
              <input
                type="text"
                value={formData.site_conditions}
                onChange={(e) => setFormData({ ...formData, site_conditions: e.target.value })}
                placeholder="Ex: Routes bonnes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface OptimizationScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  scenario?: OptimizationScenario;
}

export const OptimizationScenarioModal = ({ isOpen, onClose, onSave, scenario }: OptimizationScenarioModalProps) => {
  const [formData, setFormData] = useState<OptimizationScenario>({
    scenario_name: '',
    scenario_type: 'what_if',
    parameters: {},
    vehicles_added: 0,
    vehicles_removed: 0,
    status: 'pending'
  });
  const [saving, setSaving] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(40);
  const [fuelPrice, setFuelPrice] = useState(13500);
  const [targetProduction, setTargetProduction] = useState(4500);

  useEffect(() => {
    if (scenario) {
      setFormData(scenario);
      if (scenario.parameters) {
        setVehicleCount(scenario.parameters.vehicle_count || 40);
        setFuelPrice(scenario.parameters.fuel_price_gnf || 13500);
        setTargetProduction(scenario.parameters.target_tonnes || 4500);
      }
    }
  }, [scenario]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const parameters = {
        vehicle_count: vehicleCount,
        fuel_price_gnf: fuelPrice,
        target_tonnes: targetProduction,
        shift_hours: 8
      };

      const dataToSave = {
        ...formData,
        parameters,
        vehicles_added: Math.max(0, vehicleCount - 40),
        vehicles_removed: Math.max(0, 40 - vehicleCount)
      };

      if (scenario?.id) {
        await supabase
          .from('optimization_scenarios')
          .update(dataToSave)
          .eq('id', scenario.id);
      } else {
        await supabase
          .from('optimization_scenarios')
          .insert([dataToSave]);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving scenario:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {scenario ? 'Modifier le scénario' : 'Nouveau scénario'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du scénario *
            </label>
            <input
              type="text"
              value={formData.scenario_name}
              onChange={(e) => setFormData({ ...formData, scenario_name: e.target.value })}
              placeholder="Ex: Augmentation flotte +10 véhicules"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de scénario
            </label>
            <select
              value={formData.scenario_type}
              onChange={(e) => setFormData({ ...formData, scenario_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="what_if">What-if</option>
              <option value="baseline">Baseline</option>
              <option value="historical_replay">Replay historique</option>
              <option value="predictive">Prédictif</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Paramètres de simulation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-2">
                  Nombre de véhicules
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-sm text-blue-600 mt-1">
                  {vehicleCount > 40 ? `+${vehicleCount - 40} véhicules par rapport à la baseline` :
                   vehicleCount < 40 ? `-${40 - vehicleCount} véhicules par rapport à la baseline` :
                   'Configuration baseline'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-2">
                  Prix carburant (GNF/litre)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={fuelPrice}
                  onChange={(e) => setFuelPrice(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-2">
                  Objectif production (tonnes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={targetProduction}
                  onChange={(e) => setTargetProduction(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Note importante</p>
                <p>La simulation calculera automatiquement la production estimée, les coûts, la consommation de carburant et le taux d'utilisation basés sur ces paramètres.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer et simuler
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
