import { useEffect, useState } from 'react';
import { ArrowRightLeft, Ban, Gauge, PackagePlus, Pencil, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { ecrireRoute, poserAnnonce, routeAction, routeDetail, routeListe, routeModifier } from '../ui/routeur';
import { exportToCSV } from '../../lib/exports';
import { LIBELLE_STATUT_DECISION, MODULE_STOCKS, VUE_LIVRAISONS, VUE_STOCKS, erreursStockage, idRoute, lireNombre } from './carburant';
import { alerteStockage, LIBELLE_MOUVEMENT, LIBELLE_TYPE_STOCKAGE, type Stock } from './stocks';
import { COLONNES_INVENTAIRE, COLONNES_MOUVEMENT, litres, type Inventaire, type Mouvement } from './registre';

// Fiche, saisie et activation d'un stockage de carburant (D-041, D-090).
// Le referentiel des stockages s'ecrit sur la table sous RLS
// (has_module_write('fuel') et site_permis), seule ecriture directe admise
// par le registre : code, type et site sont figes apres creation ;
// l'activation ne conserve pas de motif (aucune colonne).

interface Stockage { id: string; code: string; libelle: string; type: Stock['type']; site_id: string; capacite_litres: number; seuil_alerte_litres: number | null; actif: boolean; cree_par: string | null; cree_le: string }
const COLONNES_STOCKAGE = 'id, code, libelle, type, site_id, capacite_litres, seuil_alerte_litres, actif, cree_par, cree_le';
interface Reception { id: string; livraison_id: string; stockage_id: string; date_reception: string; volume_accepte: number }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const useEcriture = () => {
  const { hasPermission } = useAuth();
  return hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
};

export const FicheStockage = ({ id }: { id: string }) => {
  const peutEcrire = useEcriture();
  const { sites } = useSite();
  const [stock, setStock] = useState<Lecture<Stock>>(attente);
  const [stockage, setStockage] = useState<Stockage | null>(null);
  const [mouvements, setMouvements] = useState<Lecture<Mouvement>>(attente);
  const [inventaires, setInventaires] = useState<Lecture<Inventaire>>(attente);
  const [receptions, setReceptions] = useState<Lecture<Reception>>(attente);
  const [livraisons, setLivraisons] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    lire<Stock>(supabase.from('v_stocks_carburant').select('*').eq('id', id), 'stockage').then(setStock);
    lire<Stockage>(supabase.from('stockages_carburant').select(COLONNES_STOCKAGE).eq('id', id), 'stockage').then((r) => setStockage(trouver(r.lignes, id)));
    lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('stockage_id', id).order('numero', { ascending: false }).limit(500), 'registre du stockage')
      .then((r) => setMouvements({ ...r, lignes: r.lignes && r.lignes.filter((m) => m.stockage_id === id) }));
    lire<Inventaire>(supabase.from('inventaires_carburant').select(COLONNES_INVENTAIRE).eq('stockage_id', id).order('date_mesure', { ascending: false }), 'inventaires du stockage')
      .then((r) => setInventaires({ ...r, lignes: r.lignes && r.lignes.filter((i) => i.stockage_id === id) }));
    lire<Reception>(supabase.from('receptions_carburant').select('id, livraison_id, stockage_id, date_reception, volume_accepte').eq('stockage_id', id).order('date_reception', { ascending: false }), 'réceptions')
      .then(async (r) => {
        const lignes = (r.lignes ?? []).filter((x) => x.stockage_id === id);
        setReceptions({ ...r, lignes: r.lignes && lignes });
        if (lignes.length === 0) return;
        const { data } = await supabase.from('livraisons_carburant_cbg').select('id, reference').in('id', lignes.map((x) => x.livraison_id));
        setLivraisons(new Map(((data ?? []) as { id: string; reference: string }[]).map((x) => [x.id, x.reference])));
      });
  }, [id]);

  const s = trouver(stock.lignes, id);
  const alerte = s ? alerteStockage(s) : null;
  const nouveau = (objet: string, cle = 'stockage') => ecrireRoute({ vue: VUE_STOCKS, mode: 'nouveau', requete: { objet, [cle]: id } });

  const historique: EvenementHistorique[] | null = s && mouvements.lignes && inventaires.lignes ? fusionnerHistoriques(
    stockage?.cree_le ? [{ id: 'stockage-cree', le: stockage.cree_le, libelle: 'Stockage déclaré', auteur: stockage.cree_par, source: 'stockages_carburant.cree_le' }] : [],
    inventaires.lignes.flatMap((i) => [
      { id: `inventaire-${i.id}-saisi`, le: i.cree_le, libelle: `Inventaire saisi : ${litres(i.volume_mesure)} mesurés`, auteur: i.cree_par, source: 'inventaires_carburant.cree_le' },
      ...(i.decide_le ? [{ id: `inventaire-${i.id}-decide`, le: i.decide_le, libelle: `Inventaire ${i.statut === 'valide' ? 'validé' : 'rejeté'}`, motif: i.motif_decision, auteur: i.decide_par, source: 'inventaires_carburant.decide_le' }] : []),
    ]),
    mouvements.lignes.flatMap((m) => [
      { id: `mouvement-${m.id}-saisi`, le: m.saisi_le, libelle: `n° ${m.numero} ${LIBELLE_MOUVEMENT[m.type]} saisi (${formatNombre(Number(m.variation), 0)} L)`, detail: m.note, auteur: m.saisi_par, source: 'mouvements_carburant.saisi_le' },
      ...(m.decide_le ? [{ id: `mouvement-${m.id}-decide`, le: m.decide_le, libelle: `n° ${m.numero} ${m.statut === 'valide' ? 'validé' : 'rejeté'}`, motif: m.motif_decision, auteur: m.decide_par, source: 'mouvements_carburant.decide_le' }] : []),
    ]),
  ) : null;

  const exporter = () => exportToCSV((mouvements.lignes ?? []).map((m) => ({
    numero: m.numero, date: m.date_mouvement, type: LIBELLE_MOUVEMENT[m.type], variation_litres: m.variation, piece: m.reference_piece ?? '',
    statut: m.statut, note: m.note ?? '', motif_decision: m.motif_decision ?? '',
  })), `registre-${s?.code ?? 'stockage'}`);

  return (
    <PageDetail
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={s?.code ?? 'Stockage'}
      titre={s ? <>{s.code} <span className="text-lg font-semibold text-stone-500">{s.libelle}</span></> : undefined}
      statut={s ? (s.actif ? { libelle: 'Actif', teinte: 'vert' } : { libelle: 'Inactif', teinte: 'gris' }) : null}
      resume={s && <>{LIBELLE_TYPE_STOCKAGE[s.type]} · {sites.find((x) => x.id === s.site_id)?.name ?? 'Site'} · stock validé {s.solde_litres === null ? 'sans données' : litres(s.solde_litres)}</>}
      chargement={stock.lignes === null && !stock.erreur}
      erreur={stock.erreur}
      introuvable={stock.lignes !== null && !s}
      actions={[
        { id: 'reception', libelle: 'Réception CBG', icone: <PackagePlus className="h-4 w-4" />, ton: 'principal', visible: peutEcrire && Boolean(s?.actif), vers: nouveau('reception') },
        { id: 'inventaire', libelle: 'Inventaire', icone: <Gauge className="h-4 w-4" />, visible: peutEcrire && Boolean(s?.actif), vers: nouveau('inventaire') },
        { id: 'transfert', libelle: 'Transfert', icone: <ArrowRightLeft className="h-4 w-4" />, visible: peutEcrire && Boolean(s?.actif), vers: nouveau('transfert') },
        { id: 'modifier', libelle: 'Modifier', icone: <Pencil className="h-4 w-4" />, visible: peutEcrire && Boolean(s), vers: routeModifier(VUE_STOCKS, id) },
        { id: 'desactiver', libelle: 'Désactiver', icone: <Ban className="h-4 w-4" />, ton: 'danger', visible: peutEcrire && Boolean(s?.actif), vers: routeAction(VUE_STOCKS, id, 'desactiver') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <RotateCcw className="h-4 w-4" />, visible: peutEcrire && Boolean(s) && !s?.actif, vers: routeAction(VUE_STOCKS, id, 'reactiver') },
      ]}
      onglets={!s ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Stockage', champs: [['Code', <span className="font-mono">{s.code}</span>], ['Libellé', s.libelle], ['Type', LIBELLE_TYPE_STOCKAGE[s.type]],
              ['Site', sites.find((x) => x.id === s.site_id)?.name ?? null], ['Capacité', litres(s.capacite_litres)],
              ['Seuil d\'alerte', s.seuil_alerte_litres === null ? null : litres(s.seuil_alerte_litres)], ['État', s.actif ? 'Actif' : 'Inactif']] },
            { titre: 'Stock (somme des mouvements validés)', champs: [['Stock validé', s.solde_litres === null ? 'Sans données : inventaire d\'ouverture requis' : litres(s.solde_litres)],
              ['En attente de décision', s.mouvements_en_attente ? `${formatNombre(Number(s.en_attente_litres), 0)} L (${s.mouvements_en_attente} mouvement(s))` : null],
              ['Dernier mouvement validé', s.dernier_mouvement ? new Date(s.dernier_mouvement).toLocaleString('fr-FR') : null],
              ['Dernier inventaire', s.dernier_inventaire ? `${new Date(s.dernier_inventaire).toLocaleString('fr-FR')} (écart ${litres(s.dernier_ecart_inventaire)})` : null],
              ['Alerte', alerte && <Puce teinte={alerte.teinte}>{alerte.texte}</Puce>]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Registre', compte: mouvements.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={exporter} disabled={!mouvements.lignes?.length} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">Exporter CSV</button>
            </div>
            <Relation titre="Mouvements" lignes={mouvements.lignes} erreur={mouvements.erreur} cle={(m) => m.id} vide="Aucun mouvement"
              lien={(m) => routeDetail(VUE_STOCKS, idRoute('mouvement', m.id))}
              colonnes={[
                { libelle: 'N°', valeur: (m) => `n° ${m.numero}` },
                { libelle: 'Date', valeur: (m) => new Date(m.date_mouvement).toLocaleString('fr-FR') },
                { libelle: 'Type', valeur: (m) => LIBELLE_MOUVEMENT[m.type] },
                { libelle: 'Variation', valeur: (m) => `${Number(m.variation) > 0 ? '+' : ''}${formatNombre(Number(m.variation), 0)} L` },
                { libelle: 'Pièce', valeur: (m) => m.reference_piece ?? '—' },
                { libelle: 'État', valeur: (m) => <Puce teinte={LIBELLE_STATUT_DECISION[m.statut].teinte}>{LIBELLE_STATUT_DECISION[m.statut].libelle}</Puce> },
              ]} />
            <div className="grid gap-4 lg:grid-cols-2">
              <Relation titre="Inventaires" lignes={inventaires.lignes} erreur={inventaires.erreur} cle={(i) => i.id} vide="Aucun inventaire : le stock reste sans données"
                lien={(i) => routeDetail(VUE_STOCKS, idRoute('inventaire', i.id))}
                colonnes={[
                  { libelle: 'Date', valeur: (i) => new Date(i.date_mesure).toLocaleString('fr-FR') },
                  { libelle: 'Mesuré', valeur: (i) => litres(i.volume_mesure) },
                  { libelle: 'Écart', valeur: (i) => litres(i.ecart) },
                  { libelle: 'État', valeur: (i) => <Puce teinte={LIBELLE_STATUT_DECISION[i.statut].teinte}>{LIBELLE_STATUT_DECISION[i.statut].libelle}</Puce> },
                ]} />
              <Relation titre="Réceptions de livraisons CBG" lignes={receptions.lignes} erreur={receptions.erreur} cle={(r) => r.id} vide="Aucune réception"
                lien={(r) => routeDetail(VUE_LIVRAISONS, r.livraison_id)}
                colonnes={[
                  { libelle: 'Livraison', valeur: (r) => livraisons.get(r.livraison_id) ?? 'Livraison' },
                  { libelle: 'Date', valeur: (r) => new Date(r.date_reception).toLocaleString('fr-FR') },
                  { libelle: 'Accepté', valeur: (r) => litres(r.volume_accepte) },
                ]} />
            </div>
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={mouvements.erreur || inventaires.erreur}
            source="stockages_carburant (déclaration), inventaires_carburant, mouvements_carburant (saisies et décisions)"
            absent="Les modifications du libellé, de la capacité, du seuil et de l'activation ne sont pas journalisées par le serveur (écart noté)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un stockage de carburant" /> },
      ]}
    />
  );
};

