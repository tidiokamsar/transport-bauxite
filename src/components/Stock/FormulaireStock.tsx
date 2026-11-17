import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide, SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { ecrireRoute, poserAnnonce, routeDetail } from '../ui/routeur';
import {
  COLONNES_ARTICLE, COLONNES_DEPOT, COLONNES_RESERVATION, LIBELLE_MOUVEMENT_STOCK, LIBELLE_SUIVI, MODULE_STOCK, TITRE_SAISIE_STOCK, TYPES_DEPOT, VUE_STOCK,
  entierSaisi, erreursMouvement, estSaisieStock, idRouteStock, lotsPourMouvement,
  type ArticleStock, type DepotStock, type DisponibiliteStock, type Reservation, type SaisieStock, type SuiviArticle, type TypeMouvementStock,
} from './stock';

// Saisies du registre des stocks en pleine page (D-044, D-067, D-090) :
// mouvements, inventaire et reservation par les fonctions serveur ;
// article et depot dans leur table sous RLS, comme l'ecran d'origine (aucune
// fonction serveur n'existe pour eux : ecart note dans D-090).

interface Lib { id: string; libelle: string }
const maintenantLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const listeOnglet = (onglet: string) => ecrireRoute({ vue: VUE_STOCK, mode: 'liste', requete: { onglet } });

export const FormulaireStock = ({ objet, id, requete }: { objet: string | undefined; id?: string; requete: Record<string, string> }) => {
  if (id) {
    if (objet === 'article') return <FormulaireArticle id={id} />;
    return <SansDonnees message="Modification impossible" detail="Seuls les articles se modifient ; un mouvement se corrige par annulation, une réservation par levée." />;
  }
  if (!estSaisieStock(objet)) return <SansDonnees message="Saisie inconnue" detail={`« ${objet ?? ''} » n'est pas une saisie du registre des stocks.`} />;
  if (objet === 'article') return <FormulaireArticle />;
  if (objet === 'depot') return <FormulaireDepot />;
  return <FormulaireMouvement type={objet} requete={requete} />;
};

const useDroitStock = () => {
  const { hasPermission } = useAuth();
  return hasPermission('stock', 'create') || hasPermission('stock', 'edit');
};

