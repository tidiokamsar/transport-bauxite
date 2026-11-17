import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, HelpCircle, Inbox, Languages, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { DeconnexionDialog } from './DeconnexionDialog';
import { libelleShiftCourant, type EtatPoste } from '../Dispatch/controle';

// Barre superieure, maquette du proprietaire (2026-11-09). Date, shift et
// nombre d'alertes actives (table alerts) sont lus en base ; sans donnee, la
// puce l'indique au lieu d'inventer. D-087 : un shift n'est « en cours » que
// si une instance (postes) est ouverte ou en cours ; sinon la puce dit la
// plage horaire configuree, « non ouvert », ou « hors plage horaire ». Une
// lecture impossible n'est plus confondue avec « aucun shift defini ».

const LIBELLES_ROLE: Record<string, string> = {
  admin: 'Administrateur',
  director: 'Directeur',
  operations_manager: 'Responsable des opérations',
  fleet_manager: 'Responsable de flotte',
  maintenance_chief: 'Chef de maintenance',
  logistician: 'Logisticien',
  accountant: 'Comptable',
  contract_manager: 'Chargé de contrats et facturation',
  driver: 'Chauffeur',
};

interface Shift {
  id: string;
  name: string;
  display_name: string | null;
  start_time: string;
  end_time: string;
}

const minutes = (hhmmss: string) => {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
};

const jourLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const TopBar = ({
  sousTitre,
  onAllerA,
}: {
  sousTitre: string;
  onAllerA: (vue: string) => void;
}) => {
  const { profile, user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [shifts, setShifts] = useState<Shift[] | null>([]);
  const [instance, setInstance] = useState<{ etat: EtatPoste; shift_id: string } | null>(null);
  const [alertes, setAlertes] = useState<number | null>(null);
  const [aTraiter, setATraiter] = useState<number | null>(null);
  const [menu, setMenu] = useState<'aide' | 'profil' | null>(null);
  const [deconnexion, setDeconnexion] = useState(false);
  const zoneMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const minuterie = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => window.clearInterval(minuterie);
  }, []);

  useEffect(() => {
    if (!user) return;
    let actif = true;
    supabase
      .from('work_shifts')
      .select('id, name, display_name, start_time, end_time')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (actif) setShifts(error ? null : (data ?? []) as Shift[]);
      });
    // Instance ouverte ou en cours du jour (perimetre du profil, RLS).
    supabase
      .from('postes')
      .select('statut, shift_id')
      .eq('date_poste', jourLocal(new Date()))
      .in('statut', ['en_cours', 'ouvert'])
      .limit(1)
      .then(({ data, error }) => {
        const p = !error && Array.isArray(data) ? (data[0] as { statut: EtatPoste; shift_id: string } | undefined) : undefined;
        if (actif) setInstance(p ? { etat: p.statut, shift_id: p.shift_id } : null);
      });
    // Les alertes sont calculees par le serveur a la lecture (D-068) :
    // actualisation (sans effet si recente), puis comptage des actives.
    const lireAlertes = () =>
      supabase.rpc('actualiser_alertes').then(() => supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'acknowledged'])
        .then(({ count, error }) => {
          if (actif) setAlertes(error ? null : count ?? 0);
        }));
    // Elements en attente de decision (D-056), calcules par le serveur.
    const lireValidations = () =>
      supabase.rpc('mes_validations').then(({ data, error }) => {
        if (actif) setATraiter(error || !Array.isArray(data) ? null : data.length);
      });
    lireAlertes();
    lireValidations();
    const minuterie = window.setInterval(() => { lireAlertes(); lireValidations(); }, 60_000);
    return () => {
      actif = false;
      window.clearInterval(minuterie);
    };
  }, [user]);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (zoneMenu.current && !zoneMenu.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  const prenom = profile?.full_name?.trim().split(/\s+/)[0] || 'à vous';
  const shiftInstance = instance && shifts ? shifts.find((s) => s.id === instance.shift_id) : undefined;
  const puce = libelleShiftCourant(
    shifts ? shifts.map((s) => ({ ...s, display_name: s.display_name || s.name })) : null,
    instance && shiftInstance ? { etat: instance.etat, libelle: shiftInstance.display_name || shiftInstance.name } : null,
    maintenant,
  );
  const reference = shiftInstance ?? null;
  const jour = reference ? minutes(reference.start_time) < minutes(reference.end_time) : maintenant.getHours() >= 6 && maintenant.getHours() < 18;
  const IconeShift = jour ? Sun : Moon;
  const date = maintenant.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header className="relative z-30 flex flex-shrink-0 items-center justify-between gap-4 border-b border-stone-200/70 bg-white/80 px-8 py-4 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-stone-900">Bonjour, {prenom}</h1>
        <p className="truncate text-stone-500">{sousTitre}</p>
      </div>

      <div ref={zoneMenu} className="relative flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-stone-800 shadow-sm lg:flex">
          <CalendarDays className="h-5 w-5 text-stone-500" />
          <span className="capitalize">{date}</span>
        </span>

        <span className="hidden items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-1.5 shadow-sm xl:flex">
          <IconeShift className={`h-6 w-6 ${puce.actif ? 'text-orange-400' : 'text-stone-300'}`} />
          {shifts && shifts.length > 0 ? (
            <button type="button" onClick={() => onAllerA('dispatch')} className="text-left leading-tight" title="Le shift n'est en cours que s'il est ouvert (Dispatch, onglet Shift)">
              <span className="block font-semibold text-stone-900">{puce.titre}</span>
              <span className="block text-sm text-stone-500">{puce.detail}</span>
            </button>
          ) : (
            <button type="button" onClick={() => onAllerA('shifts')} className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800">{puce.titre}</button>
          )}
        </span>

        <button
          onClick={() => onAllerA('mes-validations')}
          className="relative rounded-xl p-2.5 text-stone-700 transition hover:bg-stone-100"
          aria-label={aTraiter ? `${aTraiter} validations en attente` : 'Validations en attente'}
          title={aTraiter === null ? 'Validations indisponibles' : `${aTraiter} élément(s) à traiter`}
        >
          <Inbox className="h-6 w-6" />
          {!!aTraiter && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {aTraiter > 99 ? '99+' : aTraiter}
            </span>
          )}
        </button>

        <button
          onClick={() => onAllerA('alerts')}
          className="relative rounded-xl p-2.5 text-stone-700 transition hover:bg-stone-100"
          aria-label={alertes ? `${alertes} alertes actives` : 'Alertes'}
          title={alertes === null ? 'Alertes indisponibles' : `${alertes} alerte(s) active(s)`}
        >
          <Bell className="h-6 w-6" />
          {!!alertes && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {alertes > 99 ? '99+' : alertes}
            </span>
          )}
        </button>

        <button
          onClick={() => setMenu(menu === 'aide' ? null : 'aide')}
          className="rounded-xl p-2.5 text-stone-700 transition hover:bg-stone-100"
          aria-label="Aide"
        >
          <HelpCircle className="h-6 w-6" />
        </button>

        <button
          onClick={() => setMenu(menu === 'profil' ? null : 'profil')}
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-stone-100"
          aria-label="Menu utilisateur"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-600 to-bauxite-700 text-lg font-bold text-white">
            {(profile?.full_name?.trim().charAt(0) || '?').toUpperCase()}
          </span>
          <ChevronDown className="h-4 w-4 text-stone-600" />
        </button>

        {menu === 'aide' && (
          <div className="absolute right-14 top-14 z-50 w-80 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-xl">
            <p className="font-semibold text-stone-900">Aide</p>
            <p className="mt-2">Recherche rapide : Ctrl K.</p>
            <p className="mt-1">Chaque indicateur affiche sa source et son heure de mise à jour. « Sans données » signifie qu'aucune saisie n'existe encore.</p>
            <p className="mt-1">Pour un accès ou un mot de passe, contactez l'administrateur de la plateforme.</p>
          </div>
        )}

        {menu === 'profil' && (
          <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="border-b border-stone-100 px-4 py-3">
              <p className="truncate font-semibold text-stone-900">{profile?.full_name}</p>
              <p className="truncate text-sm text-stone-500">{user?.email}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
                {LIBELLES_ROLE[profile?.role ?? ''] ?? profile?.role}
              </p>
            </div>
            <button
              onClick={() => { setMenu(null); onAllerA('securite-compte'); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-stone-700 hover:bg-stone-50"
            >
              <ShieldCheck className="h-5 w-5" /> Sécurité du compte
            </button>
            <button
              onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-stone-700 hover:bg-stone-50"
            >
              <Languages className="h-5 w-5" /> {language === 'fr' ? 'Langue : français' : 'Language: English'}
            </button>
            <button
              onClick={() => {
                setMenu(null);
                setDeconnexion(true);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" /> Se déconnecter
            </button>
          </div>
        )}
      </div>

      <DeconnexionDialog ouvert={deconnexion} onFermer={() => setDeconnexion(false)} />
    </header>
  );
};
