import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Download, Gauge, PackagePlus, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Relation } from '../ui/PageDetail';
import { Provenance, Puce } from '../ui/Panneau';
import { ecrireRoute, routeDetail, routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { ParcoursCarburant } from './ParcoursCarburant';
import { LIBELLE_STATUT_DECISION, VUE_STOCKS, idRoute, lireIdRoute } from './carburant';
import { alerteStockage, LIBELLE_MOUVEMENT, LIBELLE_TYPE_STOCKAGE, type Stock } from './stocks';
import { ActionStockage, FicheStockage, FormulaireStockage } from './PagesStockage';
import { ActionInventaire, ActionMouvement, FicheInventaire, FicheMouvement } from './PagesMouvement';
import { FormulaireInventaire, FormulaireReception, FormulaireTransfert } from './FormulairesRegistre';
import { COLONNES_INVENTAIRE, COLONNES_MOUVEMENT, litres, type Inventaire, type Mouvement } from './registre';

// Registre des mouvements de carburant (D-041) au standard des pages
// (D-090) : le stock est la somme des mouvements valides. Toute saisie
// (reception, transfert, inventaire, distribution par fiche ou plein)
// attend la decision d'une autre personne ; une erreur se corrige par
// annulation (contre-mouvement), jamais par modification ou suppression.
// Une vue, trois objets : stockage (identifiant brut), mouvement et
// inventaire (identifiants prefixes, voir carburant.ts).

export const StocksCarburantView = () => {
  const route = useRoute();
  if (route.vue !== VUE_STOCKS || route.mode === 'liste') return <ListeStockages />;
  if (route.mode === 'nouveau') {
    if (route.requete.objet === 'reception') return <FormulaireReception stockage={route.requete.stockage} livraison={route.requete.livraison} />;
    if (route.requete.objet === 'transfert') return <FormulaireTransfert source={route.requete.stockage} />;
    if (route.requete.objet === 'inventaire') return <FormulaireInventaire stockage={route.requete.stockage} />;
    return <FormulaireStockage />;
  }
  const { objet, id } = lireIdRoute(route.id ?? '', ['mouvement', 'inventaire']);
  if (objet === 'mouvement') return route.mode === 'action' && route.action ? <ActionMouvement id={id} action={route.action} /> : <FicheMouvement id={id} />;
  if (objet === 'inventaire') return route.mode === 'action' && route.action ? <ActionInventaire id={id} action={route.action} /> : <FicheInventaire id={id} />;
  if (route.mode === 'modifier') return <FormulaireStockage id={id} />;
  if (route.mode === 'action' && route.action) return <ActionStockage id={id} action={route.action} />;
  return <FicheStockage id={id} />;
};

interface AValider { cle: string; vers: string; libelle: string; stockage: string; quantite: string; date: string; detail: string }

const BOUTON = 'flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm';

const ListeStockages = () => {
  const { hasPermission } = useAuth();
  const { sites } = useSite();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [stocks, setStocks] = useState<Stock[] | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[] | null>(null);
  const [inventaires, setInventaires] = useState<Inventaire[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurRegistre, setErreurRegistre] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [s, m, i] = await Promise.all([
      supabase.from('v_stocks_carburant').select('*').order('code'),
      supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).order('numero', { ascending: false }).limit(300),
      supabase.from('inventaires_carburant').select(COLONNES_INVENTAIRE).order('date_mesure', { ascending: false }).limit(100),
    ]);
    setErreur(s.error ? `Stockages indisponibles : ${s.error.message}` : '');
    setStocks(s.error ? null : ((s.data ?? []) as Stock[]));
    setErreurRegistre(m.error ? `Registre indisponible : ${m.error.message}` : i.error ? `Inventaires indisponibles : ${i.error.message}` : '');
    setMouvements(m.error ? null : ((m.data ?? []) as Mouvement[]));
    setInventaires(i.error ? null : ((i.data ?? []) as Inventaire[]));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const code = useMemo(() => new Map((stocks ?? []).map((s) => [s.id, s.code])), [stocks]);

  const aValider: AValider[] | null = mouvements && inventaires ? [
    ...inventaires.filter((i) => i.statut === 'a_valider').map((i) => ({
      cle: `i-${i.id}`, vers: routeDetail(VUE_STOCKS, idRoute('inventaire', i.id)), libelle: 'Inventaire', stockage: code.get(i.stockage_id) ?? '—',
      quantite: `mesuré ${litres(i.volume_mesure)} · écart ${litres(i.ecart)}`, date: i.date_mesure,
      detail: i.solde_theorique === null ? 'Ouverture (sans solde théorique)' : `théorique ${litres(i.solde_theorique)}`,
    })),
    ...mouvements.filter((m, idx, t) => m.statut === 'a_valider' && (!m.transfert_id || t.findIndex((x) => x.transfert_id === m.transfert_id && x.statut === 'a_valider') === idx)).map((m) => ({
      cle: `m-${m.id}`, vers: routeDetail(VUE_STOCKS, idRoute('mouvement', m.id)), libelle: `n° ${m.numero} · ${LIBELLE_MOUVEMENT[m.type]}${m.transfert_id ? ' (sortie et entrée)' : ''}`,
      stockage: code.get(m.stockage_id) ?? '—', quantite: `${formatNombre(Number(m.variation), 0)} L`, date: m.date_mouvement,
      detail: [m.reference_piece, m.note].filter(Boolean).join(' · '),
    })),
  ] : null;

  const colonnes = useMemo<ColonneListe<Stock>[]>(() => [
    { id: 'code', libelle: 'Code', valeur: (s) => s.code, rendu: (s) => <><span className="font-mono font-semibold">{s.code}</span> <span className="text-stone-500">{s.libelle}</span></> },
    { id: 'libelle', libelle: 'Libellé', valeur: (s) => s.libelle, masquee: true },
    { id: 'type', libelle: 'Type', valeur: (s) => LIBELLE_TYPE_STOCKAGE[s.type] },
    { id: 'site', libelle: 'Site', valeur: (s) => nomSite.get(s.site_id) ?? null },
    { id: 'solde', libelle: 'Stock validé', valeur: (s) => s.solde_litres, alignement: 'droite',
      rendu: (s) => (s.solde_litres === null ? <span className="text-stone-400">sans données</span> : <b>{litres(s.solde_litres)}</b>) },
    { id: 'attente', libelle: 'En attente', valeur: (s) => Number(s.en_attente_litres), alignement: 'droite',
      rendu: (s) => (s.mouvements_en_attente ? `${formatNombre(Number(s.en_attente_litres), 0)} L (${s.mouvements_en_attente})` : '—') },
    { id: 'capacite', libelle: 'Capacité', valeur: (s) => Number(s.capacite_litres), rendu: (s) => litres(s.capacite_litres), alignement: 'droite' },
    { id: 'inventaire', libelle: 'Dernier inventaire', valeur: (s) => s.dernier_inventaire,
      rendu: (s) => (s.dernier_inventaire ? `${new Date(s.dernier_inventaire).toLocaleDateString('fr-FR')} (écart ${litres(s.dernier_ecart_inventaire)})` : '—') },
    { id: 'alerte', libelle: 'Alerte', valeur: (s) => alerteStockage(s)?.texte ?? null,
      rendu: (s) => { const a = alerteStockage(s); return a && <Puce teinte={a.teinte}>{a.texte}</Puce>; } },
  ], [nomSite]);
  const filtres = useMemo<FiltreListe<Stock>[]>(() => [
    { id: 'type', libelle: 'Type', options: Object.entries(LIBELLE_TYPE_STOCKAGE).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (s, v) => s.type === v },
    { id: 'actif', libelle: 'État', options: [{ valeur: 'oui', libelle: 'Actifs' }, { valeur: 'non', libelle: 'Inactifs' }], correspond: (s, v) => s.actif === (v === 'oui') },
  ], []);

  const exporterRegistre = () => exportToCSV((mouvements ?? []).map((m) => ({
    numero: m.numero, date: m.date_mouvement, stockage: code.get(m.stockage_id) ?? '', type: LIBELLE_MOUVEMENT[m.type],
    variation_litres: m.variation, piece: m.reference_piece ?? '', statut: m.statut, note: m.note ?? '', motif_decision: m.motif_decision ?? '',
  })), 'registre-carburant');
  const nouveau = (objet: string) => ecrireRoute({ vue: VUE_STOCKS, mode: 'nouveau', requete: { objet } });

  return (
    <div className="space-y-5">
      <ParcoursCarburant vue={VUE_STOCKS} />
      <PageListe
        vue={VUE_STOCKS}
        titre="Réceptions, cuves et inventaires"
        sousTitre="Stock calculé depuis les mouvements validés. Aucun solde ne se saisit ni ne se modifie."
        lignes={stocks}
        erreur={erreur}
        colonnes={colonnes}
        filtres={filtres}
        placeholderRecherche="Rechercher un stockage..."
        cle={(s) => s.id}
        libelleOuverture={(s) => `Fiche ${s.code}`}
        actions={<>
          {peutEcrire && <>
            <a href={nouveau('reception')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow"><PackagePlus className="h-4 w-4" /> Réception CBG</a>
            <a href={nouveau('transfert')} className={BOUTON}><ArrowRightLeft className="h-4 w-4" /> Transfert</a>
            <a href={nouveau('inventaire')} className={BOUTON}><Gauge className="h-4 w-4" /> Inventaire</a>
            <a href={routeNouveau(VUE_STOCKS)} className={BOUTON}><Plus className="h-4 w-4" /> Stockage</a>
          </>}
          <button type="button" onClick={exporterRegistre} disabled={!mouvements?.length} className={`${BOUTON} disabled:opacity-50`}><Download className="h-4 w-4" /> Exporter le registre</button>
        </>}
        nomExport="stockages-carburant"
        vide={{ message: 'Aucun stockage déclaré', detail: 'Déclarez chaque cuve fixe ou citerne mobile, puis son inventaire d\'ouverture.' }}
        onActualiser={charger}
        provenance={<Provenance source="v_stocks_carburant (somme des mouvements validés)" heure={heure} />}
      />
      <Relation
        titre="À valider"
        lignes={aValider}
        erreur={erreurRegistre}
        cle={(a) => a.cle}
        lien={(a) => a.vers}
        vide="Aucune saisie en attente de décision"
        colonnes={[
          { libelle: 'Saisie', valeur: (a) => a.libelle },
          { libelle: 'Stockage', valeur: (a) => a.stockage },
          { libelle: 'Quantité', valeur: (a) => a.quantite },
          { libelle: 'Date', valeur: (a) => new Date(a.date).toLocaleString('fr-FR') },
          { libelle: 'Détail', valeur: (a) => a.detail || '—' },
        ]}
        note="La décision revient à une autre personne que l'auteur de la saisie (contrôle serveur) ; elle se prend depuis la fiche."
      />
      <Relation
        titre="Derniers mouvements du registre"
        lignes={mouvements && mouvements.slice(0, 50)}
        erreur={erreurRegistre}
        cle={(m) => m.id}
        lien={(m) => routeDetail(VUE_STOCKS, idRoute('mouvement', m.id))}
        vide="Aucun mouvement"
        colonnes={[
          { libelle: 'N°', valeur: (m) => `n° ${m.numero}` },
          { libelle: 'Date', valeur: (m) => new Date(m.date_mouvement).toLocaleString('fr-FR') },
          { libelle: 'Stockage', valeur: (m) => code.get(m.stockage_id) ?? '—' },
          { libelle: 'Type', valeur: (m) => LIBELLE_MOUVEMENT[m.type] },
          { libelle: 'Variation', valeur: (m) => <span className={`font-semibold ${Number(m.variation) < 0 ? 'text-red-700' : 'text-green-700'}`}>{Number(m.variation) > 0 ? '+' : ''}{formatNombre(Number(m.variation), 0)} L</span> },
          { libelle: 'Pièce', valeur: (m) => m.reference_piece ?? '—' },
          { libelle: 'État', valeur: (m) => <Puce teinte={LIBELLE_STATUT_DECISION[m.statut].teinte}>{LIBELLE_STATUT_DECISION[m.statut].libelle}</Puce> },
        ]}
        note="50 derniers mouvements ; le registre complet d'un stockage est dans sa fiche, l'export reprend les 300 derniers."
      />
    </div>
  );
};
