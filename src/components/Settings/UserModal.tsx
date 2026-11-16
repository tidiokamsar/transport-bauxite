import { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Building, Image, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { libelleModule } from './organisation';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSuccess: () => void;
}

interface UserForm {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  department: string;
  photo_url: string;
  status: string;
  site: string;
  /** Perimetre global (tous les sites) : choix explicite et motive (D-079). */
  global: boolean;
  motifGlobal: string;
  motifDroits: string;
}

const FORMULAIRE_VIDE: UserForm = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'driver',
  department: 'Opérations',
  photo_url: '',
  status: 'active',
  site: '',
  global: false,
  motifGlobal: '',
  motifDroits: '',
};

// Roles de l'enum user_role (D-010, D-012) ; les droits de chacun sont
// ceux de la matrice role_permissions, appliques par le serveur (D-021).
const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'director', label: 'Directeur' },
  { value: 'operations_manager', label: 'Responsable des opérations' },
  { value: 'fleet_manager', label: 'Responsable de flotte' },
  { value: 'maintenance_chief', label: 'Chef de maintenance' },
  { value: 'logistician', label: 'Logisticien' },
  { value: 'accountant', label: 'Comptable' },
  { value: 'contract_manager', label: 'Chargé de contrats et facturation' },
  { value: 'driver', label: 'Chauffeur' },
];

const LONGUEUR_MOT_DE_PASSE = 12;

// Droits d'acces aux modules par utilisateur (D-036) : l'attribution
// specifique prime sur la matrice du role, appliquee par le serveur.
interface DroitModule {
  module: string;
  role_lecture: boolean;
  role_ecriture: boolean;
  niveau_attribue: string | null;
}

const libelleNiveauRole = (droit: DroitModule) => {
  if (droit.role_ecriture) return 'Rôle : lecture et écriture';
  if (droit.role_lecture) return 'Rôle : lecture';
  return 'Rôle : aucun accès';
};

/** Appel de la fonction serveur de gestion des comptes (admin seulement). */
const gererCompte = async (corps: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('admin-utilisateurs', { body: corps });
  if (error) {
    let message = 'Opération refusée par le serveur';
    try {
      const detail = await (error as { context?: Response }).context?.json();
      if (detail?.erreur) message = detail.erreur;
    } catch {
      // Reponse sans corps JSON : message generique.
    }
    throw new Error(message);
  }
  return data as { id: string };
};

const DEPARTMENTS = [
  'Direction',
  'Opérations',
  'Maintenance',
  'Comptabilité',
  'Ressources Humaines',
  'Logistique',
  'Sécurité',
];

