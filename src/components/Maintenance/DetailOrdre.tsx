import { useEffect, useState } from 'react';
import { CheckCircle, Pencil, PackageMinus, Play, Undo2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail, routeModifier } from '../ui/routeur';
import {
  ATELIERS_ORDRE, COLONNES_ORDRE, MODULE_ORDRES, PRIORITES_ORDRE, STATUTS_ORDRE, TEINTE_STATUT_ORDRE, TYPES_ORDRE, VUE_ORDRES,
  actionOrdreInterdite, coutPieces, modificationOrdreInterdite, type ActionOrdre, type Ordre, type PieceOrdre,
} from './ordres';

// Fiche d'un ordre de travail (D-061, D-090) : informations, engin et site,
// pieces imputees (registre des stocks, D-044) et reservations (D-067),
// historique depuis les horodatages de l'ordre et des mouvements de pieces.
// maintenance_orders ne tient pas de journal : l'ecart est affiche.

interface Reservation {
  id: string; numero: string; stock_item_id: string; warehouse_id: string; quantite: number; quantite_restante: number;
  statut: string; maintenance_order_id: string | null; reserve_le: string | null;
}

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);
const gnf = (v: number | null) => (v !== null && v !== undefined ? `${formatNombre(Number(v), 0)} GNF` : null);
const STATUT_RESERVATION: Record<string, string> = { active: 'Active', consommee: 'Consommée', levee: 'Levée' };