export const FormulaireStockage = ({ id }: { id?: string }) => {
  const peutEcrire = useEcriture();
  const creation = !id;
  const [stockage, setStockage] = useState<Stockage | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string }[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie({ code: '', libelle: '', type: 'cuve_fixe', site: '', capacite: '', seuil: '' });

  useEffect(() => {
    supabase.from('sites').select('id, name').order('name').then(({ data, error }) => {
      if (error) setErreurChargement(`Sites indisponibles : ${error.message}`);
      setSites((data ?? []) as { id: string; name: string }[]);
    });
    if (!id) return;
    lire<Stockage>(supabase.from('stockages_carburant').select(COLONNES_STOCKAGE).eq('id', id), 'stockage').then((r) => {
      const s = trouver(r.lignes, id);
      setStockage(s);
      if (r.erreur || !s) { setErreurChargement(r.erreur || 'Stockage introuvable ou hors de votre périmètre.'); return; }
      initialiser({ code: s.code, libelle: s.libelle, type: s.type, site: s.site_id, capacite: String(s.capacite_litres), seuil: s.seuil_alerte_litres === null ? '' : String(s.seuil_alerte_litres) });
    });
  }, [id, initialiser]);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursStockage(f, creation)];
  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const seuil = f.seuil.trim() === '' ? null : lireNombre(f.seuil);
    if (creation) {
      const { data, error } = await supabase.from('stockages_carburant').insert({
        code: f.code.trim(), libelle: f.libelle.trim(), type: f.type, site_id: f.site, capacite_litres: lireNombre(f.capacite), seuil_alerte_litres: seuil,
      }).select('id');
      if (error) return { erreur: error.message };
      poserAnnonce('Stockage créé. Saisissez son inventaire d\'ouverture : le stock reste « sans données » jusqu\'à sa validation.');
      const nouvelId = ((data ?? []) as { id: string }[])[0]?.id;
      return { vers: nouvelId ? routeDetail(VUE_STOCKS, nouvelId) : routeListe(VUE_STOCKS) };
    }
    const { error } = await supabase.from('stockages_carburant')
      .update({ libelle: f.libelle.trim(), capacite_litres: lireNombre(f.capacite), seuil_alerte_litres: seuil }).eq('id', id);
    if (error) return { erreur: error.message };
    poserAnnonce('Stockage mis à jour.');
    return { vers: routeDetail(VUE_STOCKS, id) };
  };

  return (
    <PageFormulaire
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      titre={creation ? 'Nouveau stockage' : 'Modifier le stockage'}
      reference={stockage?.code}
      id={id}
      description={creation ? 'Cuve fixe ou citerne mobile ; le stock part de son inventaire d\'ouverture validé.' : 'Code, type et site sont figés après la création ; le stock ne se saisit pas.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre={creation ? 'Créer le stockage' : 'Mettre à jour'}
      chargement={sites === null || (!creation && !stockage && !erreurChargement)}
      erreurChargement={erreurChargement}
    >
      {creation && sites?.length === 0 && <ReferentielVide>{SANS_SITE}</ReferentielVide>}
      <SectionFormulaire titre="Stockage">
        <ChampPage libelle={creation ? 'Code *' : 'Code'}>
          <input value={f.code} onChange={(e) => poser('code', e.target.value)} disabled={!creation} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Libellé *">
          <input value={f.libelle} onChange={(e) => poser('libelle', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle={creation ? 'Type *' : 'Type'}>
          <select value={f.type} onChange={(e) => poser('type', e.target.value)} disabled={!creation} className={CHAMP_FENETRE}>
            {Object.entries(LIBELLE_TYPE_STOCKAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle={creation ? 'Site *' : 'Site'}>
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} disabled={!creation} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Capacité (L) *">
          <input inputMode="decimal" value={f.capacite} onChange={(e) => poser('capacite', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Seuil d'alerte (L)">
          <input inputMode="decimal" value={f.seuil} onChange={(e) => poser('seuil', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const ActionStockage = ({ id, action }: { id: string; action: string }) => {
  const peutEcrire = useEcriture();
  const [stockage, setStockage] = useState<Stockage | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Stockage>(supabase.from('stockages_carburant').select(COLONNES_STOCKAGE).eq('id', id), 'stockage').then((r) => {
      const s = trouver(r.lignes, id);
      setStockage(s);
      setErreur(r.erreur || (s ? '' : 'Stockage introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (action !== 'desactiver' && action !== 'reactiver') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un stockage.`} />;
  const desactiver = action === 'desactiver';
  const interdit = !peutEcrire ? 'Droit d\'écriture sur le carburant requis.'
    : stockage && stockage.actif !== desactiver ? (desactiver ? 'Stockage déjà inactif.' : 'Stockage déjà actif.') : null;
  return (
    <PageAction
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={stockage?.code ?? 'Stockage'}
      id={id}
      titre={`${desactiver ? 'Désactiver' : 'Réactiver'} le stockage ${stockage?.code ?? ''}`.trim()}
      description={desactiver
        ? 'Un stockage inactif ne reçoit plus de réception, de transfert ni de distribution ; son registre reste consultable. Aucun motif n\'est conservé par le serveur (pas de colonne).'
        : 'Le stockage peut de nouveau recevoir des mouvements.'}
      motif="aucun"
      libelleConfirmer={desactiver ? 'Désactiver' : 'Réactiver'}
      danger={desactiver}
      interdit={interdit}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={desactiver ? 'Stockage désactivé.' : 'Stockage réactivé.'}
      onExecuter={async () => {
        const { error } = await supabase.from('stockages_carburant').update({ actif: !desactiver }).eq('id', id);
        return error ? error.message : null;
      }}
    />
  );
};
