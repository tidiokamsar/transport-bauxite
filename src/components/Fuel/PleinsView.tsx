import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Provenance } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { ParcoursCarburant } from './ParcoursCarburant';
import { VUE_PLEINS } from './carburant';
import { COLONNES_PLEIN, FichePlein, FormulairePlein, type Plein } from './PagesPlein';

// Pleins et remplissages de cuve (D-030, D-062) au standard des pages
// (D-090) : liste du mois, fiche d'un plein (mouvement de cuve lie,
// historique), saisie en pleine page par la fonction serveur saisir_plein
// (droit carburant, perimetre de l'engin, reference attribuee par le
// serveur, cuve optionnelle qui cree une distribution a valider). Le prix est
// porte par les livraisons CBG, jamais saisi sur un plein individuel. Un
// plein ne se modifie pas : la distribution d'une cuve s'annule par un
// contre-mouvement dans le registre.

export const PleinsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_PLEINS || route.mode === 'liste') return <ListePleins />;
  if (route.mode === 'nouveau') return <FormulairePlein />;
  return <FichePlein id={route.id ?? ''} />;
};

const moisCourant = () => new Date().toISOString().slice(0, 7);
// Mois choisi pendant la session : le retour a la liste le conserve.
let moisMemorise = '';

const ListePleins = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [mois, setMoisEtat] = useState(() => moisMemorise || moisCourant());
  const setMois = (m: string) => { moisMemorise = m; setMoisEtat(m); };
  const [pleins, setPleins] = useState<Plein[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [chauffeurs, setChauffeurs] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(mois)) return;
    const [a, m] = mois.split('-').map(Number);
    let q = supabase.from('fuel_transactions').select(COLONNES_PLEIN)
      .gte('transaction_date', `${mois}-01`).lte('transaction_date', `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`)
      .order('transaction_date', { ascending: false });
    if (siteId) q = q.eq('site_id', siteId);
    const [p, v, d] = await Promise.all([
      q,
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setErreur(p.error ? `Pleins indisponibles : ${p.error.message}` : '');
    setPleins(p.error ? null : ((p.data ?? []) as Plein[]));
    setEngins(new Map(((v.data ?? []) as { id: string; registration: string }[]).map((x) => [x.id, x.registration])));
    setChauffeurs(new Map(((d.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    setHeure(new Date());
  }, [mois, siteId]);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const totaux = useMemo(() => {
    const l = pleins ?? [];
    const distrib = l.filter((x) => x.transaction_type === 'refuel');
    return {
      litres: distrib.reduce((s, x) => s + Number(x.volume_liters), 0),
      cout: distrib.some((x) => x.total_cost === null) ? null : distrib.reduce((s, x) => s + Number(x.total_cost), 0),
      cuves: l.filter((x) => x.transaction_type === 'tank_fill').reduce((s, x) => s + Number(x.volume_liters), 0),
    };
  }, [pleins]);

  const colonnes = useMemo<ColonneListe<Plein>[]>(() => [
    { id: 'date', libelle: 'Date', valeur: (x) => x.transaction_date, rendu: (x) => new Date(`${x.transaction_date}T00:00:00`).toLocaleDateString('fr-FR') },
    { id: 'reference', libelle: 'Référence', valeur: (x) => x.reference, rendu: (x) => <span className="font-mono text-xs">{x.reference}</span> },
    { id: 'type', libelle: 'Type', valeur: (x) => (x.transaction_type === 'refuel' ? 'Plein' : 'Remplissage cuve'), masquee: true },
    { id: 'engin', libelle: 'Engin', valeur: (x) => (x.transaction_type === 'tank_fill' ? `Cuve · ${x.site_id ? nomSite.get(x.site_id) ?? '' : ''}` : engins.get(x.vehicle_id ?? '') ?? null) },
    { id: 'chauffeur', libelle: 'Chauffeur', valeur: (x) => (x.driver_id ? chauffeurs.get(x.driver_id) ?? null : null) },
    { id: 'litres', libelle: 'Litres', valeur: (x) => Number(x.volume_liters), rendu: (x) => formatNombre(Number(x.volume_liters)), alignement: 'droite' },
    { id: 'prix', libelle: 'Prix / L', valeur: (x) => x.unit_price, rendu: (x) => (x.unit_price === null ? '—' : formatNombre(Number(x.unit_price))), alignement: 'droite' },
    { id: 'montant', libelle: 'Montant', valeur: (x) => x.total_cost, rendu: (x) => (x.total_cost === null ? '—' : formatNombre(Number(x.total_cost))), alignement: 'droite' },
    { id: 'site', libelle: 'Site', valeur: (x) => (x.site_id ? nomSite.get(x.site_id) ?? null : null), masquee: true },
    { id: 'compteur', libelle: 'Compteur', valeur: (x) => x.odometer_reading, masquee: true },
    { id: 'origine', libelle: 'Origine', valeur: (x) => [x.notes, x.supplier].filter(Boolean).join(' · ') || null },
  ], [engins, chauffeurs, nomSite]);
  const filtres = useMemo<FiltreListe<Plein>[]>(() => [
    { id: 'type', libelle: 'Type', options: [{ valeur: 'refuel', libelle: 'Plein' }, { valeur: 'tank_fill', libelle: 'Remplissage cuve' }], correspond: (x, v) => x.transaction_type === v },
  ], []);

  return (
    <div className="space-y-6">
      <ParcoursCarburant vue={VUE_PLEINS} />
      <PageListe
        vue={VUE_PLEINS}
        titre="Distribution aux engins"
        sousTitre="Pleins saisis un par un ou par fiche carburant FC ; prix et factures suivis dans « Livraisons et factures CBG »"
        lignes={pleins}
        erreur={erreur}
        colonnes={colonnes}
        filtres={filtres}
        placeholderRecherche="Rechercher une référence, un engin, un chauffeur..."
        cle={(x) => x.id}
        libelleOuverture={(x) => `Fiche ${x.reference}`}
        actions={<>
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          {peutEcrire && (
            <a href={routeNouveau(VUE_PLEINS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Saisir un plein
            </a>
          )}
        </>}
        synthese={(
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Synthèse des pleins">
            {[
              ['Litres distribués aux engins', `${formatNombre(totaux.litres)} L`],
              ['Coût des distributions', totaux.cout === null || totaux.cout === 0 ? '—' : formatNombre(totaux.cout)],
              ['Litres reçus en cuve', `${formatNombre(totaux.cuves)} L`],
            ].map(([l, v]) => <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{pleins ? v : '—'}</p></div>)}
          </section>
        )}
        nomExport={`pleins-${mois}`}
        vide={{ message: 'Aucun mouvement ce mois-ci', detail: 'Saisissez un plein ou une fiche carburant.' }}
        onActualiser={charger}
        provenance={<Provenance source="transactions carburant (fiches carburant et saisies unitaires)" heure={heure} />}
      />
    </div>
  );
};
