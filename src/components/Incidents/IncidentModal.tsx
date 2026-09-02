import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, AlertTriangle, Save } from 'lucide-react';
import { buttonStyles, inputStyles, labelStyles } from '../../styles/theme';

interface IncidentModalProps {
  incident: any | null;
  onClose: () => void;
  onSave: () => void;
}

export const IncidentModal = ({ incident, onClose, onSave }: IncidentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    vehicle_id: incident?.vehicle_id || '',
    driver_id: incident?.driver_id || '',
    incident_type: incident?.incident_type || 'accident',
    severity: incident?.severity || 'medium',
    date_time: incident?.date_time ? new Date(incident.date_time).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    location: incident?.location || '',
    latitude: incident?.latitude || null,
    longitude: incident?.longitude || null,
    description: incident?.description || '',
    damage_cost: incident?.damage_cost || 0,
    injured_count: incident?.injured_count || 0,
    status: incident?.status || 'open',
    insurance_claim_number: incident?.insurance_claim_number || ''
  });

  useEffect(() => {
    fetchVehicles();
    fetchDrivers();
  }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration')
      .order('registration');
    setVehicles(data || []);
  };

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    setDrivers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const incidentData = {
        ...formData,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        damage_cost: parseFloat(formData.damage_cost.toString()) || 0,
        injured_count: parseInt(formData.injured_count.toString()) || 0
      };

      if (incident) {
        const { error } = await supabase
          .from('incidents')
          .update(incidentData)
          .eq('id', incident.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('incidents')
          .insert([incidentData]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving incident:', error);
      alert('Erreur lors de l\'enregistrement de l\'incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {incident ? 'Modifier l\'incident' : 'Déclarer un incident'}
              </h2>
              <p className="text-sm text-gray-600">
                {incident ? 'Mettre à jour les informations' : 'Enregistrer un nouveau incident'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelStyles}>Véhicule *</label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className={inputStyles}
                required
              >
                <option value="">Sélectionner un véhicule</option>
                {vehicles.map(vehicle => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelStyles}>Chauffeur</label>
              <select
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                className={inputStyles}
              >
                <option value="">Aucun</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelStyles}>Type d'incident *</label>
              <select
                value={formData.incident_type}
                onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                className={inputStyles}
                required
              >
                <option value="accident">Accident</option>
                <option value="breakdown">Panne</option>
                <option value="theft">Vol</option>
                <option value="vandalism">Vandalisme</option>
                <option value="damage">Dommage</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className={labelStyles}>Gravité *</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className={inputStyles}
                required
              >
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            <div>
              <label className={labelStyles}>Date et heure *</label>
              <input
                type="datetime-local"
                value={formData.date_time}
                onChange={(e) => setFormData({ ...formData, date_time: e.target.value })}
                className={inputStyles}
                required
              />
            </div>

            <div>
              <label className={labelStyles}>Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className={inputStyles}
              >
                <option value="open">Ouvert</option>
                <option value="investigating">En cours d'investigation</option>
                <option value="resolved">Résolu</option>
                <option value="closed">Fermé</option>
              </select>
            </div>

            <div>
              <label className={labelStyles}>Coût des dommages (GNF)</label>
              <input
                type="number"
                value={formData.damage_cost}
                onChange={(e) => setFormData({ ...formData, damage_cost: parseFloat(e.target.value) })}
                className={inputStyles}
                min="0"
                step="1000"
              />
            </div>

            <div>
              <label className={labelStyles}>Nombre de blessés</label>
              <input
                type="number"
                value={formData.injured_count}
                onChange={(e) => setFormData({ ...formData, injured_count: parseInt(e.target.value) })}
                className={inputStyles}
                min="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelStyles}>Lieu *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={inputStyles}
                placeholder="Ex: Route Conakry-Kindia, Km 45"
                required
              />
            </div>

            <div>
              <label className={labelStyles}>Latitude</label>
              <input
                type="number"
                value={formData.latitude || ''}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || null })}
                className={inputStyles}
                step="0.000001"
                placeholder="Ex: 9.6412"
              />
            </div>

            <div>
              <label className={labelStyles}>Longitude</label>
              <input
                type="number"
                value={formData.longitude || ''}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || null })}
                className={inputStyles}
                step="0.000001"
                placeholder="Ex: -13.5784"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelStyles}>Numéro de réclamation assurance</label>
              <input
                type="text"
                value={formData.insurance_claim_number}
                onChange={(e) => setFormData({ ...formData, insurance_claim_number: e.target.value })}
                className={inputStyles}
                placeholder="Ex: CLM-2024-00123"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelStyles}>Description détaillée *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputStyles}
                rows={4}
                placeholder="Décrire les circonstances de l'incident, les dommages, les témoins, etc."
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className={buttonStyles.secondary}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={buttonStyles.primary}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  {incident ? 'Mettre à jour' : 'Enregistrer'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
