import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { formatNombre } from '../Dashboard/indicateurs';
import {
  CAUSES, IMPUTATIONS, STATUTS_IMMOBILISATION, VUE_IMMOBILISATIONS, bornesMois, disponibilite, formatDuree, heuresDansPeriode, totalParImputation,
  type Cause, type Immobilisation, type Imputation,
} from './immobilisations';
import { FormulaireImmobilisation } from './FormulaireImmobilisation';
import { DetailImmobilisation } from './DetailImmobilisation';
import { ActionImmobilisationVue } from './ActionImmobilisation';

// Immobilisations des engins loues (D-022, D-025) aux pages standard
// (D-090) : liste du mois (arrets, duree, imputation), synthese, fiche avec
// journal et interventions du loueur, declaration en pleine page,
// remise en service, correction et annulation en pages d'action.

export const ImmobilisationsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_IMMOBILISATIONS || route.mode === 'liste') return <ListeImmobilisations />;
  if (route.mode === 'nouveau') return <FormulaireImmobilisation />;
  if (route.mode === 'action' && route.action) return <ActionImmobilisationVue id={route.id ?? ''} action={route.action} />;
  // Pas de modification libre : la correction (motif obligatoire) est une action.
  if (route.mode === 'modifier') return <ActionImmobilisationVue id={route.id ?? ''} action="corriger" />;
  return <DetailImmobilisation id={route.id ?? ''} />;
};

interface Engin { id: string; registration: string; status: string }

const moisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const horodatage = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const ListeImmobilisations = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [mois, setMois] = useState(moisCourant);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [liste, setListe] = useState<Immobilisation[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const { du, au } = useMemo(() => bornesMois(mois), [mois]);

  const charger = useCallback(async () => {
    const [rE, rI] = await Promise.all([
      supabase.from('vehicles').select('id, registration, status').order('registration'),
      supabase.from('immobilisations')
        .select('id, vehicle_id, debut, fin, cause, imputation, description, reference_loueur, statut')
        .neq('statut', 'annulee')
        .lt('debut', au.toISOString())
        .or(`fin.is.null,fin.gt.${du.toISOString()}`)
        .order('debut', { ascending: false }),
    ]);
    setEngins((rE.data ?? []) as Engin[]);
    setErreur(rI.error ? `Immobilisations indisponibles : ${rI.error.message}` : '');
    setListe(rI.error ? null : ((rI.data ?? []) as Immobilisation[]).filter((i) => i.statut !== 'annulee'));
    setHeure(new Date());
  }, [du, au]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  const maintenant = useMemo(() => heure ?? new Date(), [heure]);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const flotte = engins.filter((e) => e.status !== 'sold');
  const ouvertes = (liste ?? []).filter((i) => i.statut === 'ouverte');
  const totaux = totalParImputation(liste ?? [], du, au, maintenant);
  const dispo = disponibilite(totaux.loueur + totaux.exploitant + totaux.a_determiner, flotte.length, du, au, maintenant);

  const parEngin = useMemo(() => {
    const lignes = new Map<string, Record<Imputation, number>>();
    for (const i of liste ?? []) {
      const l = lignes.get(i.vehicle_id) ?? { loueur: 0, exploitant: 0, a_determiner: 0 };
      l[i.imputation] += heuresDansPeriode(i, du, au, maintenant);
      lignes.set(i.vehicle_id, l);
    }
    return [...lignes.entries()].sort((a, b) => (immat.get(a[0]) ?? '').localeCompare(immat.get(b[0]) ?? ''));
  }, [liste, du, au, maintenant, immat]);

  const colonnes = useMemo<ColonneListe<Immobilisation>[]>(() => [
    { id: 'engin', libelle: 'Engin', valeur: (i) => immat.get(i.vehicle_id) ?? 'Engin' },
    { id: 'debut', libelle: 'Début', valeur: (i) => i.debut, rendu: (i) => horodatage(i.debut) },
    { id: 'fin', libelle: 'Fin', valeur: (i) => i.fin, rendu: (i) => (i.fin ? horodatage(i.fin) : <span className="font-medium text-red-700">en cours</span>) },
    { id: 'duree', libelle: 'Durée (mois)', alignement: 'droite', valeur: (i) => Number(heuresDansPeriode(i, du, au, maintenant).toFixed(2)),
      rendu: (i) => formatDuree(heuresDansPeriode(i, du, au, maintenant)) },
    { id: 'cause', libelle: 'Cause', valeur: (i) => CAUSES[i.cause] ?? i.cause },
    { id: 'imputation', libelle: 'Imputation', valeur: (i) => IMPUTATIONS[i.imputation]?.libelle ?? i.imputation,
      rendu: (i) => <Puce teinte={IMPUTATIONS[i.imputation]?.teinte ?? 'gris'}>{IMPUTATIONS[i.imputation]?.libelle ?? i.imputation}</Puce> },
    { id: 'statut', libelle: 'Statut', valeur: (i) => STATUTS_IMMOBILISATION[i.statut]?.libelle ?? i.statut,
      rendu: (i) => <Puce teinte={STATUTS_IMMOBILISATION[i.statut]?.teinte ?? 'gris'}>{STATUTS_IMMOBILISATION[i.statut]?.libelle ?? i.statut}</Puce> },
    { id: 'description', libelle: 'Description', valeur: (i) => `${i.description}${i.reference_loueur ? ` · réf. ${i.reference_loueur}` : ''}` },
  ], [immat, du, au, maintenant]);

  const filtres = useMemo<FiltreListe<Immobilisation>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: [{ valeur: 'ouverte', libelle: 'En cours' }, { valeur: 'cloturee', libelle: 'Clôturée' }], correspond: (i, v) => i.statut === v },
    { id: 'imputation', libelle: 'Imputation', options: (Object.keys(IMPUTATIONS) as Imputation[]).map((k) => ({ valeur: k, libelle: IMPUTATIONS[k].libelle })), correspond: (i, v) => i.imputation === v },
    { id: 'cause', libelle: 'Cause', options: (Object.keys(CAUSES) as Cause[]).map((k) => ({ valeur: k, libelle: CAUSES[k] })), correspond: (i, v) => i.cause === v },
  ], []);

  const synthese = (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        Mois
        <input type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
      </label>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Synthèse du mois">
        {[
          ['Engins arrêtés maintenant', liste ? `${ouvertes.length} / ${flotte.length}` : '—'],
          ['Disponibilité du mois', dispo === null ? '—' : `${formatNombre(dispo, 1)} %`],
          ['Heures à la charge du loueur', liste ? `${formatNombre(totaux.loueur, 1)} h` : '—'],
          ['Heures à la charge de l\'exploitant', liste ? `${formatNombre(totaux.exploitant, 1)} h` : '—'],
          ['Heures à imputer', liste ? `${formatNombre(totaux.a_determiner, 1)} h` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="text-sm text-stone-500">{l}</p>
            <p className="text-2xl font-black text-stone-900">{v}</p>
          </div>
        ))}
      </section>
      {totaux.a_determiner > 0 && (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
          {formatNombre(totaux.a_determiner, 1)} h restent à imputer : à trancher avant le rapprochement des heures avec le loueur.
        </p>
      )}
      <Panneau titre="Heures par engin">
        {parEngin.length === 0 ? <SansDonnees message="Sans données" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-2 font-medium">Engin</th>
                <th className="py-2 pr-2 text-right font-medium">Loueur</th>
                <th className="py-2 pr-2 text-right font-medium">Exploitant</th>
                <th className="py-2 text-right font-medium">À imputer</th>
              </tr>
            </thead>
            <tbody>
              {parEngin.map(([id, l]) => (
                <tr key={id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-2 font-semibold text-stone-900">{immat.get(id) ?? '—'}</td>
                  <td className="py-2 pr-2 text-right">{formatNombre(l.loueur, 1)} h</td>
                  <td className="py-2 pr-2 text-right">{formatNombre(l.exploitant, 1)} h</td>
                  <td className="py-2 text-right">{formatNombre(l.a_determiner, 1)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panneau>
    </div>
  );

  return (
    <PageListe
      vue={VUE_IMMOBILISATIONS}
      titre="Immobilisations"
      sousTitre="Engins loués à Nimba Mining : arrêts, durée et imputation (loueur ou exploitant)"
      lignes={liste}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un engin, une description, une référence..."
      cle={(i) => i.id}
      libelleOuverture={(i) => `Fiche ${immat.get(i.vehicle_id) ?? 'engin'} du ${horodatage(i.debut)}`}
      synthese={synthese}
      actions={peutEcrire && (
        <a href={routeNouveau(VUE_IMMOBILISATIONS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Déclarer une immobilisation
        </a>
      )}
      nomExport={`immobilisations-${mois}`}
      vide={{ message: 'Aucun arrêt ce mois-ci', detail: 'Tous les engins sont en service sur la période.' }}
      onActualiser={charger}
      provenance={<Provenance source="immobilisations déclarées (heures réelles de début et de fin), bornées au mois ; disponibilité = 1 - heures d'arrêt / (engins x heures écoulées)" heure={heure} />}
    />
  );
};
