import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Save, Wrench, Activity, QrCode, RefreshCw
} from 'lucide-react';

// Modal de Montage
export function MountingModal({ onClose, onSave }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [tires, setTires] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tire_id: '',
    vehicle_id: '',
    position: '',
    mounting_date: new Date().toISOString().split('T')[0],
    technician_id: '',
    initial_pressure_psi: 120,
    initial_tread_depth_mm: 18,
    quality_check_passed: true,
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [vehiclesRes, tiresRes, employeesRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('status', 'active'),
      supabase.from('tires').select('*').eq('status', 'in_stock'),
      supabase.from('employees').select('*').eq('status', 'active')
    ]);

    setVehicles(vehiclesRes.data || []);
    setTires(tiresRes.data || []);
    setEmployees(employeesRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Créer l'opération de montage
      const { error: mountingError } = await supabase
        .from('tire_mounting_operations')
        .insert([formData]);

      if (mountingError) throw mountingError;

      // Mettre à jour le statut du pneu
      const { error: tireError } = await supabase
        .from('tires')
        .update({ status: 'in_use' })
        .eq('id', formData.tire_id);

      if (tireError) throw tireError;

      onSave();
    } catch (error) {
      console.error('Error mounting tire:', error);
      alert('Erreur lors du montage du pneu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Wrench className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Montage de Pneu</h2>
              <p className="text-sm text-gray-600">Installer un pneu sur un véhicule</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Scan QR/RFID Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Scan QR Code / RFID</h3>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📷 Scanner QR Code
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                📡 Lire RFID
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pneu à monter *
              </label>
              <select
                required
                value={formData.tire_id}
                onChange={(e) => setFormData({ ...formData, tire_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un pneu</option>
                {tires.map(tire => (
                  <option key={tire.id} value={tire.id}>
                    {tire.serial_number} - {tire.brand} {tire.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Véhicule *
              </label>
              <select
                required
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un véhicule</option>
                {vehicles.map(vehicle => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position sur le véhicule *
              </label>
              <select
                required
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
                <option value="front_left">Avant Gauche</option>
                <option value="front_right">Avant Droit</option>
                <option value="rear_left_outer">Arrière Gauche Ext.</option>
                <option value="rear_left_inner">Arrière Gauche Int.</option>
                <option value="rear_right_outer">Arrière Droit Ext.</option>
                <option value="rear_right_inner">Arrière Droit Int.</option>
                <option value="spare">Roue de secours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de montage *
              </label>
              <input
                type="date"
                required
                value={formData.mounting_date}
                onChange={(e) => setFormData({ ...formData, mounting_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pression initiale (PSI) *
              </label>
              <input
                type="number"
                required
                value={formData.initial_pressure_psi}
                onChange={(e) => setFormData({ ...formData, initial_pressure_psi: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="80"
                max="150"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profondeur initiale (mm) *
              </label>
              <input
                type="number"
                required
                value={formData.initial_tread_depth_mm}
                onChange={(e) => setFormData({ ...formData, initial_tread_depth_mm: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="25"
                step="0.1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Technicien *
            </label>
            <select
              required
              value={formData.technician_id}
              onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un technicien</option>
              {employees.filter(e => e.job_title?.includes('Technicien') || e.job_title?.includes('Mécanicien')).map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} - {emp.job_title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.quality_check_passed}
                onChange={(e) => setFormData({ ...formData, quality_check_passed: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Contrôle qualité effectué et validé
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Remarques sur le montage..."
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Confirmer le Montage
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Démontage
export function DismountingModal({ onClose, onSave }: any) {
  const [mountedTires, setMountedTires] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tire_id: '',
    dismounting_date: new Date().toISOString().split('T')[0],
    final_tread_depth_mm: 8,
    reason: '',
    can_be_retreaded: false,
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [tireStats, setTireStats] = useState<any>(null);

  useEffect(() => {
    loadMountedTires();
  }, []);

  const loadMountedTires = async () => {
    const { data } = await supabase
      .from('tire_mounting_operations')
      .select(`
        *,
        tires (*)
      `)
      .is('dismounting_date', null);

    setMountedTires(data || []);
  };

  const handleTireSelect = async (mountingId: string) => {
    const mounting = mountedTires.find(m => m.id === mountingId);
    if (!mounting) return;

    setFormData({ ...formData, tire_id: mounting.tire_id });

    // Calculer les statistiques
    const daysMounted = Math.floor(
      (new Date().getTime() - new Date(mounting.mounting_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Récupérer les voyages effectués avec ce pneu
    const { data: trips } = await supabase
      .from('trips')
      .select('net_weight')
      .eq('vehicle_id', mounting.vehicle_id)
      .gte('planned_date', mounting.mounting_date)
      .lte('planned_date', new Date().toISOString());

    const totalTonnage = trips?.reduce((sum, t) => sum + (t.net_weight || 0), 0) || 0;

    setTireStats({
      days_mounted: daysMounted,
      total_tonnage: Math.round(totalTonnage / 1000),
      wear_rate: mounting.initial_tread_depth_mm - formData.final_tread_depth_mm
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Créer l'opération de démontage
      const { error: dismountError } = await supabase
        .from('tire_dismounting_operations')
        .insert([{
          ...formData,
          days_in_service: tireStats?.days_mounted || 0,
          total_tonnage: tireStats?.total_tonnage || 0
        }]);

      if (dismountError) throw dismountError;

      // Mettre à jour le statut du pneu
      const newStatus = formData.can_be_retreaded ? 'maintenance' : 'retired';
      const { error: tireError } = await supabase
        .from('tires')
        .update({
          status: newStatus,
          current_tread_depth: formData.final_tread_depth_mm
        })
        .eq('id', formData.tire_id);

      if (tireError) throw tireError;

      onSave();
    } catch (error) {
      console.error('Error dismounting tire:', error);
      alert('Erreur lors du démontage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Démontage de Pneu</h2>
              <p className="text-sm text-gray-600">Retirer un pneu du véhicule avec calculs automatiques</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pneu à démonter *
            </label>
            <select
              required
              onChange={(e) => handleTireSelect(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un pneu monté</option>
              {mountedTires.map(mounting => (
                <option key={mounting.id} value={mounting.id}>
                  {mounting.tires?.serial_number} - Position: {mounting.position} - Monté le {new Date(mounting.mounting_date).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          {tireStats && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">📊 Statistiques Automatiques</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Jours en Service</p>
                  <p className="text-2xl font-bold text-blue-900">{tireStats.days_mounted}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Tonnage Transporté</p>
                  <p className="text-2xl font-bold text-blue-900">{tireStats.total_tonnage}</p>
                  <p className="text-xs text-gray-600">tonnes</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Usure</p>
                  <p className="text-2xl font-bold text-blue-900">{tireStats.wear_rate.toFixed(1)}</p>
                  <p className="text-xs text-gray-600">mm perdus</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de démontage *
              </label>
              <input
                type="date"
                required
                value={formData.dismounting_date}
                onChange={(e) => setFormData({ ...formData, dismounting_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profondeur finale (mm) *
              </label>
              <input
                type="number"
                required
                value={formData.final_tread_depth_mm}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setFormData({ ...formData, final_tread_depth_mm: value });
                  if (tireStats) {
                    setTireStats({
                      ...tireStats,
                      wear_rate: tireStats.initial_depth - value
                    });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="25"
                step="0.1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raison du démontage *
            </label>
            <select
              required
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner</option>
              <option value="scheduled">Fin de vie programmée</option>
              <option value="wear_limit">Usure limite atteinte</option>
              <option value="damage">Dommage / Crevaison</option>
              <option value="rotation">Rotation préventive</option>
              <option value="retreading">Envoi au rechapage</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.can_be_retreaded}
                onChange={(e) => setFormData({ ...formData, can_be_retreaded: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Peut être rechapé (profondeur ≥ 5mm)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="État général, observations..."
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
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
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Confirmer le Démontage
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Rotation (suite dans le prochain message - fichier trop long)
