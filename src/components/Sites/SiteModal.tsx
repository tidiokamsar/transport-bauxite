import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, MapPin, Save, Building2, Phone, Mail, Users, Package } from 'lucide-react';
import { enNombre, enTexte, verifierCapacite, verifierCoordonnees } from './saisieSite';

/** Colonnes du referentiel des sites saisies dans ce formulaire (D-079). */
export interface SiteSaisi {
  id: string;
  name: string;
  type: string;
  organisation_id?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  capacity?: number | null;
  is_active?: boolean | null;
  responsable_id?: string | null;
  notes?: string | null;
}

interface SiteModalProps {
  site: SiteSaisi | null;
  onClose: () => void;
  onSave: () => void;
}

interface Compte { id: string; full_name: string | null; role: string }

export const SiteModal = ({ site, onClose, onSave }: SiteModalProps) => {
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [erreurComptes, setErreurComptes] = useState('');
  const [organisations, setOrganisations] = useState<{ id: string; raison_sociale: string }[]>([]);
  // Tous les champs edites sont charges depuis la ligne : une modification
  // ne remet jamais a vide un champ qui n'a pas ete touche (D-079).
  const [formData, setFormData] = useState({
    name: site?.name ?? '',
    type: site?.type ?? 'depot',
    organisation_id: site?.organisation_id ?? '',
    address: site?.address ?? '',
    city: site?.city ?? '',
    country: site?.country ?? 'Guinée',
    latitude: enTexte(site?.latitude),
    longitude: enTexte(site?.longitude),
    contact_name: site?.contact_name ?? '',
    contact_phone: site?.contact_phone ?? '',
    contact_email: site?.contact_email ?? '',
    capacity: enTexte(site?.capacity),
    is_active: site?.is_active ?? true,
    responsable_id: site?.responsable_id ?? '',
    notes: site?.notes ?? '',
  });

  useEffect(() => {
    // Responsable : un compte actif du perimetre (fonction serveur, reservee
    // a qui ecrit le referentiel des sites).
    supabase.rpc('comptes_selectionnables').then(({ data, error }) => {
      if (error) setErreurComptes(`Liste des comptes indisponible : ${error.message}`);
      setComptes((data as Compte[] | null) ?? []);
    });
    // Referentiel des organisations (D-038) : rattache le site a son organisation.
    supabase.from('organisations').select('id, raison_sociale').order('raison_sociale')
      .then(({ data, error }) => {
        if (error) setErreur(`Organisations indisponibles : ${error.message}`);
        setOrganisations((data as { id: string; raison_sociale: string }[] | null) ?? []);
      });
  }, []);

  const erreurCoordonnees = verifierCoordonnees(formData.latitude, formData.longitude);
  const erreurCapacite = verifierCapacite(formData.capacity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (erreurCoordonnees || erreurCapacite) {
      setErreur(erreurCoordonnees || erreurCapacite);
      return;
    }
    setLoading(true);
    setErreur('');

    // Seules les colonnes saisies partent ; le stock du site n'est jamais
    // envoye (solde non saisissable, D-077).
    const siteData = {
      name: formData.name.trim(),
      type: formData.type,
      organisation_id: formData.organisation_id || null,
      address: formData.address.trim(),
      city: formData.city.trim(),
      country: formData.country.trim(),
      latitude: enNombre(formData.latitude),
      longitude: enNombre(formData.longitude),
      contact_name: formData.contact_name.trim() || null,
      contact_phone: formData.contact_phone.trim() || null,
      contact_email: formData.contact_email.trim() || null,
      capacity: enNombre(formData.capacity),
      is_active: formData.is_active,
      responsable_id: formData.responsable_id || null,
      notes: formData.notes.trim() || null,
      location: formData.address.trim(),
    };

    const { error } = site
      ? await supabase.from('sites').update(siteData).eq('id', site.id)
      : await supabase.from('sites').insert([siteData]);
    setLoading(false);
    if (error) {
      setErreur(`Enregistrement refusé par le serveur : ${error.message}`);
      return;
    }
    onSave();
  };

  const inputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-2";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div role="dialog" aria-label={site ? 'Modifier le site' : 'Nouveau site'} className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden">
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
            aria-label="Fermer"
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
                <label htmlFor="site-nom" className={labelClass}>Nom du site *</label>
                <input
                  id="site-nom"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Dépôt Carburant Sangarédi"
                  required
                />
              </div>

              <div>
                <label htmlFor="site-type" className={labelClass}>Type de site *</label>
                <select
                  id="site-type"
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
                <label htmlFor="site-statut" className={labelClass}>Statut</label>
                <select
                  id="site-statut"
                  value={formData.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                  className={inputClass}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              <div>
                <label htmlFor="site-organisation" className={labelClass}>Organisation (D-038)</label>
                <select
                  id="site-organisation"
                  value={formData.organisation_id}
                  onChange={(e) => setFormData({ ...formData, organisation_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">À rattacher (aucune)</option>
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>{o.raison_sociale}</option>
                  ))}
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
                <label htmlFor="site-adresse" className={labelClass}>Adresse complète *</label>
                <input
                  id="site-adresse"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Zone Industrielle Mine - Secteur B"
                  required
                />
              </div>

              <div>
                <label htmlFor="site-ville" className={labelClass}>Ville *</label>
                <input
                  id="site-ville"
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Sangarédi"
                  required
                />
              </div>

              <div>
                <label htmlFor="site-pays" className={labelClass}>Pays *</label>
                <input
                  id="site-pays"
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="site-latitude" className={labelClass}>Latitude (facultative)</label>
                <input
                  id="site-latitude"
                  inputMode="decimal"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className={inputClass}
                  placeholder="Degrés décimaux, ex. 7.65"
                />
              </div>

              <div>
                <label htmlFor="site-longitude" className={labelClass}>Longitude (facultative)</label>
                <input
                  id="site-longitude"
                  inputMode="decimal"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className={inputClass}
                  placeholder="Degrés décimaux, ex. -8.40"
                />
              </div>
              {erreurCoordonnees && (
                <p className="md:col-span-2 text-sm text-red-700">{erreurCoordonnees}</p>
              )}
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
                <label htmlFor="site-contact" className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Nom du contact
                </label>
                <input
                  id="site-contact"
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Mamadou Sylla"
                />
              </div>

              <div>
                <label htmlFor="site-telephone" className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Téléphone
                </label>
                <input
                  id="site-telephone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className={inputClass}
                  placeholder="+224 620 00 00 00"
                />
              </div>

              <div>
                <label htmlFor="site-email" className={labelClass}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  id="site-email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className={inputClass}
                  placeholder="contact@exemple.gn"
                />
              </div>

              <div>
                <label htmlFor="site-responsable" className={labelClass}>
                  <Users className="w-4 h-4 inline mr-1" />
                  Responsable du site (compte actif)
                </label>
                <select
                  id="site-responsable"
                  value={formData.responsable_id}
                  onChange={(e) => setFormData({ ...formData, responsable_id: e.target.value })}
                  className={inputClass}
                  disabled={!!erreurComptes}
                >
                  <option value="">Aucun responsable</option>
                  {comptes.map((compte) => (
                    <option key={compte.id} value={compte.id}>
                      {compte.full_name || 'Nom non défini'} ({compte.role})
                    </option>
                  ))}
                </select>
                {erreurComptes && <p className="mt-1 text-xs text-red-700">{erreurComptes}</p>}
              </div>
            </div>
          </div>

          {/* Capacite */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Capacité
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="site-capacite" className={labelClass}>Capacité de stockage (tonnes)</label>
                <input
                  id="site-capacite"
                  inputMode="decimal"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className={inputClass}
                  placeholder="Vide si inconnue"
                />
                {erreurCapacite && <p className="mt-1 text-xs text-red-700">{erreurCapacite}</p>}
              </div>

              <p className="text-sm text-gray-600">
                Le stock d'un site ne se saisit pas : un solde se calcule à partir des mouvements,
                et aucune source calculée n'existe encore pour le stock d'un site.
              </p>

              <div className="md:col-span-2">
                <label htmlFor="site-notes" className={labelClass}>Notes et informations complémentaires</label>
                <textarea
                  id="site-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={inputClass}
                  rows={3}
                  placeholder="Informations supplémentaires, horaires d'ouverture, équipements spécifiques..."
                />
              </div>
            </div>
          </div>

          {erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

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
