import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { NIVEAUX_RELANCE, VUE_RECOUVREMENT, montant } from './facturation';
import { COLONNES_CREANCE, type Creance } from './creances';
import { ActionCreance, DetailCreance, LettreRelance } from './DetailCreance';

// Recouvrement des factures clients (phase 4, D-031) au standard des pages
// (D-090) : creances, encaissements (saisis par la comptabilite ou le
// charge de contrats, au plus le reste du), relances par niveau apres
// l'echeance, lettre imprimable en pleine page.

export const RecouvrementView = () => {
  const route = useRoute();
  if (route.vue !== VUE_RECOUVREMENT || route.mode === 'liste' || route.mode === 'nouveau') return <ListeCreances />;
  if (route.mode === 'action' && route.action === 'lettre') return <LettreRelance id={route.id ?? ''} niveau={Number(route.requete.niveau)} />;
  if (route.mode === 'action' && route.action) return <ActionCreance id={route.id ?? ''} action={route.action} />;
  return <DetailCreance id={route.id ?? ''} />;
};

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : '—');

const ListeCreances = () => {
  const [creances, setCreances] = useState<Creance[] | null>(null);
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [c, k] = await Promise.all([
      supabase.from('v_creances').select(COLONNES_CREANCE).order('date_echeance'),
      supabase.from('contrats').select('id, contrepartie'),
    ]);
    setErreur(c.error ? `Créances indisponibles : ${c.error.message}` : '');
    setCreances(c.error ? null : ((c.data ?? []) as Creance[]));
    setClients(new Map(((k.data ?? []) as { id: string; contrepartie: string }[]).map((x) => [x.id, x.contrepartie])));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Creance>[]>(() => [
    { id: 'numero', libelle: 'Facture', valeur: (x) => x.numero, rendu: (x) => <span className="font-mono">{x.numero}</span> },
    { id: 'client', libelle: 'Client', valeur: (x) => clients.get(x.contrat_id) ?? null },
    { id: 'emission', libelle: 'Émise le', valeur: (x) => x.date_emission, rendu: (x) => jour(x.date_emission), masquee: true },
    { id: 'du', libelle: 'Dû', valeur: (x) => Number(x.du), alignement: 'droite', rendu: (x) => montant(x.du, x.devise) },
    { id: 'encaisse', libelle: 'Encaissé', valeur: (x) => Number(x.encaisse), alignement: 'droite', rendu: (x) => montant(x.encaisse, x.devise) },
    { id: 'reste', libelle: 'Reste', valeur: (x) => Number(x.reste), alignement: 'droite',
      rendu: (x) => (Number(x.reste) <= 0 ? <Puce teinte="vert">Soldée</Puce> : <b>{montant(x.reste, x.devise)}</b>) },
    { id: 'echeance', libelle: 'Échéance', valeur: (x) => x.date_echeance,
      rendu: (x) => <>{jour(x.date_echeance)}{(x.jours_retard ?? 0) > 0 && <span className="ml-1 font-semibold text-red-700">({x.jours_retard} j de retard)</span>}</> },
    { id: 'relance', libelle: 'Dernière relance', valeur: (x) => (x.derniere_relance_niveau ? `${NIVEAUX_RELANCE[x.derniere_relance_niveau]} le ${jour(x.derniere_relance_le)}` : null) },
  ], [clients]);

  const filtres = useMemo<FiltreListe<Creance>[]>(() => [
    { id: 'etat', libelle: 'État', options: [{ valeur: 'ouvertes', libelle: 'Non soldées' }, { valeur: 'retard', libelle: 'En retard' }, { valeur: 'soldees', libelle: 'Soldées' }],
      correspond: (x, v) => (v === 'retard' ? (x.jours_retard ?? 0) > 0 && Number(x.reste) > 0 : v === 'soldees' ? Number(x.reste) <= 0 : Number(x.reste) > 0) },
    { id: 'client', libelle: 'Client', options: [...new Set((creances ?? []).map((x) => x.contrat_id))].map((c) => ({ valeur: c, libelle: clients.get(c) ?? 'Contrat' })),
      correspond: (x, v) => x.contrat_id === v },
  ], [creances, clients]);

  const totaux = useMemo(() => {
    const ouvertes = (creances ?? []).filter((x) => Number(x.reste) > 0);
    const parDevise = new Map<string, { reste: number; retard: number }>();
    for (const x of ouvertes) {
      const t = parDevise.get(x.devise) ?? { reste: 0, retard: 0 };
      t.reste += Number(x.reste);
      if ((x.jours_retard ?? 0) > 0) t.retard += Number(x.reste);
      parDevise.set(x.devise, t);
    }
    return { nombre: ouvertes.length, enRetard: ouvertes.filter((x) => (x.jours_retard ?? 0) > 0).length, parDevise };
  }, [creances]);

  const synthese = (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Synthèse des créances">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">Factures non soldées</p><p className="text-2xl font-black">{creances ? totaux.nombre : '—'}</p></div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">Reste dû</p><p className="text-lg font-black">{[...totaux.parDevise].map(([d, t]) => montant(t.reste, d)).join(' · ') || '—'}</p></div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">En retard ({totaux.enRetard})</p><p className="text-lg font-black text-red-700">{[...totaux.parDevise].filter(([, t]) => t.retard > 0).map(([d, t]) => montant(t.retard, d)).join(' · ') || '—'}</p></div>
    </section>
  );

  return (
    <PageListe
      vue={VUE_RECOUVREMENT}
      titre="Recouvrement"
      sousTitre="Créances clients, encaissements et relances après l'échéance"
      lignes={creances}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher une facture, un client..."
      cle={(x) => x.id}
      libelleOuverture={(x) => `Créance ${x.numero}`}
      synthese={synthese}
      nomExport="creances"
      vide={{ message: 'Aucune créance', detail: 'Les créances naissent des factures émises.' }}
      onActualiser={charger}
      provenance={<Provenance source="factures émises, avoirs émis, encaissements saisis, relances ; retard = jours depuis l'échéance tant qu'un reste est dû" heure={heure} />}
    />
  );
};
