import { useEffect, useState } from 'react';
import { Ban, PencilLine } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Provenance, Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail, routeModifier } from '../ui/routeur';
import {
  COLONNES_VERSION_BUDGET, MODULE_BUDGETS, VUE_BUDGETS, budgetNonModifiable, chaineVersions, remplacantDe, type SuiviBudget, type VersionBudget,
} from './budgets';

// Fiche d'un budget (D-065, D-090) : suivi budget, engage, realise et
// disponible (v_suivi_budgets, budget courant seulement), depenses retenues
// par le meme rattachement que la vue (nature, devise, site, periode),
// versions successives et historique (creation, revisions, annulation).

interface Depense { categorie: string; origine: string; piece_id: string; piece: string | null; date_operation: string; nature_id: string | null; site_id: string | null;
  devise: string | null; montant: number; base_montant: string; tiers: string | null }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);
const ORIGINES: Record<string, string> = { bon_commande: 'Bon de commande', a_payer: 'Pièce à payer', paiement: 'Paiement', cout: 'Coût' };

export const DetailBudget = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutBudget = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [versions, setVersions] = useState<Lecture<VersionBudget>>(attente);
  const [suivi, setSuivi] = useState<Lecture<SuiviBudget>>(attente);
  const [depenses, setDepenses] = useState<Lecture<Depense>>(attente);
  const [noms, setNoms] = useState<{ nature: string | null; site: string | null }>({ nature: null, site: null });

  useEffect(() => {
    lire<SuiviBudget>(supabase.from('v_suivi_budgets').select('*').eq('id', id), 'suivi du budget').then(setSuivi);
    lire<VersionBudget>(supabase.from('budgets').select(COLONNES_VERSION_BUDGET).order('cree_le'), 'budgets').then(async (r) => {
      setVersions(r);
      const b = trouver(r.lignes, id);
      if (!b) return;
      const [n, s] = await Promise.all([
        supabase.from('natures_depense').select('id, code, libelle').eq('id', b.nature_id),
        b.site_id ? supabase.from('sites').select('id, name').eq('id', b.site_id) : Promise.resolve({ data: [] }),
      ]);
      const nature = ((n.data ?? []) as { id: string; code: string; libelle: string }[]).find((x) => x.id === b.nature_id);
      const site = ((s.data ?? []) as { id: string; name: string }[]).find((x) => x.id === b.site_id);
      setNoms({ nature: nature ? `${nature.code} · ${nature.libelle}` : null, site: site?.name ?? null });
      const d = await lire<Depense>(supabase.from('v_depenses_budgetaires').select('*').eq('nature_id', b.nature_id).eq('devise', b.devise)
        .gte('date_operation', b.periode_debut).lte('date_operation', b.periode_fin).order('date_operation', { ascending: false }), 'dépenses du budget');
      setDepenses({ ...d, lignes: d.lignes && d.lignes.filter((x) => x.nature_id === b.nature_id && x.devise === b.devise && (x.site_id ?? null) === (b.site_id ?? null)
        && x.date_operation >= b.periode_debut && x.date_operation <= b.periode_fin) });
    });
  }, [id]);

  const b = trouver(versions.lignes, id);
  const s = trouver(suivi.lignes, id);
  const courant = Boolean(s);
  const chaine = versions.lignes ? chaineVersions(versions.lignes, id) : null;
  const suivante = versions.lignes ? remplacantDe(versions.lignes, id) : null;
  const modifiable = Boolean(b) && budgetNonModifiable(peutBudget, courant) === null;
  const statut = !b ? null : b.statut === 'annule' ? { libelle: 'Annulé', teinte: 'gris' as const } : suivante ? { libelle: `Révisé (${suivante.numero})`, teinte: 'gris' as const }
    : s?.depassement ? { libelle: `Dépassé (${s.consommation_pct} %)`, teinte: 'rouge' as const } : { libelle: 'Courant', teinte: 'vert' as const };

  const historique: EvenementHistorique[] | null = chaine ? fusionnerHistoriques(
    chaine.map((v) => ({ id: `cree-${v.id}`, le: v.cree_le, libelle: v.remplace_id ? `Révision : ${v.numero}` : `Création : ${v.numero}`,
      detail: `${nombre.format(v.montant_ttc)} ${v.devise} TTC · ${jour(v.periode_debut)} – ${jour(v.periode_fin)}`, motif: v.motif_revision, auteur: v.cree_par, source: 'budgets.cree_le' })),
    chaine.filter((v) => v.annule_le).map((v) => ({ id: `annule-${v.id}`, le: v.annule_le as string, libelle: `Annulation : ${v.numero}`, motif: v.motif_annulation, auteur: v.annule_par, source: 'budgets.annule_le' })),
    suivante ? [{ id: `suivante-${suivante.id}`, le: suivante.cree_le, libelle: `Remplacé par la révision ${suivante.numero}`, motif: suivante.motif_revision, auteur: suivante.cree_par, source: 'budgets.remplace_id' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_BUDGETS}
      module={MODULE_BUDGETS}
      reference={b?.numero ?? 'Budget'}
      titre={b ? `${b.numero}${noms.nature ? ` · ${noms.nature}` : ''}` : undefined}
      statut={statut}
      resume={b && <>{jour(b.periode_debut)} – {jour(b.periode_fin)} · {noms.site ?? (b.site_id ? 'Site' : 'Sans site')} · {nombre.format(b.montant_ttc)} {b.devise} TTC</>}
      chargement={versions.lignes === null && !versions.erreur}
      erreur={versions.erreur}
      introuvable={versions.lignes !== null && !b}
      actions={[
        { id: 'reviser', libelle: 'Réviser', icone: <PencilLine className="h-4 w-4" />, ton: 'principal', visible: modifiable, vers: routeModifier(VUE_BUDGETS, id) },
        { id: 'annuler', libelle: 'Annuler le budget', icone: <Ban className="h-4 w-4" />, ton: 'danger', visible: modifiable, vers: routeAction(VUE_BUDGETS, id, 'annuler') },
      ]}
      onglets={!b ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-3">
            <Informations groupes={[
              { titre: 'Budget', champs: [['Numéro', b.numero], ['Période', `${jour(b.periode_debut)} – ${jour(b.periode_fin)}`], ['Nature de dépense', noms.nature],
                ['Centre (site)', noms.site ?? (b.site_id ? null : 'Sans site')], ['Montant TTC', `${nombre.format(b.montant_ttc)} ${b.devise}`], ['Note', b.note],
                ['Motif de la révision', b.motif_revision], ['Motif de l\'annulation', b.motif_annulation]] },
              { titre: 'Suivi', champs: s ? [
                ['Engagé', `${nombre.format(s.engage)} ${s.devise}`], ['dont bons de commande', nombre.format(s.engage_bons)], ['dont pièces à payer', nombre.format(s.engage_a_payer)],
                ['Réalisé', `${nombre.format(s.realise)} ${s.devise}`], ['dont coûts', nombre.format(s.realise_couts)], ['dont paiements', nombre.format(s.realise_paiements)],
                ['Disponible', <span key="d" className={s.disponible < 0 ? 'text-red-700' : ''}>{nombre.format(s.disponible)} {s.devise}</span>],
                ['Consommation', s.depassement ? <Puce key="c" teinte="rouge">Dépassé ({s.consommation_pct} %)</Puce> : `${s.consommation_pct} %`],
                ['Sources non visibles avec vos droits', s.sources_non_visibles],
              ] : [['Suivi', suivi.erreur || 'Calculé pour le budget courant seulement (annulé ou révisé : voir la version courante).']] },
            ]} />
            <Provenance source="v_suivi_budgets : engagé = bons approuvés ou reçus en partie (HT + taxes) et pièces payables non payées ; réalisé = paiements exécutés et coûts enregistrés" />
          </div>
        ) },
        { id: 'relations', libelle: 'Dépenses et versions', compte: depenses.lignes?.length ?? null, contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Dépenses rattachées (nature, devise, centre et période du budget)" lignes={depenses.lignes} erreur={depenses.erreur} cle={(d) => `${d.origine}-${d.piece_id}`}
              vide="Aucune dépense rattachée visible avec vos droits"
              lien={(d) => (d.origine === 'cout' ? routeDetail('costs', d.piece_id) : d.origine === 'paiement' ? routeDetail('paiements', d.piece_id) : routeDetail(VUE_BUDGETS, id, 'relations'))}
              colonnes={[
                { libelle: 'Pièce', valeur: (d) => d.piece ?? 'sans numéro' },
                { libelle: 'Origine', valeur: (d) => `${ORIGINES[d.origine] ?? d.origine} (${d.categorie === 'engage' ? 'engagé' : 'réalisé'})` },
                { libelle: 'Date', valeur: (d) => jour(d.date_operation) },
                { libelle: 'Montant', valeur: (d) => `${nombre.format(d.montant)} ${d.devise ?? ''}` },
              ]}
              note="Lecture de v_depenses_budgetaires avec vos droits ; les totaux du suivi font foi." />
            <Relation titre="Versions du budget" lignes={chaine} erreur={versions.erreur} cle={(v) => v.id} vide="Aucune version"
              lien={(v) => routeDetail(VUE_BUDGETS, v.id)}
              colonnes={[
                { libelle: 'Numéro', valeur: (v) => v.numero },
                { libelle: 'Montant TTC', valeur: (v) => `${nombre.format(v.montant_ttc)} ${v.devise}` },
                { libelle: 'Créée le', valeur: (v) => new Date(v.cree_le).toLocaleDateString('fr-FR') },
                { libelle: 'État', valeur: (v) => (v.statut === 'annule' ? 'Annulée' : v.id === id && !suivante ? 'Courante' : 'Révisée') },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={versions.erreur} source="budgets (cree_le, annule_le, remplace_id et motifs des versions)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un budget" /> },
      ]}
    />
  );
};
