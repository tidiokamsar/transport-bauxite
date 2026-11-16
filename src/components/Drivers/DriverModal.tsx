import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Archive } from 'lucide-react';
import { InfractionsChauffeur } from './InfractionsChauffeur';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { corpsChauffeur, type SaisieChauffeur } from './chauffeur';

interface Driver {
  id: string;
  name: string;
  employee_id: string;
  phone: string | null;
  email: string | null;
  hire_date: string;
  birth_date: string | null;
  license_number: string;
  license_category: string;
  license_expiry: string;
  health_certificate_expiry: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  contract_type: string;
  base_salary: number;
  status: 'active' | 'suspended' | 'terminated';
  notes: string | null;
  site_id?: string | null;
}

interface DriverModalProps {
  driver: Driver | null;
  onClose: (saved: boolean) => void;
}

export const DriverModal = ({ driver, onClose }: DriverModalProps) => {
  const isEditing = !!driver;
  const { profile } = useAuth();
  const { sites } = useSite();
  // Profil borne : le chauffeur est cree sur son site (RLS D-038) ; seul un
  // profil global peut creer un chauffeur global (D-078).
  const siteProfil = profile?.site_id ?? null;

  const [formData, setFormData] = useState<SaisieChauffeur>({
    name: driver?.name || '',
    employee_id: driver?.employee_id || '',
    phone: driver?.phone || '',
    email: driver?.email || '',
    hire_date: driver?.hire_date || '',
    birth_date: driver?.birth_date || '',
    license_number: driver?.license_number || '',
    license_category: driver?.license_category || 'C',
    license_expiry: driver?.license_expiry || '',
    health_certificate_expiry: driver?.health_certificate_expiry || '',
    address: driver?.address || '',
    emergency_contact_name: driver?.emergency_contact_name || '',
    emergency_contact_phone: driver?.emergency_contact_phone || '',
    contract_type: driver?.contract_type || 'permanent',
    base_salary: driver?.base_salary ?? '',
    status: driver?.status || 'active',
    notes: driver?.notes || '',
    site_id: driver?.site_id ?? siteProfil ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Dates et champs facultatifs vides -> null (D-078) : une chaine vide
    // dans une colonne date faisait refuser toute creation.
    const { corps, erreur } = corpsChauffeur(formData, siteProfil);
    if (!corps) { setError(erreur ?? 'Saisie incomplète'); return; }
    setLoading(true);

    try {
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('drivers')
          .update({ ...corps, updated_at: new Date().toISOString() })
          .eq('id', driver.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('drivers')
          .insert([corps]);

        if (insertError) throw insertError;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    // Un chauffeur n'est pas supprime (DELETE retire, D-042) : son dossier est
    // archive (statut « terminated »), reste lie a ses voyages et se reactive
    // par le statut. Le serveur refuse l'archivage pendant un voyage en cours (D-061).
    if (!isEditing || !confirm('Archiver le dossier de ce chauffeur ? Il restera consultable avec le statut « Archivé » et pourra être réactivé.')) return;

    setLoading(true);
    try {
      const { error: archiveError } = await supabase
        .from('drivers')
        .update({ status: 'terminated', updated_at: new Date().toISOString() })
        .eq('id', driver.id);

      if (archiveError) throw archiveError;
      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'archivage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {isEditing ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Informations personnelles</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ID Employé *
                </label>
                <input
                  type="text"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="DRV-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="+224 XXX XXX XXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="prenom.nom@exemple.gn"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date de naissance
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 mt-4">Contact d'urgence</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom du contact
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone d'urgence
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="+224 XXX XXX XXX"
                />
              </div>

              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 mt-4">Permis de conduire</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Numéro de permis *
                </label>
                <input
                  type="text"
                  required
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="GN-C-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Catégorie *
                </label>
                <select
                  required
                  value={formData.license_category}
                  onChange={(e) => setFormData({ ...formData, license_category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="A">A - Moto</option>
                  <option value="B">B - Voiture</option>
                  <option value="C">C - Poids lourd</option>
                  <option value="D">D - Transport de personnes</option>
                  <option value="E">E - Remorque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date d'expiration du permis *
                </label>
                <input
                  type="date"
                  required
                  value={formData.license_expiry}
                  onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Expiration certificat médical
                </label>
                <input
                  type="date"
                  value={formData.health_certificate_expiry}
                  onChange={(e) => setFormData({ ...formData, health_certificate_expiry: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 mt-4">Informations contractuelles</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date d'embauche *
                </label>
                <input
                  type="date"
                  required
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type de contrat *
                </label>
                <select
                  required
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contrat</option>
                  <option value="temporary">Temporaire</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Salaire de base (GNF)
                </label>
                <input
                  type="number"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Statut *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                  <option value="terminated">Archivé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="chauffeur-site">
                  Site d'affectation
                </label>
                <select
                  id="chauffeur-site"
                  value={siteProfil ?? formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  disabled={Boolean(siteProfil)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  {!siteProfil && <option value="">Aucun (chauffeur global, tous sites)</option>}
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {siteProfil && <p className="mt-1 text-xs text-slate-500">Votre profil est rattaché à ce site : le chauffeur y est enregistré.</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  placeholder="Notes additionnelles..."
                />
              </div>

              {isEditing && driver && <InfractionsChauffeur chauffeurId={driver.id} />}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Archive className="w-5 h-5" />
                  Archiver le dossier
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onClose(false)}
                disabled={loading}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
