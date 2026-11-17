import { useEffect, useState } from 'react';
import { Pencil, Power, PowerOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail, routeModifier } from '../ui/routeur';
import { STATUTS_ORDRE, TEINTE_STATUT_ORDRE, TYPES_ORDRE, VUE_ORDRES } from './ordres';
import {
  COLONNES_PLANNING, MODULE_PREVENTIF, VUE_PREVENTIF, actionPlanningInterdite, dernierReleveParEngin, echeancePlanning, type Planning,
} from './preventif';
import { chargerLocationsEngins, type LocationEngin } from './locationsEngins';

// Fiche d'un planning preventif (D-061, D-090) : intervalle, echeance
// calculee depuis des donnees connues, engin, contrat de location eventuel,
// derniers releves compteur et ordres de travail de l'engin. Aucun journal
// n'est tenu sur maintenance_schedules : l'historique se limite aux
// horodatages enregistres (ecart affiche).

interface ReleveEngin { id: string; vehicle_id: string; valeur_km: number; releve_le: string }
interface OrdreEngin { id: string; work_order_number: string | null; title: string | null; maintenance_type: string; status: string; vehicle_id: string | null; request_date: string | null }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const km = (v: number | null) => (v !== null && v !== undefined ? `${formatNombre(Number(v), 0)} km` : null);
const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