const FormulaireArticle = ({ id }: { id?: string }) => {
  const peutEcrire = useDroitStock();
  const [article, setArticle] = useState<ArticleStock | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie({ code: '', nom: '', unite: 'piece', prix: '', seuil: '', suivi: 'aucun' as SuiviArticle });

  useEffect(() => {
    if (!id) return;
    lire<ArticleStock>(supabase.from('stock_items').select(COLONNES_ARTICLE).eq('id', id), 'article').then((r) => {
      const a = trouver(r.lignes, id);
      setArticle(a);
      if (!a) { setErreurChargement(r.erreur || 'Article introuvable ou non visible avec vos droits.'); return; }
      initialiser({ code: a.item_code, nom: a.name, unite: a.unit_of_measure, prix: a.unit_price?.toString() ?? '', seuil: a.minimum_threshold?.toString() ?? '', suivi: a.suivi ?? 'aucun' });
    });
  }, [id, initialiser]);

  const erreurs = [
    ...(!peutEcrire ? ['Droit d\'écriture sur les stocks requis.'] : []),
    ...(article && article.active === false ? ['Article archivé : il ne se modifie plus.'] : []),
    ...(!f.code.trim() ? ['Code requis.'] : []),
    ...(!f.nom.trim() ? ['Désignation requise.'] : []),
    ...(f.prix.trim() && entierSaisi(f.prix) === null ? ['Prix de référence : entier en GNF.'] : []),
    ...(f.seuil.trim() && entierSaisi(f.seuil) === null ? ['Seuil : entier positif.'] : []),
  ];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const valeurs = { item_code: f.code.trim(), name: f.nom.trim(), unit_of_measure: f.unite.trim() || 'piece',
      unit_price: f.prix.trim() ? entierSaisi(f.prix) : null, minimum_threshold: f.seuil.trim() ? entierSaisi(f.seuil) : 0, suivi: f.suivi || 'aucun' };
    if (id) {
      const { error } = await supabase.from('stock_items').update(valeurs).eq('id', id);
      if (error) return { erreur: error.message };
      poserAnnonce('Article modifié.');
      return { vers: routeDetail(VUE_STOCK, idRouteStock('article', id)) };
    }
    const { data, error } = await supabase.from('stock_items').insert(valeurs).select('id');
    if (error) return { erreur: error.message };
    poserAnnonce('Article créé. Son stock se constitue par une entrée ou un inventaire.');
    const nouveau = ((data ?? []) as { id: string }[])[0]?.id;
    return { vers: nouveau ? routeDetail(VUE_STOCK, idRouteStock('article', nouveau)) : listeOnglet('articles') };
  };

  return (
    <PageFormulaire
      vue={VUE_STOCK} module={MODULE_STOCK}
      titre={id ? 'Modifier l\'article' : TITRE_SAISIE_STOCK.article}
      reference={article?.item_code} id={id ? idRouteStock('article', id) : undefined}
      description="Le prix de référence n'entre pas dans la valorisation (coût moyen pondéré des entrées). Le suivi par lot ou numéro de série ne change que lorsque l'article n'a plus de stock (contrôle serveur)."
      modifie={modifie} erreurs={erreurs} onSoumettre={soumettre} libelleSoumettre="Enregistrer"
      chargement={Boolean(id) && !article && !erreurChargement} erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Article">
        <ChampPage libelle="Code *"><input value={f.code} onChange={(e) => poser('code', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Désignation *"><input value={f.nom} onChange={(e) => poser('nom', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Unité"><input value={f.unite} onChange={(e) => poser('unite', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Prix unitaire de référence (GNF)"><input inputMode="numeric" value={f.prix} onChange={(e) => poser('prix', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Seuil minimum"><input inputMode="numeric" value={f.seuil} onChange={(e) => poser('seuil', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Suivi">
          <select value={f.suivi} onChange={(e) => poser('suivi', e.target.value as SuiviArticle)} className={CHAMP_FENETRE}>
            {Object.entries(LIBELLE_SUIVI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

const FormulaireDepot = () => {
  const peutEcrire = useDroitStock();
  const [sites, setSites] = useState<Lib[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ code: '', nom: '', type: 'main', site: '' });
  useEffect(() => {
    supabase.from('sites').select('id, name').order('name').then(({ data, error }) => {
      if (error) setErreurChargement(`Sites indisponibles : ${error.message}`);
      setSites((data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    });
  }, []);
  const erreurs = [
    ...(!peutEcrire ? ['Droit d\'écriture sur les stocks requis.'] : []),
    ...(!f.code.trim() ? ['Code requis.'] : []),
    ...(!f.nom.trim() ? ['Nom requis.'] : []),
  ];
  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.from('warehouses').insert({ code: f.code.trim(), name: f.nom.trim(), warehouse_type: f.type || 'main', site_id: f.site || null }).select('id');
    if (error) return { erreur: error.message };
    poserAnnonce('Dépôt créé.');
    const nouveau = ((data ?? []) as { id: string }[])[0]?.id;
    return { vers: nouveau ? routeDetail(VUE_STOCK, idRouteStock('depot', nouveau)) : listeOnglet('depots') };
  };
  return (
    <PageFormulaire vue={VUE_STOCK} module={MODULE_STOCK} titre={TITRE_SAISIE_STOCK.depot} modifie={modifie} erreurs={erreurs} onSoumettre={soumettre}
      libelleSoumettre="Créer le dépôt" chargement={sites === null} erreurChargement={erreurChargement}>
      <SectionFormulaire titre="Dépôt">
        <ChampPage libelle="Code *"><input value={f.code} onChange={(e) => poser('code', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Nom *"><input value={f.nom} onChange={(e) => poser('nom', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Type">
          <select value={f.type} onChange={(e) => poser('type', e.target.value)} className={CHAMP_FENETRE}>{Object.entries(TYPES_DEPOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </ChampPage>
        <ChampPage libelle="Site">
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Tous sites</option>{(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

const FormulaireMouvement = ({ type, requete }: { type: Exclude<SaisieStock, 'article' | 'depot'>; requete: Record<string, string> }) => {
  const peutEcrire = useDroitStock();
  const [articles, setArticles] = useState<ArticleStock[] | null>(null);
  const [depots, setDepots] = useState<DepotStock[] | null>(null);
  const [dispo, setDispo] = useState<DisponibiliteStock[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [ordres, setOrdres] = useState<Lib[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: c, poser, modifie } = useSaisie({
    article: requete.article ?? '', source: requete.source ?? '', destination: '', depot: requete.depot ?? '', quantite: requete.quantite ?? '', lots: '',
    quand: maintenantLocal(), prix: '', piece: '', note: '', reservation: requete.reservation ?? '', compte: '', code: '', motif: '', ordre: '', engin: '', affectation: '',
  });

  useEffect(() => {
    Promise.all([
      supabase.from('stock_items').select(COLONNES_ARTICLE).order('item_code'),
      supabase.from('warehouses').select(COLONNES_DEPOT).order('code'),
      supabase.from('v_stock_disponibilite').select('stock_item_id, warehouse_id, quantite, reserve, libre'),
      supabase.from('v_reservations_stock').select(COLONNES_RESERVATION).eq('statut', 'active'),
      supabase.from('maintenance_orders').select('id, work_order_number, status').in('status', ['open', 'in_progress']).order('work_order_number'),
      supabase.from('vehicles').select('id, registration').order('registration'),
    ]).then(([a, d, l, r, o, v]) => {
      setErreurChargement([a, d, l, r, o, v].map((x) => x.error?.message).find(Boolean) ?? '');
      setArticles((a.data ?? []) as ArticleStock[]);
      setDepots((d.data ?? []) as DepotStock[]);
      setDispo((l.data ?? []) as DisponibiliteStock[]);
      setReservations(((r.data ?? []) as Reservation[]).filter((x) => x.statut === 'active'));
      setOrdres((o.data ?? []).map((x) => ({ id: x.id as string, libelle: (x.work_order_number as string | null) ?? 'OT sans numéro' })));
      setEngins((v.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    });
  }, []);

  const choisi = (articles ?? []).find((a) => a.id === c.article);
  const suivi: SuiviArticle = choisi?.suivi ?? 'aucun';
  const qte = entierSaisi(c.quantite);
  const actifs = (depots ?? []).filter((d) => d.active !== false);
  const reservationsPossibles = reservations.filter((r) => r.stock_item_id === c.article && r.warehouse_id === c.source);
  const ligneSource = dispo.find((l) => l.stock_item_id === c.article && l.warehouse_id === c.source);
  const estMouvement = type === 'entry' || type === 'exit' || type === 'transfer' || type === 'return';
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur les stocks requis.'] : []), ...erreursMouvement(type, c, suivi)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    if (type === 'inventaire') {
      const { error } = suivi !== 'aucun'
        ? await supabase.rpc('inventorier_lot_stock', { p_article: c.article, p_depot: c.depot, p_code: c.code.trim(), p_quantite_comptee: entierSaisi(c.compte), p_motif: c.motif.trim() || null })
        : await supabase.rpc('inventorier_stock', { p_article: c.article, p_depot: c.depot, p_quantite_comptee: entierSaisi(c.compte), p_motif: c.motif.trim() || null });
      if (error) return { erreur: error.message };
      poserAnnonce(suivi !== 'aucun' ? 'Inventaire du lot enregistré : l\'écart éventuel est passé en ajustement.' : 'Inventaire enregistré : l\'écart éventuel est passé en ajustement.');
      return { vers: routeDetail(VUE_STOCK, idRouteStock('article', c.article)) };
    }
    if (type === 'reservation') {
      const { data, error } = await supabase.rpc('reserver_stock', {
        p_article: c.article, p_depot: c.depot, p_quantite: qte, p_ordre_maintenance: c.ordre || null,
        p_vehicle_id: c.engin || null, p_affectation: c.affectation.trim() || null, p_note: c.note.trim() || null,
      });
      if (error) return { erreur: error.message };
      poserAnnonce('Réservation enregistrée : la quantité est déduite du stock libre.');
      return { vers: typeof data === 'string' && data ? routeDetail(VUE_STOCK, idRouteStock('reservation', data)) : listeOnglet('reservations') };
    }
    const lots = lotsPourMouvement(suivi, c.lots, qte);
    const { data, error } = await supabase.rpc('mouvement_stock', {
      p_article: c.article, p_type: type, p_quantite: qte,
      p_depot_source: type === 'exit' || type === 'transfer' ? c.source : null,
      p_depot_destination: type === 'entry' || type === 'return' || type === 'transfer' ? c.destination : null,
      p_date: new Date(c.quand).toISOString(), p_prix_unitaire: type === 'entry' && c.prix.trim() ? entierSaisi(c.prix) : null,
      p_reference: c.piece.trim() || null, p_vehicle_id: null, p_ordre_maintenance: null, p_note: c.note.trim() || null,
      p_lots: lots && lots.length ? lots : null,
      p_reservation: type === 'exit' && c.reservation ? c.reservation : null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce(`${LIBELLE_MOUVEMENT_STOCK[type as TypeMouvementStock]} enregistrée.`);
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_STOCK, idRouteStock('mouvement', data)) : listeOnglet('mouvements') };
  };

  const selectArticle = (
    <ChampPage libelle="Article *">
      <select value={c.article} onChange={(e) => poser('article', e.target.value)} className={CHAMP_FENETRE}>
        <option value="">Choisir</option>{(articles ?? []).filter((a) => a.active !== false).map((a) => <option key={a.id} value={a.id}>{a.item_code} · {a.name}</option>)}
      </select>
    </ChampPage>
  );
  const selectDepot = (cle: 'source' | 'destination' | 'depot', libelle: string) => (
    <ChampPage libelle={`${libelle} *`}>
      <select value={c[cle]} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE}>
        <option value="">Choisir</option>{actifs.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
      </select>
    </ChampPage>
  );

  return (
    <PageFormulaire vue={VUE_STOCK} module={MODULE_STOCK} titre={TITRE_SAISIE_STOCK[type]} modifie={modifie} erreurs={erreurs} onSoumettre={soumettre}
      libelleSoumettre="Enregistrer" chargement={articles === null || depots === null} erreurChargement={erreurChargement}
      description={type === 'reservation'
        ? 'La réservation ne dépasse jamais le stock libre (stock moins réservations) ; elle se consomme par une sortie qui la cite ou se lève avec un motif.'
        : type === 'inventaire' ? 'L\'écart entre le comptage et le stock calculé est passé en ajustement d\'inventaire, motif obligatoire en cas d\'écart (contrôle serveur).'
          : 'Le mouvement est enregistré par le serveur ; une erreur se corrige par annulation (contre-mouvement), jamais par modification.'}>
      {articles?.length === 0 && <ReferentielVide>Aucun article : créez d'abord l'article (onglet Articles).</ReferentielVide>}
      {depots?.length === 0 && <ReferentielVide>Aucun dépôt : créez d'abord le dépôt (onglet Dépôts).</ReferentielVide>}
      <SectionFormulaire titre={TITRE_SAISIE_STOCK[type]}>
        {selectArticle}
        {type === 'inventaire' && <>
          {selectDepot('depot', 'Dépôt')}
          {suivi !== 'aucun' && <ChampPage libelle={suivi === 'serie' ? 'Numéro de série *' : 'Lot *'}><input value={c.code} onChange={(e) => poser('code', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>}
          <ChampPage libelle={suivi === 'serie' ? 'Présent (1) ou absent (0) *' : 'Quantité comptée *'}><input inputMode="numeric" value={c.compte} onChange={(e) => poser('compte', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Motif (obligatoire en cas d'écart)" className="sm:col-span-2"><input value={c.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        </>}
        {type === 'reservation' && <>
          {selectDepot('depot', 'Dépôt')}
          <ChampPage libelle="Quantité *"><input inputMode="numeric" value={c.quantite} onChange={(e) => poser('quantite', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Ordre de travail">
            <select value={c.ordre} onChange={(e) => poser('ordre', e.target.value)} className={CHAMP_FENETRE}><option value="">Aucun</option>{ordres.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}</select>
          </ChampPage>
          <ChampPage libelle="Engin">
            <select value={c.engin} onChange={(e) => poser('engin', e.target.value)} className={CHAMP_FENETRE}><option value="">Aucun</option>{engins.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>
          </ChampPage>
          <ChampPage libelle="Affectation (chantier, équipe)"><input value={c.affectation} onChange={(e) => poser('affectation', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Note" className="sm:col-span-2"><input value={c.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        </>}
        {estMouvement && <>
          {(type === 'exit' || type === 'transfer') && selectDepot('source', 'Depuis')}
          {(type === 'entry' || type === 'return' || type === 'transfer') && selectDepot('destination', 'Vers')}
          <ChampPage libelle="Quantité *"><input inputMode="numeric" value={c.quantite} onChange={(e) => poser('quantite', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Date et heure *"><input type="datetime-local" value={c.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          {type === 'entry' && <ChampPage libelle="Prix unitaire du bon (GNF)"><input inputMode="numeric" value={c.prix} onChange={(e) => poser('prix', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>}
          {type === 'exit' && (reservationsPossibles.length > 0 || c.reservation) && (
            <ChampPage libelle="Réservation consommée">
              <select value={c.reservation} onChange={(e) => poser('reservation', e.target.value)} className={CHAMP_FENETRE}>
                <option value="">Aucune (stock libre)</option>
                {reservationsPossibles.map((r) => <option key={r.id} value={r.id}>{r.numero} · reste {r.quantite_restante}</option>)}
                {c.reservation && !reservationsPossibles.some((r) => r.id === c.reservation) && <option value={c.reservation}>Réservation choisie</option>}
              </select>
            </ChampPage>
          )}
          <ChampPage libelle="Pièce (bon, ordre de travail)"><input value={c.piece} onChange={(e) => poser('piece', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Note"><input value={c.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          {suivi !== 'aucun' && (
            <ChampPage libelle={suivi === 'serie' ? 'Numéros de série (un par ligne) *' : 'Lots (un par ligne : CODE QUANTITÉ) *'} className="sm:col-span-2"
              erreur={c.lots.trim() && lotsPourMouvement(suivi, c.lots, qte) === null ? 'Saisie illisible, code répété ou total différent de la quantité.' : null}>
              <textarea rows={3} value={c.lots} onChange={(e) => poser('lots', e.target.value)} className={CHAMP_FENETRE} />
            </ChampPage>
          )}
          {(type === 'exit' || type === 'transfer') && ligneSource && (
            <p className="text-xs text-stone-500 sm:col-span-2">
              Au dépôt : {ligneSource.quantite} en stock, {ligneSource.reserve} réservé(s), {ligneSource.libre} libre(s). {c.reservation ? 'La sortie consomme la réservation choisie.' : 'Sans réservation, seule la quantité libre peut sortir.'}
            </p>
          )}
        </>}
      </SectionFormulaire>
    </PageFormulaire>
  );
};