export const UserModal = ({ isOpen, onClose, userId, onSuccess }: UserModalProps) => {
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [droitsModules, setDroitsModules] = useState<DroitModule[]>([]);
  const [choixDroits, setChoixDroits] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [erreurSites, setErreurSites] = useState('');
  const [siteInitial, setSiteInitial] = useState('');
  const [formData, setFormData] = useState<UserForm>(FORMULAIRE_VIDE);

  useEffect(() => {
    setErreur('');
    if (isOpen && userId) {
      fetchUser();
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    supabase.from('sites').select('id, name, is_active').order('name')
      .then(({ data, error }) => {
        if (error) setErreurSites(`Sites indisponibles : ${error.message}`);
        setSites(((data as { id: string; name: string; is_active: boolean | null }[] | null) ?? [])
          .filter((s) => s.is_active !== false));
      });
  }, []);

  const fetchUser = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      setErreur(`Compte indisponible : ${error.message}`);
      return;
    }
    if (data) {
      setFormData({
        ...FORMULAIRE_VIDE,
        email: data.email || '',
        full_name: data.full_name || '',
        phone: data.phone || '',
        role: data.role || 'driver',
        department: data.department || 'Opérations',
        photo_url: data.photo_url || '',
        status: data.status || 'active',
        site: data.site_id || '',
        global: !data.site_id,
      });
      setSiteInitial(data.site_id || '');
    }

    const { data: droits, error: erreurDroits } = await supabase
      .from('v_droits_modules')
      .select('module, role_lecture, role_ecriture, niveau_attribue')
      .eq('utilisateur', userId)
      .order('module');

    if (erreurDroits) {
      setErreur(`Droits indisponibles : ${erreurDroits.message}`);
      return;
    }
    setDroitsModules((droits as DroitModule[] | null) ?? []);
    const choix: Record<string, string> = {};
    ((droits as DroitModule[] | null) ?? []).forEach((d) => {
      choix[d.module] = d.niveau_attribue ?? 'defaut';
    });
    setChoixDroits(choix);
  };

  const resetForm = () => {
    setFormData(FORMULAIRE_VIDE);
    setSiteInitial('');
    setDroitsModules([]);
    setChoixDroits({});
  };

  // Droits specifiques (D-036) : seuls les modules changes partent.
  const changementsDroits = Object.entries(choixDroits).filter(([module, niveau]) => {
    const droit = droitsModules.find(d => d.module === module);
    return niveau !== (droit?.niveau_attribue ?? 'defaut');
  });
  const perimetreChange = formData.global ? siteInitial !== '' : formData.site !== siteInitial;
  // Perimetre : un site, ou le global explicite et motive (D-079).
  const erreurPerimetre = formData.global
    ? ((!userId || perimetreChange) && !formData.motifGlobal.trim() ? 'Compte global : motif obligatoire.' : '')
    : (!formData.site ? "Site d'affectation obligatoire (ou cocher « compte global » avec un motif)." : '');
  const erreurDroits = changementsDroits.length > 0 && !formData.motifDroits.trim()
    ? 'Motif du changement de droits obligatoire.' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (erreurPerimetre || erreurDroits) {
      setErreur(erreurPerimetre || erreurDroits);
      return;
    }
    setLoading(true);
    setErreur('');

    try {
      if (userId) {
        // Statut et site ne passent pas par cette mise a jour : ils ont
        // leurs fonctions serveur (motif et journal, D-079).
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            department: formData.department,
            photo_url: formData.photo_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (error) throw error;

        if (perimetreChange) {
          const { error: erreurSite } = await supabase.rpc('definir_site_compte', {
            p_utilisateur: userId,
            p_site: formData.global ? null : formData.site,
            p_motif: formData.global ? formData.motifGlobal.trim() : null,
          });
          if (erreurSite) throw erreurSite;
        }

        if (formData.password) {
          await gererCompte({ action: 'mot_de_passe', user_id: userId, password: formData.password });
        }

        const modifications = { ...formData, password: undefined };
        await supabase.rpc('log_user_activity', {
          p_action: 'user_updated',
          p_details: { user_id: userId, changes: modifications, mot_de_passe_change: !!formData.password },
        });

        // Chaque changement de droit part par la fonction serveur qui
        // journalise, avec le motif saisi.
        for (const [module, niveau] of changementsDroits) {
          const { error: erreurDroit } = await supabase.rpc('definir_droit_module', {
            p_utilisateur: userId,
            p_module: module,
            p_niveau: niveau,
            p_motif: formData.motifDroits.trim(),
          });
          if (erreurDroit) throw erreurDroit;
        }
      } else {
        const cree = await gererCompte({
          action: 'creer',
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          department: formData.department,
          site_id: formData.global ? null : formData.site,
          global: formData.global,
          motif_global: formData.global ? formData.motifGlobal.trim() : null,
        });
        await supabase.rpc('log_user_activity', {
          p_action: 'user_created',
          p_details: { user_id: cree.id, email: formData.email, role: formData.role, site_id: formData.global ? null : formData.site },
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message) : 'erreur inconnue';
      setErreur(`Enregistrement refusé : ${message}`);
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <Fenetre
      titre={userId ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
      sousTitre={userId ? 'Mettre à jour les informations' : 'Créer un nouveau compte utilisateur'}
      onFermer={onClose}
      enCours={loading}
      onSubmit={handleSubmit}
      pied={<>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enregistrement...' : userId ? 'Mettre à jour' : 'Créer'}
        </button>
      </>}
    >
        <div className="space-y-6">
          <ErreurFenetre>{erreur}</ErreurFenetre>
          {!userId && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="utilisateur@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mot de passe *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="12 caractères minimum"
                    minLength={LONGUEUR_MOT_DE_PASSE}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères</p>
              </div>
            </>
          )}

          {userId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nouveau mot de passe (facultatif)
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Laisser vide pour ne pas le changer"
                minLength={LONGUEUR_MOT_DE_PASSE}
                autoComplete="new-password"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Nom complet *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Jean Dupont"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+224 XXX XX XX XX"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Rôle *
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="compte-site" className="block text-sm font-medium text-slate-700 mb-2">
                Site d'affectation (D-038){formData.global ? '' : ' *'}
              </label>
              <select
                id="compte-site"
                value={formData.global ? '' : formData.site}
                disabled={formData.global}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
              >
                <option value="">{formData.global ? 'Tous les sites (compte global)' : 'Choisir un site'}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {erreurSites && <p className="mt-1 text-xs text-red-700">{erreurSites}</p>}
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.global}
                  onChange={(e) => setFormData({ ...formData, global: e.target.checked })}
                />
                Compte global (lit tous les sites)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building className="w-4 h-4 inline mr-2" />
                Département *
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.global && (!userId || perimetreChange) && (
            <div>
              <label htmlFor="compte-motif-global" className="block text-sm font-medium text-slate-700 mb-2">
                Motif du périmètre global *
              </label>
              <input
                id="compte-motif-global"
                value={formData.motifGlobal}
                onChange={(e) => setFormData({ ...formData, motifGlobal: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex. direction générale, supervision de tous les sites"
              />
              <p className="text-xs text-slate-500 mt-1">Un compte global lit les données de tous les sites : le choix est journalisé avec ce motif.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Image className="w-4 h-4 inline mr-2" />
              Photo URL
            </label>
            <input
              type="url"
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://exemple.com/photo.jpg"
            />
          </div>

          {userId && (
            <p className="text-sm text-slate-600">
              Statut : <b>{formData.status === 'active' ? 'Actif' : formData.status === 'suspended' ? 'Suspendu' : 'Inactif'}</b>
              {' '}(se change par « Désactiver » ou « Réactiver » dans la liste, avec un motif).
            </p>
          )}

          {userId && droitsModules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Shield className="w-4 h-4 inline mr-2" />
                Droits d'accès aux modules
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Les droits du rôle s'appliquent par défaut ; une attribution spécifique prime sur lui (D-036).
                Chaque changement est journalisé par le serveur avec son motif.
              </p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {droitsModules.map((droit) => (
                  <div key={droit.module} className="flex items-center justify-between px-3 py-2 gap-3">
                    <div>
                      <div className="text-sm text-slate-900">{libelleModule(droit.module)}</div>
                      <div className="text-xs text-slate-500">{libelleNiveauRole(droit)}</div>
                    </div>
                    <select
                      aria-label={`Droits ${libelleModule(droit.module)}`}
                      value={choixDroits[droit.module] ?? 'defaut'}
                      onChange={(e) => setChoixDroits({ ...choixDroits, [droit.module]: e.target.value })}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="defaut">Défaut du rôle</option>
                      <option value="lecture">Lecture</option>
                      <option value="ecriture">Écriture</option>
                      <option value="aucun">Aucun accès</option>
                    </select>
                  </div>
                ))}
              </div>
              {changementsDroits.length > 0 && (
                <div className="mt-2">
                  <label htmlFor="compte-motif-droits" className="block text-sm font-medium text-slate-700 mb-1">
                    Motif du changement de droits *
                  </label>
                  <input
                    id="compte-motif-droits"
                    value={formData.motifDroits}
                    onChange={(e) => setFormData({ ...formData, motifDroits: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex. remplacement pendant un congé"
                  />
                </div>
              )}
            </div>
          )}

        </div>
    </Fenetre>
  );
};
