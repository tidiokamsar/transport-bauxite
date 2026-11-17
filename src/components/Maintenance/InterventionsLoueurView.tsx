import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { ecrireRoute, routeDetail, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import {
  CANAUX, LIBELLE_STATUT_INTERVENTION, TEINTES_INTERVENTION, VUE_INTERVENTIONS, type StatutIntervention,
} from './interventions';
import { FormulaireIntervention } from './FormulaireIntervention';
import { DetailIntervention } from './DetailIntervention';
import { ActionInterventionVue } from './ActionIntervention';

// Interventions du loueur sur les engins immobilises (D-049) aux pages
// standard (D-090) : liste, demande en pleine page depuis une
// immobilisation, fiche (pieces remplacees, journal), prise en charge, fin
// et decision de remise en service en pages d'action.

export const InterventionsLoueurView = () => {
  const route = useRoute();
  if (route.vue !== VUE_INTERVENTIONS || route.mode === 'liste') return <ListeInterventions />;
  if (route.mode === 'nouveau') return <FormulaireIntervention immobilisationId={route.requete.immobilisation ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionInterventionVue id={route.id ?? ''} action={route.action} />;
  return <DetailIntervention id={route.id ?? ''} />;
};

interface ImmobilisationOuverte { id: string; vehicle_id: string; debut: string; imputation: string; description: string; statut: string }
interface InterventionListe {
  id: string; numero: string; immobilisation_id: string; vehicle_id: string; statut: StatutIntervention;
  demande_le: string; canal: string; reference_demande: string | null; description: string; delai_contractuel_heures: number | null;
  technicien: string | null; prise_en_charge_le: string | null; fin_le: string | null; rapport: string | null;
  delai_heures: number | null; en_retard: boolean | null; duree_intervention_heures: number | null;
}

const dateHeure = (iso: string) => new Date(iso).toLocaleString('fr-FR');

const ListeInterventions = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [immobs, setImmobs] = useState<ImmobilisationOuverte[]>([]);
  const [interventions, setInterventions] = useState<InterventionListe[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [m, i, v] = await Promise.all([
      supabase.from('immobilisations').select('id, vehicle_id, debut, imputation, description, statut').eq('statut', 'ouverte').in('imputation', ['loueur', 'a_determiner']).order('debut'),
      supabase.from('v_interventions_loueur').select('*').order('demande_le', { ascending: false }).limit(500),
      supabase.from('vehicles').select('id, registration'),
    ]);
    setErreur(i.error ? `Interventions indisponibles : ${i.error.message}` : m.error ? `Immobilisations indisponibles : ${m.error.message}` : '');
    setImmobs(((m.data ?? []) as ImmobilisationOuverte[]).filter((x) => x.statut === 'ouverte' && x.imputation !== 'exploitant'));
    setInterventions(i.error ? null : (i.data ?? []) as InterventionListe[]);
    setEngins(new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enCours = useMemo(() => new Set((interventions ?? []).filter((x) => x.statut !== 'remise_validee').map((x) => x.immobilisation_id)), [interventions]);
  const aDemander = immobs.filter((m) => !enCours.has(m.id));

  const colonnes = useMemo<ColonneListe<InterventionListe>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (i) => i.numero },
    { id: 'engin', libelle: 'Engin', valeur: (i) => engins.get(i.vehicle_id) ?? 'Engin' },
    { id: 'description', libelle: 'Description', valeur: (i) => i.description },
    { id: 'demande', libelle: 'Demandée le', valeur: (i) => i.demande_le, rendu: (i) => dateHeure(i.demande_le) },
    { id: 'canal', libelle: 'Canal', valeur: (i) => CANAUX[i.canal as keyof typeof CANAUX] ?? i.canal, masquee: true },
    { id: 'delai', libelle: 'Délai de prise en charge', alignement: 'droite', valeur: (i) => i.delai_heures,
      rendu: (i) => (i.delai_heures === null ? 'Non renseigné' : `${i.delai_heures} h${i.prise_en_charge_le ? '' : ' (en cours)'}${i.delai_contractuel_heures !== null ? ` / contrat ${i.delai_contractuel_heures} h` : ''}`) },
    { id: 'technicien', libelle: 'Technicien', valeur: (i) => i.technicien, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (i) => LIBELLE_STATUT_INTERVENTION[i.statut] ?? i.statut,
      rendu: (i) => (
        <span className="flex flex-wrap gap-1">
          <Puce teinte={TEINTES_INTERVENTION[i.statut] ?? 'gris'}>{LIBELLE_STATUT_INTERVENTION[i.statut] ?? i.statut}</Puce>
          {i.en_retard === true && <Puce teinte="rouge">Délai contractuel dépassé</Puce>}
        </span>
      ) },
  ], [engins]);

  const filtres = useMemo<FiltreListe<InterventionListe>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: (Object.keys(LIBELLE_STATUT_INTERVENTION) as StatutIntervention[]).map((k) => ({ valeur: k, libelle: LIBELLE_STATUT_INTERVENTION[k] })), correspond: (i, v) => i.statut === v },
    { id: 'retard', libelle: 'Délai', options: [{ valeur: 'oui', libelle: 'Délai contractuel dépassé' }], correspond: (i, v) => v !== 'oui' || i.en_retard === true },
  ], []);

  const synthese = (
    <Panneau titre={`Immobilisations sans intervention demandée (${aDemander.length})`}>
      {aDemander.length === 0 ? <SansDonnees message="Aucune immobilisation en attente de demande" /> : (
        <ul className="divide-y divide-stone-100 text-sm">
          {aDemander.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <a href={routeDetail('immobilisations', m.id)} className="font-semibold text-orange-800 hover:underline">{engins.get(m.vehicle_id) ?? 'Engin'}</a>
                {' '}· depuis le {dateHeure(m.debut)} · {m.description} {m.imputation === 'a_determiner' && <Puce teinte="orange">Imputation à déterminer</Puce>}
              </span>
              {peutEcrire && (
                <a href={ecrireRoute({ vue: VUE_INTERVENTIONS, mode: 'nouveau', requete: { immobilisation: m.id } })} aria-label={`Demander l'intervention ${engins.get(m.vehicle_id) ?? ''}`}
                  className="flex items-center gap-1 rounded bg-orange-700 px-2 py-1 text-xs font-bold text-white"><Send className="h-3 w-3" /> Demander l'intervention</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  );

  return (
    <PageListe
      vue={VUE_INTERVENTIONS}
      titre="Interventions du loueur"
      sousTitre="Engins loués immobilisés : demande à Neemba, prise en charge, rapport, remise en service validée"
      lignes={interventions}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un numéro, un engin, une description..."
      cle={(i) => i.id}
      libelleOuverture={(i) => `Fiche ${i.numero}`}
      synthese={synthese}
      nomExport="interventions-loueur"
      vide={{ message: 'Aucune intervention', detail: 'Une intervention se demande depuis une immobilisation imputée au loueur ou à imputer.' }}
      onActualiser={charger}
      provenance={<Provenance source="interventions du loueur (v_interventions_loueur : délai de prise en charge calculé par le serveur)" heure={heure} />}
    />
  );
};
