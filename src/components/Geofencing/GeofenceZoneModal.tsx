import React, { useState, useEffect } from 'react';
import { X, Save, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface GeofenceZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  zone?: any;
}

export const GeofenceZoneModal: React.FC<GeofenceZoneModalProps> = ({
  isOpen,
  onClose,
  onSave,
  zone
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    zone_type: 'mine',
    geometry_type: 'circle',
    center_lat: 11.0967,
    center_lng: -13.7761,
    radius_meters: 3000,
    color: '#10B981',
    is_active: true,
    priority: 5,
    alert_on_entry: true,
    alert_on_exit: true,
    alert_on_dwell: false,
    max_dwell_minutes: 60,
    max_speed_kmh: 40
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (zone) {
      setFormData({
        name: zone.name || '',
        description: zone.description || '',
        zone_type: zone.zone_type || 'mine',
        geometry_type: zone.geometry_type || 'circle',
        center_lat: zone.center_lat || 11.0967,
        center_lng: zone.center_lng || -13.7761,
        radius_meters: zone.radius_meters || 3000,
        color: zone.color || '#10B981',
        is_active: zone.is_active ?? true,
        priority: zone.priority || 5,
        alert_on_entry: zone.alert_on_entry ?? true,
        alert_on_exit: zone.alert_on_exit ?? true,
        alert_on_dwell: zone.alert_on_dwell ?? false,
        max_dwell_minutes: zone.max_dwell_minutes || 60,
        max_speed_kmh: zone.max_speed_kmh || 40
      });
    }
  }, [zone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (zone) {
        const { error } = await supabase
          .from('geofence_zones')
          .update(formData)
          .eq('id', zone.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('geofence_zones')
          .insert([formData]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la zone');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const zoneTypeColors: Record<string, string> = {
    mine: '#10B981',
    depot: '#F59E0B',
    route: '#3B82F6',
    restricted: '#EF4444',
    loading: '#3B82F6',
    maintenance: '#6366F1',
    parking: '#8B5CF6',
    customs: '#EC4899'
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full z-[2001]">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {zone ? 'Modifier la zone' : 'Nouvelle zone de géofencing'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la zone *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Mine de Sangarédi - Zone Principale"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Description de la zone..."
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de zone *
                </label>
                <select
                  value={formData.zone_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({
                      ...formData,
                      zone_type: newType,
                      color: zoneTypeColors[newType] || '#10B981'
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mine">Mine</option>
                  <option value="depot">Dépôt</option>
                  <option value="route">Route</option>
                  <option value="restricted">Zone Interdite</option>
                  <option value="loading">Chargement</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="parking">Parking</option>
                  <option value="customs">Douane</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorité
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude centre *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.center_lat}
                  onChange={(e) => setFormData({ ...formData, center_lat: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude centre *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.center_lng}
                  onChange={(e) => setFormData({ ...formData, center_lng: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rayon (mètres) *
                </label>
                <input
                  type="number"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="100"
                  step="100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vitesse max (km/h)
                </label>
                <input
                  type="number"
                  value={formData.max_speed_kmh}
                  onChange={(e) => setFormData({ ...formData, max_speed_kmh: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temps max (minutes)
                </label>
                <input
                  type="number"
                  value={formData.max_dwell_minutes}
                  onChange={(e) => setFormData({ ...formData, max_dwell_minutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Zone active
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.alert_on_entry}
                  onChange={(e) => setFormData({ ...formData, alert_on_entry: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Alerte lors de l'entrée dans la zone
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.alert_on_exit}
                  onChange={(e) => setFormData({ ...formData, alert_on_exit: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Alerte lors de la sortie de la zone
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.alert_on_dwell}
                  onChange={(e) => setFormData({ ...formData, alert_on_dwell: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Alerte si temps de séjour dépassé
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {zone ? 'Mettre à jour' : 'Créer la zone'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};