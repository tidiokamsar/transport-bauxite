import { useState, useEffect } from 'react';
import { X, Save, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VehicleDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  document?: any;
}

export const VehicleDocumentModal = ({ isOpen, onClose, onSuccess, document }: VehicleDocumentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    document_type: 'insurance',
    document_name: '',
    reference_number: '',
    issue_date: '',
    expiry_date: '',
    provider: '',
    cost: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchVehicles();
      if (document) {
        setFormData({
          vehicle_id: document.vehicle_id || '',
          document_type: document.document_type || 'insurance',
          document_name: document.document_name || '',
          reference_number: document.reference_number || '',
          issue_date: document.issue_date || '',
          expiry_date: document.expiry_date || '',
          provider: document.provider || '',
          cost: document.cost?.toString() || '',
          notes: document.notes || ''
        });
      } else {
        setFormData({
          vehicle_id: '',
          document_type: 'insurance',
          document_name: '',
          reference_number: '',
          issue_date: new Date().toISOString().split('T')[0],
          expiry_date: '',
          provider: '',
          cost: '',
          notes: ''
        });
      }
    }
  }, [isOpen, document]);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration, brand_model')
      .order('registration');

    if (data) setVehicles(data);
  };

  const calculateStatus = (expiryDate: string) => {
    if (!expiryDate) return 'active';

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'pending_renewal';
    return 'active';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const status = calculateStatus(formData.expiry_date);

      const payload = {
        vehicle_id: formData.vehicle_id,
        document_type: formData.document_type,
        document_name: formData.document_name,
        reference_number: formData.reference_number || null,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
        provider: formData.provider || null,
        cost: parseInt(formData.cost) || 0,
        notes: formData.notes || null,
        status
      };

      let error;
      if (document) {
        ({ error } = await supabase
          .from('vehicle_documents')
          .update(payload)
          .eq('id', document.id));
      } else {
        ({ error } = await supabase
          .from('vehicle_documents')
          .insert([payload]));
      }

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {document ? 'Modifier le document' : 'Nouveau document'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Véhicule *
                </label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} - {vehicle.brand_model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type de document *
                </label>
                <select
                  required
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="insurance">Assurance</option>
                  <option value="registration">Carte Grise</option>
                  <option value="technical_inspection">Visite Technique</option>
                  <option value="transport_license">Autorisation Transport</option>
                  <option value="circulation_permit">Permis Circulation</option>
                  <option value="tax_vignette">Vignette</option>
                  <option value="authorization">Autorisation</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom du document *
                </label>
                <input
                  type="text"
                  required
                  value={formData.document_name}
                  onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Assurance Tous Risques 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Numéro de référence
                </label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="ASS-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fournisseur
                </label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="NSIA Assurances"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date d'émission
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date d'expiration *
                </label>
                <input
                  type="date"
                  required
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Coût (GNF)
                </label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="8500000"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Informations complémentaires..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Enregistrer
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
