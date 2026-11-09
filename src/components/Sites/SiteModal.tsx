import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, MapPin, Save, Building2, Phone, Mail, Users, Package } from 'lucide-react';

interface SiteModalProps {
  site: any | null;
  onClose: () => void;
  onSave: () => void;
}

export const SiteModal = ({ site, onClose, onSave }: SiteModalProps) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: site?.name || '',
    type: site?.type || 'depot',
    address: site?.address || '',
    city: site?.city || '',
    country: site?.country || 'Guinée',
    latitude: site?.latitude || null,
    longitude: site?.longitude || null,
    contact_name: site?.contact_name || '',
    contact_phone: site?.contact_phone || '',
    contact_email: site?.contact_email || '',
    capacity: site?.capacity || 0,
    current_stock: site?.current_stock || 0,
    is_active: site?.is_active !== undefined ? site.is_active : true,
    manager_id: site?.manager_id || '',
    notes: site?.notes || ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, name, position')
      .eq('status', 'active')
      .order('name');
    setEmployees(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const siteData = {
        ...formData,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        capacity: parseFloat(formData.capacity.toString()) || null,
        current_stock: parseFloat(formData.current_stock.toString()) || null,
        manager_id: formData.manager_id || null,
        location: formData.address
      };

      if (site) {
        const { error } = await supabase
          .from('sites')
          .update(siteData)
          .eq('id', site.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sites')
          .insert([siteData]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving site:', error);
      alert('Erreur lors de l\'enregistrement du site');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-2";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden">
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 px-6 py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {site ? 'Modifier le site' : 'Nouveau site'}
              </h2>
              <p className="text-sm text-orange-100 mt-0.5">
                {site ? 'Mettre à jour les informations du site' : 'Ajouter un nouveau site au réseau'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[calc(92vh-90px)]">
          {/* Informations principales */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Informations principales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={labelClass}>Nom du site *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Dépôt Carburant Sangarédi"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Type de site *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="mine">Mine</option>
                  <option value="port">Port</option>
                  <option value="depot">Dépôt / Entrepôt</option>
                  <option value="workshop">Atelier de maintenance</option>
                  <option value="base">Base opérationnelle</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Statut</label>
                <select
                  value={formData.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                  className={inputClass}
                >
                  <option value="active">✓ Actif</option>
                  <option value="inactive">✗ Inactif</option>
                </select>
              </div>
            </div>
          </div>

          {/* Localisation */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Localisation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={labelClass}>Adresse complète *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Zone Industrielle Mine - Secteur B"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Ville *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Sangarédi"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Pays *</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Latitude GPS</label>
                <input
                  type="number"
                  value={formData.latitude || ''}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || null })}
                  className={inputClass}
                  step="0.000001"
                  placeholder="Ex: 11.1322"
                />
              </div>

              <div>
                <label className={labelClass}>Longitude GPS</label>
                <input
                  type="number"
                  value={formData.longitude || ''}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || null })}
                  className={inputClass}
                  step="0.000001"
                  placeholder="Ex: -13.7456"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Informations de contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Nom du contact
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Mamadou Sylla"
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className={inputClass}
                  placeholder="+224 620 00 00 00"
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className={inputClass}
                  placeholder="contact@exemple.gn"
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Users className="w-4 h-4 inline mr-1" />
                  Responsable du site
                </label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Aucun responsable</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} - {employee.position}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Capacité */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Capacité et stock
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Capacité maximale</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseFloat(e.target.value) })}
                  className={inputClass}
                  min="0"
                  placeholder="Ex: 100000 (litres ou unités)"
                />
              </div>

              <div>
                <label className={labelClass}>Stock actuel</label>
                <input
                  type="number"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) })}
                  className={inputClass}
                  min="0"
                  placeholder="Ex: 75000"
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Notes et informations complémentaires</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={inputClass}
                  rows={3}
                  placeholder="Informations supplémentaires, horaires d'ouverture, équipements spécifiques..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-all"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  {site ? 'Mettre à jour' : 'Créer le site'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