export const DetailOrdre = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const droits = {
    maintenance: hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit'),
    stock: hasPermission('stock', 'create') || hasPermission('stock', 'edit'),
  };
  const [ordre, setOrdre] = useState<Lecture<Ordre>>(attente);
  const [pieces, setPieces] = useState<Lecture<PieceOrdre>>(attente);
  const [reservations, setReservations] = useState<Lecture<Reservation>>(attente);
  const [noms, setNoms] = useState({ engin: '', modele: '', site: '', articles: new Map<string, string>(), depots: new Map<string, string>() });

  useEffect(() => {
    lire<Ordre>(supabase.from('maintenance_orders').select(COLONNES_ORDRE).eq('id', id), 'ordre de travail').then(async (r) => {
      setOrdre(r);
      const o = trouver(r.lignes, id);
      if (!o) return;
      const [v, s] = await Promise.all([
        o.vehicle_id ? supabase.from('vehicles').select('id, registration, brand_model').eq('id', o.vehicle_id) : Promise.resolve({ data: [] }),
        o.site_id ? supabase.from('sites').select('id, name').eq('id', o.site_id) : Promise.resolve({ data: [] }),
      ]);
      const engin = ((v.data ?? []) as { id: string; registration: string; brand_model: string }[]).find((x) => x.id === o.vehicle_id);
      const site = ((s.data ?? []) as { id: string; name: string }[]).find((x) => x.id === o.site_id);
      setNoms((n) => ({ ...n, engin: engin?.registration ?? '', modele: engin?.brand_model ?? '', site: site?.name ?? '' }));
    });
    supabase.rpc('pieces_ordre_travail', { p_ordre: id }).then(({ data, error }) => {
      // Les contre-mouvements d'annulation portent l'ordre (D-072) : le
      // mouvement annule est deja affiche barre, ils ne forment pas une ligne de plus.
      setPieces(error ? { lignes: null, erreur: `Pièces de l'ordre illisibles : ${error.message}` }
        : { lignes: ((data ?? []) as PieceOrdre[]).filter((p) => (p.type_mouvement as string) !== 'annulation'), erreur: '' });
    });
    lire<Reservation>(supabase.from('v_reservations_stock')
      .select('id, numero, stock_item_id, warehouse_id, quantite, quantite_restante, statut, maintenance_order_id, reserve_le').eq('maintenance_order_id', id), 'réservations de l\'ordre')
      .then(async (r) => {
        const lignes = r.lignes && r.lignes.filter((x) => x.maintenance_order_id === id);
        setReservations({ ...r, lignes });
        const articles = [...new Set((lignes ?? []).map((x) => x.stock_item_id))];
        const depots = [...new Set((lignes ?? []).map((x) => x.warehouse_id))];
        if (!articles.length) return;
        const [a, d] = await Promise.all([
          supabase.from('stock_items').select('id, item_code, name').in('id', articles),
          supabase.from('warehouses').select('id, code').in('id', depots),
        ]);
        setNoms((n) => ({
          ...n,
          articles: new Map(((a.data ?? []) as { id: string; item_code: string; name: string }[]).map((x) => [x.id, `${x.item_code} · ${x.name}`])),
          depots: new Map(((d.data ?? []) as { id: string; code: string }[]).map((x) => [x.id, x.code])),
        }));
      });
  }, [id]);

  const o = trouver(ordre.lignes, id);
  const reference = o?.work_order_number ?? o?.title ?? 'Ordre de travail';
  const possible = (a: ActionOrdre) => Boolean(o) && actionOrdreInterdite(a, o?.status ?? '', droits) === null;
  const cout = pieces.lignes ? coutPieces(pieces.lignes) : null;

  const historique: EvenementHistorique[] | null = o && pieces.lignes ? fusionnerHistoriques(
    [
      ...(o.created_at ? [{ id: 'ordre-cree', le: o.created_at, libelle: 'Ordre créé', detail: o.request_date ? `Demandé le ${jour(o.request_date)}` : null, source: 'maintenance_orders.created_at' }] : []),
      ...(o.started_at ? [{ id: 'ordre-demarre', le: o.started_at, libelle: 'Ordre démarré', source: 'maintenance_orders.started_at' }] : []),
      ...(o.completion_date ? [{ id: 'ordre-termine', le: `${o.completion_date}T00:00:00`, libelle: 'Ordre terminé', detail: 'Date de fin enregistrée (sans heure)', source: 'maintenance_orders.completion_date' }] : []),
      ...(o.annule_le ? [{ id: 'ordre-annule', le: o.annule_le, libelle: 'Ordre annulé', motif: o.motif_annulation, auteur: o.annule_par, source: 'maintenance_orders.annule_le' }] : []),
      ...(o.updated_at && o.updated_at !== o.created_at ? [{ id: 'ordre-modifie', le: o.updated_at, libelle: 'Dernière modification enregistrée', source: 'maintenance_orders.updated_at' }] : []),
    ],
    pieces.lignes.map((p) => ({
      id: `piece-${p.mouvement_id}`, le: p.date_mouvement, libelle: `${p.type_mouvement === 'exit' ? 'Sortie' : 'Retour'} de pièce ${p.numero}${p.annule ? ' (annulée)' : ''}`,
      detail: `${p.article_code} · ${p.article_nom} : ${p.quantite} ${p.unite}${p.depot_code ? ` · dépôt ${p.depot_code}` : ''}`, source: 'stock_movements (pieces_ordre_travail)',
    })),
  ) : null;

  const annulerMouvement = (p: PieceOrdre) => ecrireRoute({ vue: VUE_ORDRES, mode: 'action', id, action: 'annuler-mouvement', requete: { mouvement: p.mouvement_id } });

  return (
    <PageDetail
      vue={VUE_ORDRES}
      module={MODULE_ORDRES}
      reference={reference}
      titre={o ? <>{o.work_order_number ?? 'Ordre'} · {o.title ?? o.description}</> : undefined}
      statut={o ? { libelle: STATUTS_ORDRE[o.status] ?? o.status, teinte: TEINTE_STATUT_ORDRE[o.status] ?? 'gris' } : null}
      resume={o && <>{TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type}{noms.engin ? ` · ${noms.engin}` : ''}{o.scheduled_date ? ` · prévue le ${jour(o.scheduled_date)}` : ''}</>}
      chargement={ordre.lignes === null && !ordre.erreur}
      erreur={ordre.erreur}
      introuvable={ordre.lignes !== null && !o}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <Pencil className="h-4 w-4" />, visible: Boolean(o) && modificationOrdreInterdite(o?.status ?? '', droits.maintenance) === null, vers: routeModifier(VUE_ORDRES, id) },
        { id: 'demarrer', libelle: 'Démarrer', icone: <Play className="h-4 w-4" />, visible: possible('demarrer'), ton: 'principal', vers: routeAction(VUE_ORDRES, id, 'demarrer') },
        { id: 'terminer', libelle: 'Terminer', icone: <CheckCircle className="h-4 w-4" />, visible: possible('terminer'), ton: 'principal', vers: routeAction(VUE_ORDRES, id, 'terminer') },
        { id: 'sortir', libelle: 'Sortir du stock', icone: <PackageMinus className="h-4 w-4" />, visible: possible('sortir'), vers: routeAction(VUE_ORDRES, id, 'sortir') },
        { id: 'retourner', libelle: 'Retour au stock', icone: <Undo2 className="h-4 w-4" />, visible: possible('retourner'), vers: routeAction(VUE_ORDRES, id, 'retourner') },
        { id: 'annuler', libelle: 'Annuler l\'ordre', icone: <XCircle className="h-4 w-4" />, visible: possible('annuler'), ton: 'danger', vers: routeAction(VUE_ORDRES, id, 'annuler') },
      ]}
      onglets={!o ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Intervention', champs: [
              ['Numéro', o.work_order_number], ['Intitulé', o.title], ['Description', o.description], ['Type', TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type],
              ['Priorité', o.priority ? PRIORITES_ORDRE[o.priority] ?? o.priority : null], ['Atelier', o.workshop ? ATELIERS_ORDRE[o.workshop] ?? o.workshop : null],
              ['Engin', noms.engin ? `${noms.engin}${noms.modele ? ` · ${noms.modele}` : ''}` : null], ['Site', noms.site || null],
              ['Compteur', o.km_at_maintenance !== null ? `${formatNombre(Number(o.km_at_maintenance), 0)} km` : null], ['Notes', o.notes],
            ] },
            { titre: 'Dates et coûts', champs: [
              ['Demandé le', jour(o.request_date)], ['Prévue le', jour(o.scheduled_date)], ['Démarré le', o.started_at ? new Date(o.started_at).toLocaleString('fr-FR') : null],
              ['Terminé le', jour(o.completion_date)], ['Heures de main d\'œuvre', o.labor_hours !== null ? `${o.labor_hours} h` : null],
              ['Coût main d\'œuvre', gnf(o.labor_cost)], ['Coût estimé', gnf(o.estimated_cost)], ['Coût réel constaté', gnf(o.actual_cost)],
              ['Coût net des pièces', cout ? `${formatNombre(cout.valeur, 0)} GNF${cout.incomplet ? ' (incomplet : au moins un mouvement sans prix)' : ''}` : null],
              ...(o.status === 'cancelled' ? [['Motif d\'annulation', o.motif_annulation] as [string, string | null]] : []),
            ] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Pièces et liens', compte: pieces.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <Relation titre="Engin et site" lignes={[{ cle: 'engin' as const }, ...(o.site_id ? [{ cle: 'site' as const }] : [])]} cle={(l) => l.cle} vide="Aucun lien"
              lien={(l) => (l.cle === 'engin' ? (o.vehicle_id ? routeDetail('vehicles', o.vehicle_id) : routeDetail(VUE_ORDRES, id)) : routeDetail('sites', o.site_id ?? ''))}
              colonnes={[
                { libelle: 'Élément', valeur: (l) => (l.cle === 'engin' ? noms.engin || 'Engin' : noms.site || 'Site') },
                { libelle: 'Nature', valeur: (l) => (l.cle === 'engin' ? 'Engin entretenu' : 'Site de l\'ordre') },
              ]} />
            <Relation titre="Pièces imputées (registre des stocks)" lignes={pieces.lignes} erreur={pieces.erreur} cle={(p) => p.mouvement_id}
              vide="Aucune pièce imputée : les pièces se sortent du registre des stocks par l'action « Sortir du stock »."
              colonnes={[
                { libelle: 'Mouvement', valeur: (p) => <span className={`font-mono text-xs ${p.annule ? 'line-through text-stone-400' : ''}`}>{p.numero}</span> },
                { libelle: 'Date', valeur: (p) => new Date(p.date_mouvement).toLocaleString('fr-FR') },
                { libelle: 'Type', valeur: (p) => `${p.type_mouvement === 'exit' ? 'Sortie' : 'Retour'}${p.annule ? ' (annulé)' : ''}` },
                { libelle: 'Article', valeur: (p) => `${p.article_code} · ${p.article_nom}` },
                { libelle: 'Quantité', valeur: (p) => `${p.quantite} ${p.unite}` },
                { libelle: 'Dépôt', valeur: (p) => p.depot_code ?? 'Non renseigné' },
                { libelle: 'Valeur', valeur: (p) => (p.valeur !== null ? formatNombre(Number(p.valeur), 0) : 'Sans prix') },
                ...(possible('annuler-mouvement') ? [{ libelle: 'Correction', valeur: (p: PieceOrdre) => (p.annule ? null
                  : <a href={annulerMouvement(p)} aria-label={`Annuler ${p.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs font-semibold">Annuler</a>) }] : []),
              ]}
              note={cout && <>Coût net des pièces : <strong>{formatNombre(cout.valeur, 0)} GNF</strong>{cout.incomplet && ' (incomplet : au moins un mouvement sans prix)'} · source : registre des stocks.</>} />
            <Relation titre="Réservations de stock de l'ordre" lignes={reservations.lignes} erreur={reservations.erreur} cle={(r) => r.id} vide="Aucune réservation rattachée à l'ordre"
              colonnes={[
                { libelle: 'Réservation', valeur: (r) => <span className="font-mono text-xs">{r.numero}</span> },
                { libelle: 'Article', valeur: (r) => noms.articles.get(r.stock_item_id) ?? 'Article' },
                { libelle: 'Dépôt', valeur: (r) => noms.depots.get(r.warehouse_id) ?? 'Dépôt' },
                { libelle: 'Reste', valeur: (r) => `${r.quantite_restante} / ${r.quantite}` },
                { libelle: 'Statut', valeur: (r) => <Puce teinte={r.statut === 'active' ? 'bleu' : 'gris'}>{STATUT_RESERVATION[r.statut] ?? r.statut}</Puce> },
              ]} />
            {!droits.stock && <p className="text-xs text-stone-500">La sortie de pièces demande le droit d'écriture sur les stocks (magasin).</p>}
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={pieces.erreur} source="maintenance_orders (horodatages de création, démarrage, fin, annulation, modification), stock_movements"
            absent="Les ordres de travail ne tiennent pas de journal des modifications : seuls les horodatages enregistrés sur l'ordre et les mouvements de pièces sont affichés (la dernière modification écrase la précédente)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un ordre de travail" /> },
      ]}
    />
  );
};
