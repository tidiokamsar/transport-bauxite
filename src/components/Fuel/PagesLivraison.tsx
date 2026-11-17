import { useEffect, useState } from 'react';
import { CheckCircle2, FilePlus, PackagePlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
import { ecrireRoute, poserAnnonce, routeAction, routeDetail, routeListe } from '../ui/routeur';
import {
  LIBELLE_STATUT_DECISION, LIBELLE_STATUT_FACTURE_CBG, MODULE_LIVRAISONS, VUE_LIVRAISONS, VUE_STOCKS, controleFactureInterdit, erreursFactureCbg,
  erreursLivraison, idRoute, lireNombre, monnaie, type StatutDecision, type StatutFactureCbg,
} from './carburant';

// Fiches et saisies des livraisons et factures carburant CBG (D-034, D-083,
// D-090). Ecriture par enregistrer_livraison_cbg,
// enregistrer_facture_carburant_cbg et controler_facture_carburant_cbg ;
// aucune modification ni suppression (pas de fonction serveur : une
// livraison erronee reste visible et se signale au controle de la facture).

export interface Livraison {
  id: string; reference: string; date_livraison: string; site_id: string; site?: { name: string } | null;
  volume_litres: number; prix_litre: number; montant: number; document_ref: string | null; note: string | null;
  cree_par: string | null; cree_le: string | null;
}
export const COLONNES_LIVRAISON = 'id, reference, date_livraison, site_id, volume_litres, prix_litre, montant, document_ref, note, cree_par, cree_le, site:sites(name)';

export interface FactureCbg {
  id: string; reference: string; date_facture: string; montant_facture: number; montant_attendu: number | null;
  ecart: number | null; statut: StatutFactureCbg; cree_par: string | null; cree_le: string | null; controle_par: string | null; controle_le: string | null;
}
export const COLONNES_FACTURE_CBG = 'id, reference, date_facture, montant_facture, montant_attendu, ecart, statut, cree_par, cree_le, controle_par, controle_le';

interface Rattachement { facture_id: string; livraison_id: string }
interface Reception {
  id: string; livraison_id: string; stockage_id: string; date_reception: string; volume_mesure: number; volume_accepte: number;
  methode_mesure: string; motif_ecart: string | null; cree_par: string | null; cree_le: string;
}
interface MouvementReception { id: string; numero: number; reception_id: string | null; statut: StatutDecision }
interface JournalFacture { id: number; facture_id: string; action: 'saisie' | 'controle'; details: Record<string, unknown> | null; auteur: string | null; cree_le: string }

const jour = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const useEcriture = () => {
  const { hasPermission } = useAuth();
  return hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
};

export const FicheLivraison = ({ id }: { id: string }) => {
  const peutEcrire = useEcriture();
  const [livraison, setLivraison] = useState<Lecture<Livraison>>(attente);
  const [factures, setFactures] = useState<Lecture<FactureCbg>>(attente);
  const [receptions, setReceptions] = useState<Lecture<Reception>>(attente);
  const [mouvements, setMouvements] = useState<MouvementReception[]>([]);
  const [stockages, setStockages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    lire<Livraison>(supabase.from('livraisons_carburant_cbg').select(COLONNES_LIVRAISON).eq('id', id), 'livraison').then(setLivraison);
    lire<Rattachement>(supabase.from('factures_carburant_cbg_livraisons').select('facture_id, livraison_id').eq('livraison_id', id), 'facture rattachée')
      .then(async (r) => {
        if (r.erreur) { setFactures({ lignes: null, erreur: r.erreur }); return; }
        const ids = (r.lignes ?? []).filter((x) => x.livraison_id === id).map((x) => x.facture_id);
        if (ids.length === 0) { setFactures({ lignes: [], erreur: '' }); return; }
        const f = await lire<FactureCbg>(supabase.from('factures_carburant_cbg').select(COLONNES_FACTURE_CBG).in('id', ids), 'facture rattachée');
        setFactures({ ...f, lignes: f.lignes && f.lignes.filter((x) => ids.includes(x.id)) });
      });
    lire<Reception>(supabase.from('receptions_carburant')
      .select('id, livraison_id, stockage_id, date_reception, volume_mesure, volume_accepte, methode_mesure, motif_ecart, cree_par, cree_le')
      .eq('livraison_id', id), 'réception en cuve').then(async (r) => {
      const lignes = (r.lignes ?? []).filter((x) => x.livraison_id === id);
      setReceptions({ ...r, lignes: r.lignes && lignes });
      if (lignes.length === 0) return;
      const [s, m] = await Promise.all([
        supabase.from('stockages_carburant').select('id, code').in('id', lignes.map((x) => x.stockage_id)),
        supabase.from('mouvements_carburant').select('id, numero, reception_id, statut').in('reception_id', lignes.map((x) => x.id)),
      ]);
      setStockages(new Map(((s.data ?? []) as { id: string; code: string }[]).map((x) => [x.id, x.code])));
      setMouvements(((m.data ?? []) as MouvementReception[]).filter((x) => lignes.some((l) => l.id === x.reception_id)));
    });
  }, [id]);

  const l = trouver(livraison.lignes, id);
  const facturee = (factures.lignes ?? []).length > 0;
  const receptionnee = (receptions.lignes ?? []).length > 0;

  const historique: EvenementHistorique[] | null = l && factures.lignes && receptions.lignes ? fusionnerHistoriques(
    l.cree_le ? [{ id: 'livraison-cree', le: l.cree_le, libelle: 'Livraison enregistrée', detail: `${formatNombre(Number(l.volume_litres), 2)} L à ${formatNombre(Number(l.prix_litre), 2)} GNF / L`, auteur: l.cree_par, source: 'livraisons_carburant_cbg.cree_le' }] : [],
    receptions.lignes.map((r) => ({ id: `reception-${r.id}`, le: r.cree_le, libelle: `Réception en cuve ${stockages.get(r.stockage_id) ?? ''}`.trim(), detail: `Mesuré ${formatNombre(Number(r.volume_mesure))} L, accepté ${formatNombre(Number(r.volume_accepte))} L`, motif: r.motif_ecart, auteur: r.cree_par, source: 'receptions_carburant.cree_le' })),
    factures.lignes.flatMap((f) => (f.cree_le ? [{ id: `facture-${f.id}`, le: f.cree_le, libelle: `Rattachée à la facture ${f.reference}`, auteur: f.cree_par, source: 'factures_carburant_cbg.cree_le' }] : [])),
  ) : null;

  return (
    <PageDetail
      vue={VUE_LIVRAISONS}
      module={MODULE_LIVRAISONS}
      reference={l?.reference ?? 'Livraison'}
      statut={l && factures.lignes ? (facturee ? { libelle: 'Facturée', teinte: 'vert' } : { libelle: 'À facturer', teinte: 'orange' }) : null}
      resume={l && <>{jour(l.date_livraison)} · {l.site?.name ?? 'Site'} · {formatNombre(Number(l.volume_litres), 2)} L · {monnaie(l.montant)}</>}
      chargement={livraison.lignes === null && !livraison.erreur}
      erreur={livraison.erreur}
      introuvable={livraison.lignes !== null && !l}
      actions={[
        { id: 'receptionner', libelle: 'Réceptionner en cuve', icone: <PackagePlus className="h-4 w-4" />, ton: 'principal',
          visible: peutEcrire && receptions.lignes !== null && !receptionnee,
          vers: ecrireRoute({ vue: VUE_STOCKS, mode: 'nouveau', requete: { objet: 'reception', livraison: id } }) },
        { id: 'facturer', libelle: 'Rattacher à une facture', icone: <FilePlus className="h-4 w-4" />,
          visible: peutEcrire && factures.lignes !== null && !facturee,
          vers: ecrireRoute({ vue: VUE_LIVRAISONS, mode: 'nouveau', requete: { objet: 'facture', livraison: id } }) },
      ]}
      onglets={!l ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Livraison', champs: [['Référence', <span className="font-mono">{l.reference}</span>], ['Date', jour(l.date_livraison)], ['Site', l.site?.name ?? null],
              ['Bon / justificatif', l.document_ref], ['Note', l.note]] },
            { titre: 'Quantité et prix (bon CBG)', champs: [['Quantité livrée', `${formatNombre(Number(l.volume_litres), 2)} L`],
              ['Prix facturé par litre', `${formatNombre(Number(l.prix_litre), 2)} GNF`], ['Montant calculé', monnaie(l.montant)]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Réception et facture', compte: (receptions.lignes?.length ?? 0) + (factures.lignes?.length ?? 0), contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Réception en cuve" lignes={receptions.lignes} erreur={receptions.erreur} cle={(r) => r.id} vide="Livraison non encore réceptionnée"
              lien={(r) => { const m = mouvements.find((x) => x.reception_id === r.id); return m ? routeDetail(VUE_STOCKS, idRoute('mouvement', m.id)) : routeDetail(VUE_STOCKS, r.stockage_id); }}
              colonnes={[
                { libelle: 'Stockage', valeur: (r) => stockages.get(r.stockage_id) ?? 'Stockage' },
                { libelle: 'Date', valeur: (r) => new Date(r.date_reception).toLocaleString('fr-FR') },
                { libelle: 'Mesuré / accepté', valeur: (r) => `${formatNombre(Number(r.volume_mesure))} / ${formatNombre(Number(r.volume_accepte))} L` },
                { libelle: 'Entrée en stock', valeur: (r) => { const m = mouvements.find((x) => x.reception_id === r.id); return m ? <Puce teinte={LIBELLE_STATUT_DECISION[m.statut].teinte}>n° {m.numero} · {LIBELLE_STATUT_DECISION[m.statut].libelle}</Puce> : '—'; } },
              ]} />
            <Relation titre="Facture CBG" lignes={factures.lignes} erreur={factures.erreur} cle={(f) => f.id} vide="Livraison non encore facturée"
              lien={(f) => routeDetail(VUE_LIVRAISONS, idRoute('facture', f.id))}
              colonnes={[
                { libelle: 'Référence', valeur: (f) => f.reference },
                { libelle: 'Date', valeur: (f) => jour(f.date_facture) },
                { libelle: 'État', valeur: (f) => <Puce teinte={LIBELLE_STATUT_FACTURE_CBG[f.statut].teinte}>{LIBELLE_STATUT_FACTURE_CBG[f.statut].libelle}</Puce> },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={factures.erreur || receptions.erreur}
            source="livraisons_carburant_cbg (enregistrement), receptions_carburant, factures_carburant_cbg (rattachement)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType="livraison_carburant_cbg" objetId={id} peutDeposer={peutEcrire} libelleObjet="une livraison CBG" /> },
      ]}
    />
  );
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const FormulaireLivraison = () => {
  const peutEcrire = useEcriture();
  const [sites, setSites] = useState<{ id: string; name: string }[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ reference: '', date: aujourdhui(), site: '', litres: '', prix: '', document: '' });

  useEffect(() => {
    supabase.from('sites').select('id, name').order('name').then(({ data, error }) => {
      setErreurChargement(error ? `Sites indisponibles : ${error.message}` : '');
      setSites((data ?? []) as { id: string; name: string }[]);
    });
  }, []);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursLivraison(f)];
  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('enregistrer_livraison_cbg', {
      p_reference: f.reference.trim(), p_date: f.date, p_site_id: f.site,
      p_volume_litres: lireNombre(f.litres), p_prix_litre: lireNombre(f.prix), p_document_ref: f.document.trim() || null, p_note: null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Livraison CBG enregistrée. Joignez le bon de livraison dans l\'onglet Pièces jointes.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_LIVRAISONS, data) : routeListe(VUE_LIVRAISONS) };
  };

  return (
    <PageFormulaire
      vue={VUE_LIVRAISONS}
      module={MODULE_LIVRAISONS}
      titre="Enregistrer une livraison CBG"
      description="Quantité et prix au litre tels qu'ils figurent sur le bon de livraison ; le montant est calculé par le serveur."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer la livraison"
      chargement={sites === null}
      erreurChargement={erreurChargement}
    >
      {sites?.length === 0 && <ReferentielVide>{SANS_SITE} Chaque livraison CBG est rattachée au site livré.</ReferentielVide>}
      <SectionFormulaire titre="Livraison">
        <ChampPage libelle="Référence livraison *">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Date *">
          <input type="date" value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Site *">
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir un site</option>
            {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Bon / justificatif">
          <input value={f.document} onChange={(e) => poser('document', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Quantité livrée (L) *">
          <input inputMode="decimal" value={f.litres} onChange={(e) => poser('litres', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Prix facturé par litre (GNF) *">
          <input inputMode="decimal" value={f.prix} onChange={(e) => poser('prix', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const FicheFactureCbg = ({ id }: { id: string }) => {
  const peutEcrire = useEcriture();
  const [facture, setFacture] = useState<Lecture<FactureCbg>>(attente);
  const [livraisons, setLivraisons] = useState<Lecture<Livraison>>(attente);
  const [journal, setJournal] = useState<Lecture<JournalFacture>>(attente);

  useEffect(() => {
    lire<FactureCbg>(supabase.from('factures_carburant_cbg').select(COLONNES_FACTURE_CBG).eq('id', id), 'facture CBG').then(setFacture);
    lire<Rattachement>(supabase.from('factures_carburant_cbg_livraisons').select('facture_id, livraison_id').eq('facture_id', id), 'livraisons rattachées')
      .then(async (r) => {
        if (r.erreur) { setLivraisons({ lignes: null, erreur: r.erreur }); return; }
        const ids = (r.lignes ?? []).filter((x) => x.facture_id === id).map((x) => x.livraison_id);
        if (ids.length === 0) { setLivraisons({ lignes: [], erreur: '' }); return; }
        const l = await lire<Livraison>(supabase.from('livraisons_carburant_cbg').select(COLONNES_LIVRAISON).in('id', ids), 'livraisons rattachées');
        setLivraisons({ ...l, lignes: l.lignes && l.lignes.filter((x) => ids.includes(x.id)) });
      });
    lire<JournalFacture>(supabase.from('journal_factures_carburant_cbg').select('id, facture_id, action, details, auteur, cree_le').eq('facture_id', id).order('cree_le'), 'journal de la facture')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((j) => j.facture_id === id) }));
  }, [id]);

  const f = trouver(facture.lignes, id);
  const routeId = idRoute('facture', id);
  const historique: EvenementHistorique[] | null = f && journal.lignes ? fusionnerHistoriques(
    journal.lignes.length > 0
      ? journal.lignes.map((j) => ({
        id: `journal_factures_carburant_cbg-${j.id}`, le: j.cree_le, auteur: j.auteur, source: 'journal_factures_carburant_cbg',
        libelle: j.action === 'saisie' ? 'Facture saisie' : `Contrôle : ${LIBELLE_STATUT_FACTURE_CBG[(j.details?.statut as StatutFactureCbg) ?? 'saisie']?.libelle ?? String(j.details?.statut ?? '')}`,
        detail: j.action === 'controle' && j.details ? `Attendu ${monnaie(Number(j.details.montant_attendu))}, facturé ${monnaie(Number(j.details.montant_facture))}, écart ${monnaie(Number(j.details.ecart))}` : null,
      }))
      : [
        ...(f.cree_le ? [{ id: 'facture-cree', le: f.cree_le, libelle: 'Facture saisie', auteur: f.cree_par, source: 'factures_carburant_cbg.cree_le' }] : []),
        ...(f.controle_le ? [{ id: 'facture-controle', le: f.controle_le, libelle: 'Facture contrôlée', auteur: f.controle_par, source: 'factures_carburant_cbg.controle_le' }] : []),
      ],
  ) : null;

  return (
    <PageDetail
      vue={VUE_LIVRAISONS}
      module={MODULE_LIVRAISONS}
      reference={f ? `Facture ${f.reference}` : 'Facture CBG'}
      statut={f ? LIBELLE_STATUT_FACTURE_CBG[f.statut] : null}
      resume={f && <>{jour(f.date_facture)} · facturé {monnaie(f.montant_facture)}{f.ecart !== null ? ` · écart ${monnaie(f.ecart)}` : ''}</>}
      chargement={facture.lignes === null && !facture.erreur}
      erreur={facture.erreur}
      introuvable={facture.lignes !== null && !f}
      actions={[
        { id: 'controler', libelle: 'Contrôler', icone: <CheckCircle2 className="h-4 w-4" />, ton: 'principal',
          visible: Boolean(f) && controleFactureInterdit(f?.statut ?? 'saisie', peutEcrire) === null, vers: routeAction(VUE_LIVRAISONS, routeId, 'controler') },
      ]}
      onglets={!f ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Facture', champs: [['Référence', <span className="font-mono">{f.reference}</span>], ['Date', jour(f.date_facture)], ['État', LIBELLE_STATUT_FACTURE_CBG[f.statut].libelle],
              ['Contrôlée le', f.controle_le ? new Date(f.controle_le).toLocaleString('fr-FR') : null]] },
            { titre: 'Rapprochement', champs: [['Montant facturé', monnaie(f.montant_facture)], ['Montant attendu (livraisons)', f.montant_attendu === null ? null : monnaie(f.montant_attendu)],
              ['Écart', f.ecart === null ? null : monnaie(f.ecart)]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Livraisons', compte: livraisons.lignes?.length ?? null, contenu: (
          <Relation titre="Livraisons rattachées" lignes={livraisons.lignes} erreur={livraisons.erreur} cle={(l) => l.id} vide="Aucune livraison rattachée"
            lien={(l) => routeDetail(VUE_LIVRAISONS, l.id)}
            colonnes={[
              { libelle: 'Référence', valeur: (l) => l.reference },
              { libelle: 'Date', valeur: (l) => jour(l.date_livraison) },
              { libelle: 'Litres', valeur: (l) => formatNombre(Number(l.volume_litres), 2) },
              { libelle: 'Montant calculé', valeur: (l) => monnaie(l.montant) },
            ]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="journal_factures_carburant_cbg ; à défaut, horodatages de la facture" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une facture carburant CBG" /> },
      ]}
    />
  );
};

export const FormulaireFactureCbg = ({ livraison }: { livraison?: string }) => {
  const peutEcrire = useEcriture();
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ reference: '', date: aujourdhui(), montant: '', livraisons: (livraison ? [livraison] : []) as string[] });

  useEffect(() => {
    Promise.all([
      supabase.from('livraisons_carburant_cbg').select(COLONNES_LIVRAISON).order('date_livraison', { ascending: false }),
      supabase.from('factures_carburant_cbg_livraisons').select('livraison_id'),
    ]).then(([l, r]) => {
      setErreurChargement(l.error ? `Livraisons indisponibles : ${l.error.message}` : r.error ? `Rattachements indisponibles : ${r.error.message}` : '');
      const facturees = new Set(((r.data ?? []) as { livraison_id: string }[]).map((x) => x.livraison_id));
      setLivraisons(((l.data ?? []) as unknown as Livraison[]).filter((x) => !facturees.has(x.id)));
    });
  }, []);

  const attendu = (livraisons ?? []).filter((l) => f.livraisons.includes(l.id)).reduce((s, l) => s + Number(l.montant), 0);
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursFactureCbg(f)];
  const basculer = (id: string, coche: boolean) => poser('livraisons', coche ? [...f.livraisons, id] : f.livraisons.filter((x) => x !== id));

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('enregistrer_facture_carburant_cbg', {
      p_reference: f.reference.trim(), p_date: f.date, p_montant: lireNombre(f.montant), p_livraison_ids: f.livraisons,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Facture enregistrée. Lancez le contrôle pour rapprocher son montant.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_LIVRAISONS, idRoute('facture', data)) : routeListe(VUE_LIVRAISONS) };
  };

  return (
    <PageFormulaire
      vue={VUE_LIVRAISONS}
      module={MODULE_LIVRAISONS}
      titre="Saisir une facture CBG"
      description="Associez toutes les livraisons portées sur la facture. Le contrôle compare ensuite le montant facturé à la somme des quantités × prix saisis à la livraison."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer la facture"
      chargement={livraisons === null}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Facture">
        <ChampPage libelle="Référence facture *">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Date facture *">
          <input type="date" value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Montant facturé (GNF) *" aide={f.livraisons.length > 0 ? `Somme des livraisons cochées : ${monnaie(attendu)}` : undefined}>
          <input inputMode="decimal" value={f.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
      <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Livraisons portées sur la facture *</legend>
        {livraisons && livraisons.length === 0 ? <SansDonnees message="Aucune livraison à facturer" detail="Toutes les livraisons saisies sont déjà rattachées à une facture." /> : (
          <div className="max-h-72 space-y-1 overflow-auto">
            {(livraisons ?? []).map((l) => (
              <label key={l.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={f.livraisons.includes(l.id)} onChange={(e) => basculer(l.id, e.target.checked)} />
                {l.reference} · {jour(l.date_livraison)} · {formatNombre(Number(l.volume_litres))} L · {monnaie(l.montant)}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </PageFormulaire>
  );
};

export const ActionFactureCbg = ({ id, action }: { id: string; action: string }) => {
  const peutEcrire = useEcriture();
  const [facture, setFacture] = useState<FactureCbg | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<FactureCbg>(supabase.from('factures_carburant_cbg').select(COLONNES_FACTURE_CBG).eq('id', id), 'facture CBG').then((r) => {
      const f = trouver(r.lignes, id);
      setFacture(f);
      setErreur(r.erreur || (f ? '' : 'Facture introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id]);

  if (action !== 'controler') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une facture carburant CBG.`} />;
  return (
    <PageAction
      vue={VUE_LIVRAISONS}
      module={MODULE_LIVRAISONS}
      reference={facture ? `Facture ${facture.reference}` : 'Facture CBG'}
      id={idRoute('facture', id)}
      titre={`Contrôler la facture ${facture?.reference ?? ''}`.trim()}
      description="Le serveur calcule le montant attendu (somme des livraisons rattachées) et l'écart avec le montant facturé. Un écart est signalé « à examiner », jamais corrigé. Le contrôle est fait une seule fois et journalisé."
      motif="aucun"
      libelleConfirmer="Contrôler"
      interdit={facture ? controleFactureInterdit(facture.statut, peutEcrire) : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces="Contrôle effectué : l'état (conforme ou à examiner) et l'écart sont sur la fiche."
      onExecuter={async () => {
        const { error } = await supabase.rpc('controler_facture_carburant_cbg', { p_facture_id: id });
        return error ? error.message : null;
      }}
    />
  );
};