export const DetailPlanPreventif = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [planning, setPlanning] = useState<Lecture<Planning>>(attente);
  const [engin, setEngin] = useState<{ registration: string; brand_model: string } | null>(null);
  const [location, setLocation] = useState<LocationEngin | null>(null);
  const [releves, setReleves] = useState<Lecture<ReleveEngin>>(attente);
  const [ordres, setOrdres] = useState<Lecture<OrdreEngin>>(attente);

  useEffect(() => {
    lire<Planning>(supabase.from('maintenance_schedules').select(COLONNES_PLANNING).eq('id', id), 'planning préventif').then(async (r) => {
      setPlanning(r);
      const p = trouver(r.lignes, id);
      if (!p) return;
      if (!p.vehicle_id) { setReleves({ lignes: [], erreur: '' }); setOrdres({ lignes: [], erreur: '' }); return; }
      const vehicule = p.vehicle_id;
      const [v, loc, rel, ord] = await Promise.all([
        supabase.from('vehicles').select('id, registration, brand_model').eq('id', vehicule),
        chargerLocationsEngins(),
        lire<ReleveEngin>(supabase.from('v_releves_compteur').select('id, vehicle_id, valeur_km, releve_le').eq('vehicle_id', vehicule).order('releve_le', { ascending: false }).limit(10), 'relevés compteur'),
        lire<OrdreEngin>(supabase.from('maintenance_orders').select('id, work_order_number, title, maintenance_type, status, vehicle_id, request_date').eq('vehicle_id', vehicule).order('request_date', { ascending: false }).limit(20), 'ordres de travail de l\'engin'),
      ]);
      setEngin(((v.data ?? []) as { id: string; registration: string; brand_model: string }[]).find((x) => x.id === vehicule) ?? null);
      setLocation(loc.get(vehicule) ?? null);
      setReleves({ ...rel, lignes: rel.lignes && rel.lignes.filter((x) => x.vehicle_id === vehicule) });
      setOrdres({ ...ord, lignes: ord.lignes && ord.lignes.filter((x) => x.vehicle_id === vehicule) });
    });
  }, [id]);

  const p = trouver(planning.lignes, id);
  const actif = p?.is_active !== false;
  const dernier = releves.lignes ? dernierReleveParEngin(releves.lignes).get(p?.vehicle_id ?? '') ?? null : null;
  const e = p ? echeancePlanning(p, dernier, new Date()) : null;

  const historique: EvenementHistorique[] | null = p ? fusionnerHistoriques([
    ...(p.created_at ? [{ id: 'planning-cree', le: p.created_at, libelle: 'Planning créé', source: 'maintenance_schedules.created_at' }] : []),
    ...(p.updated_at && p.updated_at !== p.created_at ? [{ id: 'planning-modifie', le: p.updated_at, libelle: 'Dernière modification enregistrée', detail: actif ? null : 'Planning désactivé à ce jour', source: 'maintenance_schedules.updated_at' }] : []),
    ...(p.last_maintenance_date ? [{ id: 'planning-intervention', le: `${p.last_maintenance_date}T00:00:00`, libelle: 'Dernière intervention saisie',
      detail: [km(p.last_maintenance_km), 'date saisie, sans heure'].filter(Boolean).join(' · '), source: 'maintenance_schedules.last_maintenance_date' }] : []),
  ]) : null;

  return (
    <PageDetail
      vue={VUE_PREVENTIF}
      module={MODULE_PREVENTIF}
      reference={p?.title ?? 'Planning préventif'}
      statut={p ? { libelle: actif ? 'Actif' : 'Désactivé', teinte: actif ? 'vert' : 'gris' } : null}
      resume={p && <>{p.maintenance_type}{engin ? ` · ${engin.registration}` : ''}</>}
      chargement={planning.lignes === null && !planning.erreur}
      erreur={planning.erreur}
      introuvable={planning.lignes !== null && !p}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <Pencil className="h-4 w-4" />, visible: Boolean(p) && peutEcrire, vers: routeModifier(VUE_PREVENTIF, id) },
        { id: 'desactiver', libelle: 'Désactiver', icone: <PowerOff className="h-4 w-4" />, visible: Boolean(p) && actionPlanningInterdite('desactiver', actif, peutEcrire) === null, ton: 'danger', vers: routeAction(VUE_PREVENTIF, id, 'desactiver') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <Power className="h-4 w-4" />, visible: Boolean(p) && actionPlanningInterdite('reactiver', actif, peutEcrire) === null, ton: 'principal', vers: routeAction(VUE_PREVENTIF, id, 'reactiver') },
      ]}
      onglets={!p || !e ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            {location && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Cet engin figure au contrat de location {location.reference} ({location.contrepartie}) : sa maintenance relève du loueur (D-022, D-025).
              </p>
            )}
            <Informations groupes={[
              { titre: 'Planning', champs: [
                ['Intitulé', p.title], ['Type', p.maintenance_type], ['Description', p.description],
                ['Engin', engin ? `${engin.registration} · ${engin.brand_model}` : null], ['Intervalle', [km(p.interval_km), p.interval_days ? `${p.interval_days} jours` : null].filter(Boolean).join(' ou ') || null],
                ['Coût estimé', p.estimated_cost !== null ? `${formatNombre(Number(p.estimated_cost), 0)} GNF` : null], ['État', actif ? 'Actif' : 'Désactivé'],
              ] },
              { titre: 'Échéance', champs: [
                ['Dernière intervention', [km(p.last_maintenance_km), jour(p.last_maintenance_date)].filter(Boolean).join(' · ') || 'Non saisie'],
                ['Prochaine échéance', [km(p.next_service_km), jour(p.next_service_date)].filter(Boolean).join(' ou ') || null],
                ['Statut', e.statut === 'depassee' ? <Puce teinte="rouge">Dépassée</Puce> : e.statut === 'a_venir' ? <Puce teinte="bleu">À venir</Puce> : <Puce teinte="gris">Inconnue</Puce>],
                ['Km restants', e.kmRestants !== null ? `${formatNombre(e.kmRestants, 0)} km (relevé du ${dernier ? new Date(dernier.releve_le).toLocaleDateString('fr-FR') : '?'})`
                  : p.next_service_km !== null ? 'Sans relevé compteur' : null],
                ['Jours restants', e.joursRestants !== null ? `${e.joursRestants} j` : null],
              ] },
            ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Engin et ordres', compte: ordres.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <Relation titre="Engin et contrat" lignes={p.vehicle_id ? [{ cle: 'engin' as const }, ...(location ? [{ cle: 'contrat' as const }] : [])] : []} cle={(l) => l.cle}
              vide="Aucun engin rattaché"
              lien={(l) => (l.cle === 'engin' ? routeDetail('vehicles', p.vehicle_id ?? '') : location?.contratId ? routeDetail('contrats', location.contratId) : routeDetail(VUE_PREVENTIF, id, 'relations'))}
              colonnes={[
                { libelle: 'Élément', valeur: (l) => (l.cle === 'engin' ? engin?.registration ?? 'Engin' : location?.reference ?? 'Contrat') },
                { libelle: 'Nature', valeur: (l) => (l.cle === 'engin' ? 'Engin planifié' : `Contrat de location (${location?.contrepartie ?? ''})`) },
              ]} />
            <Relation titre="Derniers relevés compteur de l'engin" lignes={releves.lignes} erreur={releves.erreur} cle={(r) => r.id} vide="Aucun relevé compteur pour cet engin"
              colonnes={[
                { libelle: 'Relevé le', valeur: (r) => new Date(r.releve_le).toLocaleString('fr-FR') },
                { libelle: 'Compteur', valeur: (r) => km(r.valeur_km) },
              ]}
              note="Source : relevés compteur en vigueur (v_releves_compteur, D-043), 10 derniers." />
            <Relation titre="Ordres de travail de l'engin" lignes={ordres.lignes} erreur={ordres.erreur} cle={(o) => o.id} vide="Aucun ordre de travail pour cet engin"
              lien={(o) => routeDetail(VUE_ORDRES, o.id)}
              colonnes={[
                { libelle: 'N°', valeur: (o) => o.work_order_number ?? 'Non attribué' },
                { libelle: 'Intitulé', valeur: (o) => o.title ?? 'Non renseigné' },
                { libelle: 'Type', valeur: (o) => TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type },
                { libelle: 'Demandé', valeur: (o) => jour(o.request_date) ?? 'Non renseigné' },
                { libelle: 'Statut', valeur: (o) => <Puce teinte={TEINTE_STATUT_ORDRE[o.status] ?? 'gris'}>{STATUTS_ORDRE[o.status] ?? o.status}</Puce> },
              ]}
              note="La dernière intervention du planning se saisit à la main (modification) : elle n'est pas déduite des ordres de travail." />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} source="maintenance_schedules (horodatages de création et de modification, date de dernière intervention saisie)"
            absent="Les plannings préventifs ne tiennent pas de journal : seules la création, la dernière modification et la dernière intervention saisie sont connues." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un planning préventif" /> },
      ]}
    />
  );
};
