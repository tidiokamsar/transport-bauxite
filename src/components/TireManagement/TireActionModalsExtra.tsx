import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Save, Repeat, CheckCircle, Camera, AlertTriangle, Gauge, RefreshCw
} from 'lucide-react';

// Modal de Rotation/Permutation
export function RotationModal({ onClose, onSave }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [tirePositions, setTirePositions] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    rotation_date: new Date().toISOString().split('T')[0],
    reason: 'scheduled',
    rotations: [] as any[],
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'active');
    setVehicles(data || []);
  };

  const loadTirePositions = async (vehicleId: string) => {
    const { data } = await supabase
      .from('tire_mounting_operations')
      .select(`
        *,
        tires (*)
      `)
      .eq('vehicle_id', vehicleId)
      .is('dismounting_date', null);

    setTirePositions(data || []);
    setSelectedVehicle(vehicleId);
    setFormData({ ...formData, vehicle_id: vehicleId });
  };

  const handleRotation = (fromPos: string, toPos: string) => {
    const existing = formData.rotations.find(r => r.from_position === fromPos);
    if (existing) {
      setFormData({
        ...formData,
        rotations: formData.rotations.map(r =>
          r.from_position === fromPos ? { ...r, to_position: toPos } : r
        )
      });
    } else {
      setFormData({
        ...formData,
        rotations: [...formData.rotations, { from_position: fromPos, to_position: toPos }]
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Créer l'opération de rotation
      const { error } = await supabase
        .from('tire_rotations')
        .insert([{
          vehicle_id: formData.vehicle_id,
          rotation_date: formData.rotation_date,
          reason: formData.reason,
          rotations: formData.rotations,
          notes: formData.notes
        }]);

      if (error) throw error;

      onSave();
    } catch (error) {
      console.error('Error rotating tires:', error);
      alert('Erreur lors de la rotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Repeat className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Rotation des Pneus</h2>
              <p className="text-sm text-gray-600">Permutation pour usure uniforme</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Véhicule *
            </label>
            <select
              required
              onChange={(e) => loadTirePositions(e.target.value)}
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

          {selectedVehicle && tirePositions.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Positions Actuelles</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tirePositions.map(pos => (
                  <div key={pos.id} className="bg-white rounded-lg p-4 border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        {pos.position.replace(/_/g, ' ')}
                      </span>
                      <Gauge className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {pos.tires?.serial_number}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {pos.tires?.brand} {pos.tires?.model}
                    </p>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">Déplacer vers:</label>
                      <select
                        onChange={(e) => handleRotation(pos.position, e.target.value)}
                        className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">-- Garder --</option>
                        <option value="front_left">Avant Gauche</option>
                        <option value="front_right">Avant Droit</option>
                        <option value="rear_left_outer">Arr. Gauche Ext.</option>
                        <option value="rear_left_inner">Arr. Gauche Int.</option>
                        <option value="rear_right_outer">Arr. Droit Ext.</option>
                        <option value="rear_right_inner">Arr. Droit Int.</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de rotation *
              </label>
              <input
                type="date"
                required
                value={formData.rotation_date}
                onChange={(e) => setFormData({ ...formData, rotation_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison *
              </label>
              <select
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="scheduled">Rotation programmée</option>
                <option value="uneven_wear">Usure inégale</option>
                <option value="preventive">Préventif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Observations sur la rotation..."
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
              disabled={saving || formData.rotations.length === 0}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Confirmer Rotation ({formData.rotations.length})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Contrôle Qualité
export function QualityControlModal({ onClose, onSave }: any) {
  const [tires, setTires] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tire_id: '',
    control_date: new Date().toISOString().split('T')[0],
    control_type: 'periodic',
    pressure_psi: 120,
    tread_depth_mm: 12,
    temperature_celsius: 35,
    visual_inspection_passed: true,
    defects_found: [] as string[],
    severity: 'none',
    action_required: '',
    photos: [],
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTires();
  }, []);

  const loadTires = async () => {
    const { data } = await supabase
      .from('tires')
      .select('*')
      .in('status', ['in_use', 'in_stock']);
    setTires(data || []);
  };

  const toggleDefect = (defect: string) => {
    if (formData.defects_found.includes(defect)) {
      setFormData({
        ...formData,
        defects_found: formData.defects_found.filter(d => d !== defect)
      });
    } else {
      setFormData({
        ...formData,
        defects_found: [...formData.defects_found, defect]
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('tire_quality_controls')
        .insert([formData]);

      if (error) throw error;

      // Mettre à jour la profondeur actuelle du pneu
      await supabase
        .from('tires')
        .update({ current_tread_depth: formData.tread_depth_mm })
        .eq('id', formData.tire_id);

      onSave();
    } catch (error) {
      console.error('Error saving quality control:', error);
      alert('Erreur lors du contrôle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Contrôle Qualité Pneu</h2>
              <p className="text-sm text-gray-600">Inspection et mesures de sécurité</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pneu à contrôler *
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
                  {tire.serial_number} - {tire.brand} {tire.model} ({tire.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du contrôle *
              </label>
              <input
                type="date"
                required
                value={formData.control_date}
                onChange={(e) => setFormData({ ...formData, control_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de contrôle *
              </label>
              <select
                required
                value={formData.control_type}
                onChange={(e) => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="mounting">Après montage</option>
                <option value="periodic">Périodique</option>
                <option value="incident">Suite à incident</option>
                <option value="pre_trip">Avant voyage</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">📏 Mesures</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pression (PSI) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.pressure_psi}
                  onChange={(e) => setFormData({ ...formData, pressure_psi: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profondeur (mm) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.tread_depth_mm}
                  onChange={(e) => setFormData({ ...formData, tread_depth_mm: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="30"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Température (°C)
                </label>
                <input
                  type="number"
                  value={formData.temperature_celsius}
                  onChange={(e) => setFormData({ ...formData, temperature_celsius: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="-20"
                  max="100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Défauts détectés
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Coupure',
                'Hernie',
                'Usure irrégulière',
                'Déformation',
                'Corps étranger',
                'Fissures',
                'Surcharge',
                'Sous-gonflage'
              ].map(defect => (
                <label key={defect} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.defects_found.includes(defect)}
                    onChange={() => toggleDefect(defect)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{defect}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sévérité *
              </label>
              <select
                required
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">Aucun problème</option>
                <option value="minor">Mineur</option>
                <option value="moderate">Modéré</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action requise
              </label>
              <select
                value={formData.action_required}
                onChange={(e) => setFormData({ ...formData, action_required: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucune</option>
                <option value="monitor">Surveiller</option>
                <option value="regonflage">Regonflage</option>
                <option value="reparation">Réparation</option>
                <option value="remplacement">Remplacement urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.visual_inspection_passed}
                onChange={(e) => setFormData({ ...formData, visual_inspection_passed: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Inspection visuelle réussie
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes et observations
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Détails supplémentaires..."
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">📸 Photos</span>
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Camera className="w-4 h-4" />
                Ajouter Photo
              </button>
            </div>
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
                  Enregistrer Contrôle
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
