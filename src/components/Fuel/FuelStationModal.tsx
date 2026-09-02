import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, MapPin, Droplet } from 'lucide-react';

interface FuelStationModalProps {
  station: any;
  onClose: (saved: boolean) => void;
}

export const FuelStationModal = ({ station, onClose }: FuelStationModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    station_type: 'internal',
    location: '',
    latitude: 0,
    longitude: 0,
    capacity_liters: 50000,
    current_stock: 0,
    minimum_stock: 5000,
    has_iot_sensors: false,
    authorized: true,
    supplier_name: '',
    contact_phone: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (station) {
      setFormData({
        name: station.name || '',
        station_type: station.station_type || 'internal',
        location: station.location || '',
        latitude: station.latitude || 0,
        longitude: station.longitude || 0,
        capacity_liters: station.capacity_liters || 50000,
        current_stock: station.current_stock || 0,
        minimum_stock: station.minimum_stock || 5000,
        has_iot_sensors: station.has_iot_sensors || false,
        authorized: station.authorized !== undefined ? station.authorized : true,
        supplier_name: station.supplier_name || '',
        contact_phone: station.contact_phone || '',
        notes: station.notes || ''
      });
    }
  }, [station]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (station?.id) {
        const { error: updateError } = await supabase
          .from('fuel_stations')
          .update(formData)
          .eq('id', station.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('fuel_stations')
          .insert([formData]);

        if (insertError) throw insertError;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">
              {station ? 'Modifier la Station' : 'Nouvelle Station'}
            </h2>
          </div>
          <button
            onClick={() => onClose(false)}
            className="text-white hover:bg-blue-800 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom de la Station *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Station Centrale Conakry"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type de Station *
              </label>
              <select
                required
                value={formData.station_type}
                onChange={(e) => setFormData({ ...formData, station_type: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="internal">Interne</option>
                <option value="external">Externe</option>
                <option value="partner">Partenaire</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Localisation *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Conakry, Port de Kamsar"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="9.641185"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="-13.578401"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Capacité Totale (Litres) *
              </label>
              <input
                type="number"
                required
                value={formData.capacity_liters}
                onChange={(e) => setFormData({ ...formData, capacity_liters: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Stock Actuel (Litres) *
              </label>
              <input
                type="number"
                required
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="25000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Stock Minimum (Litres) *
              </label>
              <input
                type="number"
                required
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fournisseur
              </label>
              <input
                type="text"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nom du fournisseur"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Téléphone Contact
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+224 XXX XXX XXX"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-50 to-teal-100 border border-teal-200 rounded-lg cursor-pointer hover:from-teal-100 hover:to-teal-200 transition-all">
                <input
                  type="checkbox"
                  checked={formData.has_iot_sensors}
                  onChange={(e) => setFormData({ ...formData, has_iot_sensors: e.target.checked })}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-teal-900">Capteurs IoT Installés</span>
                  <p className="text-sm text-teal-700">Station équipée de capteurs de niveau en temps réel</p>
                </div>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg cursor-pointer hover:from-green-100 hover:to-green-200 transition-all">
                <input
                  type="checkbox"
                  checked={formData.authorized}
                  onChange={(e) => setFormData({ ...formData, authorized: e.target.checked })}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <div>
                  <span className="font-semibold text-green-900">Station Autorisée</span>
                  <p className="text-sm text-green-700">Permet les ravitaillements depuis cette station</p>
                </div>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Informations complémentaires..."
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {station ? 'Mettre à jour' : 'Créer la Station'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
