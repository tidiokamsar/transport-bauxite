import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation, type ActionPage } from '../ui/PageDetail';
import { ListePieces } from '../ui/PiecesJointes';
import { Provenance, Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { routeModifier } from '../ui/routeur';
import { MOTIF_ANNULATION_RECEPTION, TYPES_OPERATION, etatAffiche, texteKm, type EtatPneu } from './pneus';
import {
  CATEGORIES_COUT, COLONNES_INTERVENTION, DECISIONS_REMISE, LIBELLE_GRAVITE, MODULE_PNEUS, NATURES_INSPECTION, RECOMMANDATIONS,
  STATUTS_INTERVENTION, STATUTS_PROPOSITION, TEINTE_GRAVITE, TYPES_INTERVENTION, VUE_PNEUS, date, dateHeure, droitsPneus, gnf,
  indicateur, lireAlertesPneus, nombre, routeActionPneu, useLecture, NATURES_EPISODE,
  type AlertePneu, type Inspection, type Intervention, type PneuLigne, type Proposition,
} from './socle';

// Fiche d'un pneu (D-090, D-091) : identite permanente, caracteristiques,
// position, montages, inspections, interventions, rechapages, couts, pieces,
// alertes et chronologie ; actions selon les droits et l'etat de la carcasse.

interface Carcasse {
  id: string; tire_number: string; code_sigtb: string; numero_serie: string | null; sans_numero_motif: string | null;
  brand: string | null; model: string | null; dimension: string | null; construction: string | null; indice_charge: string | null;
  indice_vitesse: string | null; application: string | null; date_fabrication: string | null; code_dot: string | null;
  commande_id: string | null; facture_reference: string | null; prix_source: string | null; purchase_price: number | null;
  purchase_date: string | null; fournisseur_id: string | null; garantie_mois: number | null; garantie_km: number | null;
  profondeur_initiale_mm: number | null; max_retreads: number | null; retread_count: number | null; status: EtatPneu;
  vehicle_id: string | null; position: string | null; site_id: string | null; installation_date: string | null; notes: string | null;
  created_at: string | null;
}
interface Montage { montage_id: string; vehicle_id: string; monte_le: string; km_montage: number | null; demonte_le: string | null; km_demontage: number | null; km_parcourus: number | null }
interface Operation { id: string; type: string; effectue_le: string; vehicle_id: string | null; position: string | null; position_precedente: string | null; site_id: string | null; compteur_km: number | null; profondeur_mm: number | null; cout: number | null; prestataire: string | null; reference_piece: string | null; motif: string | null; note: string | null; annule_operation_id: string | null; saisi_par: string | null; saisi_le: string }
interface Cout { categorie: string; montant: number | null; source: string | null; deja_compte_achats: boolean; date_cout: string | null; operation_id: string | null }
interface Episode { numero_episode: number; nature: string; cycle_rechapage: number; debut: string; fin: string | null; intervention_id: string | null }
interface Indic { cout_total: number | null; km: number | null; heures: number | null; tonnes: number | null; cout_km: number | null; cout_heure: number | null; cout_tonne: number | null }

const LIEN = 'font-semibold text-orange-800 hover:underline';
const OUVERTES = ['envoyee', 'retournee', 'controlee'];
const PRIX_SOURCE: Record<string, string> = { bon_commande: 'Bon de commande', facture: 'Facture', saisie: 'Saisie' };

export const DetailPneu = ({ id }: { id: string }) => {
  const { hasPermission, profile, user } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const carc = useLecture<Carcasse>(() => supabase.from('tires').select('*').eq('id', id), 'pneu', [id]);
  const vue = useLecture<PneuLigne>(() => supabase.from('v_pneus').select('*').eq('id', id), 'pneu (calculs)', [id]);
  const montages = useLecture<Montage>(() => supabase.from('v_pneus_montages').select('*').eq('tire_id', id).order('monte_le', { ascending: false }), 'montages', [id]);
  const insp = useLecture<Inspection>(() => supabase.from('pneus_inspections').select('*').eq('tire_id', id).order('inspecte_le', { ascending: false }), 'inspections', [id]);
  const itv = useLecture<Intervention>(() => supabase.from('pneus_interventions').select(COLONNES_INTERVENTION).eq('tire_id', id).order('envoye_le', { ascending: false }), 'interventions', [id]);
  const ops = useLecture<Operation>(() => supabase.from('pneus_operations').select('*').eq('tire_id', id).order('effectue_le', { ascending: false }), 'journal des opérations', [id]);
  const episodes = useLecture<Episode>(() => supabase.from('v_pneus_episodes').select('*').eq('tire_id', id).order('numero_episode'), 'épisodes', [id]);
  const couts = useLecture<Cout>(() => supabase.from('v_pneus_couts').select('*').eq('tire_id', id), 'coûts', [id]);
  const indic = useLecture<Indic>(() => supabase.from('v_pneus_indicateurs').select('*').eq('tire_id', id), 'indicateurs', [id]);
  const props = useLecture<Proposition>(() => supabase.from('pneus_propositions_immobilisation').select('*').eq('tire_id', id).order('propose_le', { ascending: false }), 'propositions', [id]);
  const engins = useLecture<{ id: string; registration: string }>(() => supabase.from('vehicles').select('id, registration'), 'engins');
  const sites = useLecture<{ id: string; name: string }>(() => supabase.from('sites').select('id, name'), 'sites');
  const fournisseur = useLecture<{ id: string; company_name: string }>(() => supabase.from('suppliers').select('id, company_name'), 'fournisseurs');
  const [alertes, setAlertes] = useState<AlertePneu[] | null>(null);
  useEffect(() => { lireAlertesPneus().then((r) => setAlertes((r.lignes ?? []).filter((a) => a.tire_id === id))); }, [id]);

  const nomEngin = useMemo(() => new Map((engins.lignes ?? []).map((v) => [v.id, v.registration])), [engins.lignes]);
  const nomSite = useMemo(() => new Map((sites.lignes ?? []).map((s) => [s.id, s.name])), [sites.lignes]);
  const t = carc.lignes?.[0] ?? null;
  const v = vue.lignes?.[0] ?? null;
  const i0 = indic.lignes?.[0] ?? null;
  const annule = (ops.lignes ?? []).some((o) => o.type === 'annulation' && (o.motif ?? '').startsWith(MOTIF_ANNULATION_RECEPTION));
  const ouverte = (itv.lignes ?? []).find((i) => OUVERTES.includes(i.statut)) ?? null;
  const proposition = (props.lignes ?? []).find((p) => p.statut === 'proposee') ?? null;
  const etat = t?.status;
  const w = droits.ecriture && !annule;
  const separe = ouverte && user && (ouverte.retour_par === user.id || ouverte.controle_par === user.id);

  const a = (idAction: string, libelle: string, visible: boolean, ton: ActionPage['ton'] = 'secondaire'): ActionPage =>
    ({ id: idAction, libelle, visible, ton, vers: routeActionPneu(id, idAction) });
  const actions: ActionPage[] = [
    a('monter', 'Monter', w && etat === 'stored', 'principal'),
    a('demonter', 'Démonter', w && etat === 'active'),
    a('permuter', 'Permuter', w && etat === 'active'),
    a('inspecter', 'Inspecter', w && (etat === 'stored' || etat === 'active' || etat === 'damaged'), etat === 'active' ? 'principal' : 'secondaire'),
    a('transferer', 'Transférer', w && (etat === 'stored' || etat === 'damaged')),
    a('envoyer-intervention', 'Envoyer en intervention', w && (etat === 'stored' || etat === 'damaged') && !ouverte),
    a('retour-intervention', 'Retour d\'intervention', w && ouverte?.statut === 'envoyee', 'principal'),
    a('annuler-intervention', 'Annuler l\'intervention', w && ouverte?.statut === 'envoyee', 'danger'),
    a('controler-intervention', 'Contrôler', w && ouverte?.statut === 'retournee', 'principal'),
    a('decider-remise-en-service', 'Décider la remise en service', droits.approbation && ouverte?.statut === 'controlee' && !separe, 'principal'),
    a('proposer-immobilisation', 'Proposer une immobilisation', w && etat === 'active' && !proposition, 'danger'),
    a('decider-immobilisation', 'Décider l\'immobilisation', droits.decisionImmobilisation && Boolean(proposition), 'danger'),
    a('reformer', 'Réformer', w && (etat === 'stored' || etat === 'damaged'), 'danger'),
    { id: 'corriger', libelle: 'Corriger', visible: w && etat !== 'retired', vers: routeModifier(VUE_PNEUS, id) },
  ];

  const statut = t ? etatAffiche(t.status, annule) : null;
  const interventions = (itv.lignes ?? []).filter((i) => i.type !== 'rechapage');
  const rechapages = (itv.lignes ?? []).filter((i) => i.type === 'rechapage');
  const colonnesItv = [
    { libelle: 'Numéro', valeur: (i: Intervention) => i.numero },
    { libelle: 'Type', valeur: (i: Intervention) => (i.type === 'autre' ? i.type_autre : TYPES_INTERVENTION[i.type]) ?? i.type },
    { libelle: 'Prestataire', valeur: (i: Intervention) => i.prestataire },
    { libelle: 'Envoi / retour', valeur: (i: Intervention) => `${date(i.envoye_le)} → ${date(i.retour_le) ?? '…'}` },
    { libelle: 'Statut', valeur: (i: Intervention) => <Puce teinte={STATUTS_INTERVENTION[i.statut]?.teinte ?? 'gris'}>{STATUTS_INTERVENTION[i.statut]?.texte ?? i.statut}</Puce> },
    { libelle: 'Contrôle', valeur: (i: Intervention) => (i.controle_resultat ? `${i.controle_resultat === 'conforme' ? 'Conforme' : 'Non conforme'}${i.controle_note ? ` : ${i.controle_note}` : ''}` : '—') },
    { libelle: 'Décision', valeur: (i: Intervention) => (i.decision ? `${DECISIONS_REMISE[i.decision]}${i.decision_motif ? ` : ${i.decision_motif}` : ''}` : i.motif_annulation ? `Annulée : ${i.motif_annulation}` : '—') },
    { libelle: 'Coût', valeur: (i: Intervention) => gnf(i.cout) ?? (i.retour_le ? 'Non renseigné' : '—') },
  ];

  const chronologie: EvenementHistorique[] = fusionnerHistoriques(
    (ops.lignes ?? []).map((o) => ({
      id: `op-${o.id}`, le: o.effectue_le, libelle: TYPES_OPERATION[o.type] ?? o.type, auteur: o.saisi_par, motif: o.motif, source: 'pneus_operations',
      detail: [o.vehicle_id && `engin ${nomEngin.get(o.vehicle_id) ?? ''}`, o.position && `position ${o.position_precedente ? `${o.position_precedente} → ` : ''}${o.position}`,
        o.site_id && `site ${nomSite.get(o.site_id) ?? ''}`, o.compteur_km !== null && `${nombre(o.compteur_km, 'km', 0)}`,
        o.profondeur_mm !== null && `${nombre(o.profondeur_mm, 'mm')}`, o.cout !== null && gnf(o.cout), o.prestataire, o.reference_piece && `pièce ${o.reference_piece}`, o.note,
        `saisi le ${dateHeure(o.saisi_le)}`].filter(Boolean).join(' · '),
    })),
    (itv.lignes ?? []).flatMap((i) => [
      i.controle_le ? { id: `ctl-${i.id}`, le: i.controle_le, libelle: `Contrôle ${i.numero}`, auteur: i.controle_par, detail: i.controle_resultat, motif: i.controle_note, source: 'pneus_interventions' } : null,
      i.decide_le ? { id: `dec-${i.id}`, le: i.decide_le, libelle: `Décision ${i.numero} : ${DECISIONS_REMISE[i.decision ?? ''] ?? i.decision}`, auteur: i.decide_par, motif: i.decision_motif, source: 'pneus_interventions' } : null,
    ].filter((e): e is NonNullable<typeof e> => e !== null)),
    (props.lignes ?? []).flatMap((p) => [
      { id: `prop-${p.id}`, le: p.propose_le, libelle: 'Proposition d\'immobilisation', auteur: p.propose_par, motif: p.motif, source: 'pneus_propositions_immobilisation' },
      ...(p.decide_le ? [{ id: `propd-${p.id}`, le: p.decide_le, libelle: `Proposition ${STATUTS_PROPOSITION[p.statut]?.texte.toLowerCase() ?? p.statut}`, auteur: p.decide_par, motif: p.motif_decision, source: 'pneus_propositions_immobilisation' }] : []),
    ]),
  );

  const erreur = [carc.erreur, vue.erreur].filter(Boolean).join(' ');
  return (
    <PageDetail
      vue={VUE_PNEUS} module={MODULE_PNEUS} reference={t?.code_sigtb ?? 'Pneu'}
      titre={t ? `${t.code_sigtb}${t.numero_serie ? ` · ${t.numero_serie}` : ''}` : undefined}
      statut={statut ? { libelle: statut.texte, teinte: statut.teinte } : null}
      resume={t ? [t.brand, t.model, t.dimension].filter(Boolean).join(' · ') || 'Caractéristiques non renseignées' : undefined}
      actions={actions}
      chargement={carc.lignes === null && !erreur}
      erreur={erreur || undefined}
      introuvable={carc.lignes !== null && !t}
      onglets={!t ? [] : [
        {
          id: 'synthese', libelle: 'Synthèse', contenu: (
            <Informations groupes={[
              { titre: 'État', champs: [
                ['État', statut?.texte], ['Engin', t.vehicle_id ? nomEngin.get(t.vehicle_id) ?? 'Engin' : null], ['Position', t.position],
                ['Site', t.site_id ? nomSite.get(t.site_id) : null], ['Alertes actives', alertes ? alertes.length : null],
                ['Intervention en cours', ouverte ? `${ouverte.numero} (${STATUTS_INTERVENTION[ouverte.statut]?.texte})` : null],
              ] },
              { titre: 'Usage et coûts', champs: [
                ['Dernière profondeur', v?.derniere_profondeur_mm !== null && v ? `${nombre(v.derniere_profondeur_mm, 'mm')} le ${date(v.profondeur_mesuree_le)}` : 'Sans données'],
                ['Km parcourus', v ? texteKm(v.km_parcourus, v.km_incomplet, v.nb_montages) : null],
                ['Rechapages', `${t.retread_count ?? 0}${t.max_retreads !== null ? ` / ${t.max_retreads} admis` : ''}`],
                ['Coût total', i0 ? gnf(i0.cout_total) ?? 'Données insuffisantes' : null],
                ['Coût / km', i0 ? indicateur(i0.cout_km, 'GNF/km') : null],
              ] },
            ]} />
          ),
        },
        {
          id: 'identification', libelle: 'Identification', contenu: (
            <Informations groupes={[
              { titre: 'Identité', champs: [
                ['Code SIGTB (permanent)', t.code_sigtb], ['Numéro de série fabricant', t.numero_serie],
                ['Créé sans numéro, motif', t.sans_numero_motif], ['Numéro saisi', t.tire_number], ['Code DOT', t.code_dot],
                ['Date de fabrication', date(t.date_fabrication)], ['Enregistré le', dateHeure(t.created_at)],
              ] },
              { titre: 'Acquisition', champs: [
                ['Fournisseur', t.fournisseur_id ? (fournisseur.lignes ?? []).find((f) => f.id === t.fournisseur_id)?.company_name ?? 'Fournisseur' : null],
                ['Date d\'achat', date(t.purchase_date)], ['Prix', gnf(t.purchase_price)], ['Source du prix', t.prix_source ? PRIX_SOURCE[t.prix_source] : null],
                ['Facture', t.facture_reference], ['Bon de commande', t.commande_id ? 'Lié (Achats)' : null],
              ] },
            ]} />
          ),
        },
        {
          id: 'caracteristiques', libelle: 'Caractéristiques', contenu: (
            <Informations groupes={[
              { titre: 'Fabricant', champs: [['Marque', t.brand], ['Modèle', t.model], ['Dimension', t.dimension], ['Construction', t.construction],
                ['Indice de charge', t.indice_charge], ['Indice de vitesse', t.indice_vitesse], ['Application', t.application]] },
              { titre: 'Garantie et usure', champs: [['Garantie', t.garantie_mois ? `${t.garantie_mois} mois` : null], ['Garantie (km)', nombre(t.garantie_km, 'km', 0)],
                ['Profondeur initiale', nombre(t.profondeur_initiale_mm, 'mm')], ['Rechapages admis', t.max_retreads], ['Note', t.notes]] },
            ]} />
          ),
        },
        {
          id: 'position', libelle: 'Position actuelle', contenu: (
            <Informations groupes={[{ titre: 'Position', champs: t.status === 'active'
              ? [['Engin', t.vehicle_id ? <a href={`#/${VUE_PNEUS}/engin-${t.vehicle_id}`} className={LIEN}>{nomEngin.get(t.vehicle_id) ?? 'Engin'} (schéma)</a> : null],
                ['Position', t.position], ['Monté le', date(montages.lignes?.[0]?.monte_le ?? t.installation_date)],
                ['Compteur au montage', nombre(montages.lignes?.[0]?.km_montage, 'km', 0)]]
              : [['Lieu', t.status === 'en_intervention' ? `Chez le prestataire${ouverte ? ` (${ouverte.prestataire})` : ''}` : t.site_id ? `Stock : ${nomSite.get(t.site_id) ?? 'site'}` : null],
                ['État', statut?.texte]] }]} />
          ),
        },
        {
          id: 'montages', libelle: 'Montages', compte: montages.lignes?.length, contenu: (
            <Relation titre="Montages" lignes={montages.lignes} erreur={montages.erreur} vide="Jamais monté" cle={(m) => m.montage_id}
              colonnes={[
                { libelle: 'Engin', valeur: (m) => nomEngin.get(m.vehicle_id) ?? 'Engin' },
                { libelle: 'Monté le', valeur: (m) => date(m.monte_le) },
                { libelle: 'Démonté le', valeur: (m) => date(m.demonte_le) ?? 'En service' },
                { libelle: 'Compteurs', valeur: (m) => `${nombre(m.km_montage, 'km', 0) ?? '?'} → ${nombre(m.km_demontage, 'km', 0) ?? '…'}` },
                { libelle: 'Km parcourus', valeur: (m) => nombre(m.km_parcourus, 'km', 0) ?? 'Sans données' },
              ]} />
          ),
        },
        {
          id: 'inspections', libelle: 'Inspections', compte: insp.lignes?.length, contenu: (
            <Relation titre="Inspections" lignes={insp.lignes} erreur={insp.erreur} vide="Aucune inspection" cle={(i) => i.id}
              colonnes={[
                { libelle: 'Le', valeur: (i) => dateHeure(i.inspecte_le) },
                { libelle: 'Nature', valeur: (i) => NATURES_INSPECTION[i.nature] ?? i.nature },
                { libelle: 'Mesures', valeur: (i) => (i.mesures ? Object.entries(i.mesures).map(([z, p]) => `${z} ${nombre(p, 'mm')}`).join(', ') : '—') },
                { libelle: 'Pression / temp.', valeur: (i) => [nombre(i.pression_bar, 'bar'), nombre(i.temperature_c, '°C')].filter(Boolean).join(' · ') || '—' },
                { libelle: 'Constats', valeur: (i) => (i.constats?.length ? i.constats.map((c) => `${c.code} (${c.gravite})${c.description ? ` ${c.description}` : ''}`).join(' ; ') : '—') },
                { libelle: 'Recommandation', valeur: (i) => (i.recommandation ? RECOMMANDATIONS[i.recommandation] : '—') },
                { libelle: 'Pièces', valeur: (i) => <details><summary className="cursor-pointer text-xs text-orange-800">Voir</summary><ListePieces objetType="pneu_inspection" objetId={i.id} peutDeposer={w} /></details> },
              ]} />
          ),
        },
        {
          id: 'interventions', libelle: 'Interventions', compte: interventions.length, contenu: (
            <Relation titre="Interventions (réparation, vulcanisation, expertise, autre)" lignes={itv.lignes ? interventions : null} erreur={itv.erreur}
              vide="Aucune intervention" cle={(i) => i.id} colonnes={[...colonnesItv,
                { libelle: 'Pièces', valeur: (i: Intervention) => <details><summary className="cursor-pointer text-xs text-orange-800">Voir</summary><ListePieces objetType="pneu_intervention" objetId={i.id} peutDeposer={w} /></details> }]}
              note={separe ? 'Vous avez enregistré le retour ou fait le contrôle : la décision revient à un autre approbateur (séparation des tâches).' : undefined} />
          ),
        },
        {
          id: 'rechapages', libelle: 'Rechapages', compte: rechapages.length, contenu: (
            <div className="space-y-4">
              <Relation titre="Rechapages" lignes={itv.lignes ? rechapages : null} erreur={itv.erreur} vide="Aucun rechapage" cle={(i) => i.id}
                colonnes={[...colonnesItv, { libelle: 'Cycle', valeur: (i: Intervention) => i.cycle_rechapage ?? '—' },
                  { libelle: 'Critères', valeur: (i: Intervention) => (i.criteres ? Object.entries(i.criteres).map(([k, ok]) => `${k} ${ok ? 'oui' : 'non'}`).join(', ') : '—') }]} />
              <Relation titre="Épisodes de service" lignes={episodes.lignes} erreur={episodes.erreur} vide="Aucun épisode" cle={(e) => String(e.numero_episode)}
                colonnes={[
                  { libelle: 'Épisode', valeur: (e) => e.numero_episode }, { libelle: 'Nature', valeur: (e) => NATURES_EPISODE[e.nature] ?? e.nature },
                  { libelle: 'Cycle', valeur: (e) => e.cycle_rechapage }, { libelle: 'Début', valeur: (e) => date(e.debut) }, { libelle: 'Fin', valeur: (e) => date(e.fin) ?? 'En cours' },
                ]} />
            </div>
          ),
        },
        {
          id: 'couts', libelle: 'Coûts', compte: couts.lignes?.length, contenu: (
            <div className="space-y-4">
              <Relation titre="Coûts" lignes={couts.lignes} erreur={couts.erreur} vide="Aucun coût" cle={(c) => `${c.categorie}-${c.operation_id ?? 'achat'}`}
                colonnes={[
                  { libelle: 'Catégorie', valeur: (c) => CATEGORIES_COUT[c.categorie] ?? c.categorie }, { libelle: 'Date', valeur: (c) => date(c.date_cout) ?? '—' },
                  { libelle: 'Montant', valeur: (c) => gnf(c.montant) ?? 'Non renseigné' }, { libelle: 'Pièce', valeur: (c) => (c.source ? PRIX_SOURCE[c.source] ?? c.source : '—') },
                  { libelle: 'Déjà dans les achats', valeur: (c) => (c.deja_compte_achats ? 'Oui' : 'Non') },
                ]} />
              <Informations groupes={[{ titre: 'Indicateurs (serveur)', champs: [
                ['Coût total', i0 ? gnf(i0.cout_total) ?? 'Données insuffisantes' : null], ['Km', nombre(i0?.km, 'km', 0)], ['Heures', nombre(i0?.heures, 'h')], ['Tonnes', nombre(i0?.tonnes, 't')],
                ['Coût / km', indicateur(i0?.cout_km, 'GNF/km')], ['Coût / heure', indicateur(i0?.cout_heure, 'GNF/h')], ['Coût / tonne', indicateur(i0?.cout_tonne, 'GNF/t')],
              ] }]} />
            </div>
          ),
        },
        { id: 'documents', libelle: 'Documents', contenu: <OngletPieces objetType="pneu" objetId={id} peutDeposer={w} libelleObjet="ce pneu" /> },
        {
          id: 'alertes', libelle: 'Alertes', compte: alertes?.length, contenu: (
            <div className="space-y-4">
              <Relation titre="Alertes actives" lignes={alertes} vide="Aucune alerte active" cle={(x) => x.id}
                colonnes={[
                  { libelle: 'Gravité', valeur: (x) => <Puce teinte={TEINTE_GRAVITE[x.severity] ?? 'gris'}>{LIBELLE_GRAVITE[x.severity] ?? x.severity}</Puce> },
                  { libelle: 'Alerte', valeur: (x) => x.title }, { libelle: 'Détail', valeur: (x) => x.message || '—' },
                  { libelle: 'Depuis', valeur: (x) => dateHeure(x.survenu_le ?? x.created_at) },
                ]} />
              <Relation titre="Propositions d'immobilisation" lignes={props.lignes} erreur={props.erreur} vide="Aucune proposition" cle={(p) => p.id}
                colonnes={[
                  { libelle: 'Proposée le', valeur: (p) => dateHeure(p.propose_le) }, { libelle: 'Motif', valeur: (p) => p.motif },
                  { libelle: 'Statut', valeur: (p) => <Puce teinte={STATUTS_PROPOSITION[p.statut]?.teinte ?? 'gris'}>{STATUTS_PROPOSITION[p.statut]?.texte ?? p.statut}</Puce> },
                  { libelle: 'Décision', valeur: (p) => p.motif_decision ?? '—' },
                ]} />
              <Provenance source="alerts (règles D-091), pneus_propositions_immobilisation" />
            </div>
          ),
        },
        {
          id: 'chronologie', libelle: 'Chronologie', contenu: (
            <Historique evenements={ops.lignes ? chronologie : null} erreur={ops.erreur} source="pneus_operations, pneus_interventions, pneus_propositions_immobilisation" />
          ),
        },
      ]}
    />
  );
};
