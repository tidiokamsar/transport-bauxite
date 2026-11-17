import { useEffect, useState, type ReactNode } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import {
  ACTIONS_INVENTAIRE, ACTIONS_MOUVEMENT, LIBELLE_STATUT_DECISION, METHODES_MESURE, MODULE_STOCKS, VUE_LIVRAISONS, VUE_PLEINS, VUE_STOCKS,
  actionInventaireInterdite, actionMouvementInterdite, idRoute, type ActionInventaire as NomActionInventaire, type ActionMouvement as NomActionMouvement,
} from './carburant';
import { LIBELLE_MOUVEMENT } from './stocks';
import { COLONNES_INVENTAIRE, COLONNES_MOUVEMENT, litres, type Inventaire, type Mouvement } from './registre';

// Fiches et decisions d'un mouvement et d'un inventaire du registre
// carburant (D-041, D-090) : decider_mouvement_carburant,
// annuler_mouvement_carburant et decider_inventaire_carburant. Motif exige
// par le serveur pour un rejet ou une annulation ; facultatif a la
// validation (conserve en motif_decision). La separation des taches (autre
// personne que l'auteur) est controlee par le serveur.

interface Reception { id: string; livraison_id: string; volume_mesure: number; volume_accepte: number; methode_mesure: string; motif_ecart: string | null }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const useEcriture = () => {
  const { hasPermission } = useAuth();
  return hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
};
const methode = (m: string) => METHODES_MESURE.find(([k]) => k === m)?.[1] ?? m;
const libelleMouvement = (m: Mouvement) => `Mouvement n° ${m.numero}`;

const lireCode = async (stockage: string) => {
  const { data } = await supabase.from('stockages_carburant').select('id, code').eq('id', stockage);
  return ((data ?? []) as { id: string; code: string }[]).find((s) => s.id === stockage)?.code ?? '';
};

/** Mouvements lies : paire de transfert, mouvement annule, contre-mouvement. */
const lireLies = async (m: Mouvement): Promise<Lecture<Mouvement>> => {
  const requetes = [
    lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('annule_mouvement_id', m.id), 'annulation'),
    ...(m.transfert_id ? [lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('transfert_id', m.transfert_id), 'transfert')] : []),
    ...(m.annule_mouvement_id ? [lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('id', m.annule_mouvement_id), 'mouvement annulé')] : []),
  ];
  const r = await Promise.all(requetes);
  const erreur = r.find((x) => x.erreur)?.erreur ?? '';
  if (erreur) return { lignes: null, erreur };
  const [annulations, ...autres] = r;
  const lies = [
    ...(annulations.lignes ?? []).filter((x) => x.annule_mouvement_id === m.id),
    ...(m.transfert_id ? (autres.shift()?.lignes ?? []).filter((x) => x.transfert_id === m.transfert_id && x.id !== m.id) : []),
    ...(m.annule_mouvement_id ? (autres.shift()?.lignes ?? []).filter((x) => x.id === m.annule_mouvement_id) : []),
  ];
  return { lignes: lies.filter((x, i, t) => t.findIndex((y) => y.id === x.id) === i), erreur: '' };
};

const relationLien = (lie: Mouvement, m: Mouvement) =>
  lie.annule_mouvement_id === m.id ? 'Contre-mouvement (annulation)' : lie.id === m.annule_mouvement_id ? 'Mouvement annulé' : 'Autre moitié du transfert';

export const FicheMouvement = ({ id }: { id: string }) => {
  const peutEcrire = useEcriture();
  const [mouvement, setMouvement] = useState<Lecture<Mouvement>>(attente);
  const [lies, setLies] = useState<Lecture<Mouvement>>(attente);
  const [code, setCode] = useState('');
  const [reception, setReception] = useState<Reception | null>(null);
  const [livraison, setLivraison] = useState('');

  useEffect(() => {
    lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('id', id), 'mouvement').then(async (r) => {
      setMouvement(r);
      const m = trouver(r.lignes, id);
      if (!m) return;
      lireCode(m.stockage_id).then(setCode);
      lireLies(m).then(setLies);
      if (m.reception_id) {
        const { data } = await supabase.from('receptions_carburant').select('id, livraison_id, volume_mesure, volume_accepte, methode_mesure, motif_ecart').eq('id', m.reception_id);
        const rec = ((data ?? []) as Reception[]).find((x) => x.id === m.reception_id) ?? null;
        setReception(rec);
        if (rec) {
          const l = await supabase.from('livraisons_carburant_cbg').select('id, reference').eq('id', rec.livraison_id);
          setLivraison(((l.data ?? []) as { id: string; reference: string }[]).find((x) => x.id === rec.livraison_id)?.reference ?? '');
        }
      }
    });
  }, [id]);

  const m = trouver(mouvement.lignes, id);
  const routeId = idRoute('mouvement', id);
  const dejaAnnule = (lies.lignes ?? []).some((x) => x.annule_mouvement_id === id && x.statut !== 'rejete');
  const possible = (a: NomActionMouvement) => Boolean(m) && lies.lignes !== null && actionMouvementInterdite(a, m!, { peutEcrire, dejaAnnule }) === null;

  const historique: EvenementHistorique[] | null = m && lies.lignes ? fusionnerHistoriques(
    [{ id: 'mouvement-saisi', le: m.saisi_le, libelle: `${LIBELLE_MOUVEMENT[m.type]} saisi(e), à valider`, detail: m.note, auteur: m.saisi_par, source: 'mouvements_carburant.saisi_le' }],
    m.decide_le ? [{ id: 'mouvement-decide', le: m.decide_le, libelle: m.statut === 'valide' ? 'Mouvement validé' : 'Mouvement rejeté', motif: m.motif_decision, auteur: m.decide_par, source: 'mouvements_carburant.decide_le' }] : [],
    lies.lignes.filter((x) => x.annule_mouvement_id === id).flatMap((x) => [
      { id: `annulation-${x.id}`, le: x.saisi_le, libelle: `Annulation demandée (contre-mouvement n° ${x.numero})`, motif: x.note, auteur: x.saisi_par, source: 'mouvements_carburant (annulation)' },
      ...(x.decide_le ? [{ id: `annulation-${x.id}-decide`, le: x.decide_le, libelle: `Annulation ${x.statut === 'valide' ? 'validée' : 'rejetée'}`, motif: x.motif_decision, auteur: x.decide_par, source: 'mouvements_carburant (annulation)' }] : []),
    ]),
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={m ? libelleMouvement(m) : 'Mouvement'}
      statut={m ? LIBELLE_STATUT_DECISION[m.statut] : null}
      resume={m && <>{LIBELLE_MOUVEMENT[m.type]} · {code || 'stockage'} · {Number(m.variation) > 0 ? '+' : ''}{formatNombre(Number(m.variation), 0)} L · {new Date(m.date_mouvement).toLocaleString('fr-FR')}</>}
      chargement={mouvement.lignes === null && !mouvement.erreur}
      erreur={mouvement.erreur}
      introuvable={mouvement.lignes !== null && !m}
      actions={[
        { id: 'valider', libelle: 'Valider', icone: <Check className="h-4 w-4" />, ton: 'principal', visible: possible('valider'), vers: routeAction(VUE_STOCKS, routeId, 'valider') },
        { id: 'rejeter', libelle: 'Rejeter', icone: <X className="h-4 w-4" />, ton: 'danger', visible: possible('rejeter'), vers: routeAction(VUE_STOCKS, routeId, 'rejeter') },
        { id: 'annuler', libelle: 'Annuler', icone: <Undo2 className="h-4 w-4" />, ton: 'danger', visible: possible('annuler'), vers: routeAction(VUE_STOCKS, routeId, 'annuler') },
      ]}
      onglets={!m ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Mouvement', champs: [['Numéro', `n° ${m.numero}`], ['Type', LIBELLE_MOUVEMENT[m.type]],
              ['Stockage', code ? <a href={routeDetail(VUE_STOCKS, m.stockage_id)} className="font-semibold text-orange-800 hover:underline">{code}</a> : null],
              ['Variation', `${Number(m.variation) > 0 ? '+' : ''}${formatNombre(Number(m.variation), 0)} L`], ['Date du mouvement', new Date(m.date_mouvement).toLocaleString('fr-FR')],
              ['Pièce', m.reference_piece], ['Note', m.note]] },
            { titre: 'Décision', champs: [['État', LIBELLE_STATUT_DECISION[m.statut].libelle], ['Décidé le', m.decide_le ? new Date(m.decide_le).toLocaleString('fr-FR') : null],
              ['Motif de la décision', m.motif_decision],
              ...(reception ? [['Réception', <>{livraison ? <a href={routeDetail(VUE_LIVRAISONS, reception.livraison_id)} className="font-semibold text-orange-800 hover:underline">{livraison}</a> : 'Livraison CBG'} : mesuré {litres(reception.volume_mesure)}, accepté {litres(reception.volume_accepte)} ({methode(reception.methode_mesure)})</>] as [string, ReactNode],
                ['Motif d\'écart à la réception', reception.motif_ecart] as [string, ReactNode]] : []),
              ...(m.fuel_transaction_id ? [['Plein à l\'origine', <a href={routeDetail(VUE_PLEINS, m.fuel_transaction_id)} className="font-semibold text-orange-800 hover:underline">{m.reference_piece ?? 'Plein'}</a>] as [string, ReactNode]] : []),
              ...(m.inventaire_id ? [['Inventaire à l\'origine', <a href={routeDetail(VUE_STOCKS, idRoute('inventaire', m.inventaire_id))} className="font-semibold text-orange-800 hover:underline">Voir l'inventaire</a>] as [string, ReactNode]] : []),
            ] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Mouvements liés', compte: lies.lignes?.length ?? null, contenu: (
          <Relation titre="Mouvements liés" lignes={lies.lignes} erreur={lies.erreur} cle={(x) => x.id} vide="Aucun mouvement lié (transfert ou annulation)"
            lien={(x) => routeDetail(VUE_STOCKS, idRoute('mouvement', x.id))}
            colonnes={[
              { libelle: 'Mouvement', valeur: (x) => `n° ${x.numero}` },
              { libelle: 'Lien', valeur: (x) => relationLien(x, m) },
              { libelle: 'Variation', valeur: (x) => `${formatNombre(Number(x.variation), 0)} L` },
              { libelle: 'État', valeur: (x) => <Puce teinte={LIBELLE_STATUT_DECISION[x.statut].teinte}>{LIBELLE_STATUT_DECISION[x.statut].libelle}</Puce> },
            ]}
            note={m.transfert_id ? 'Les deux moitiés d\'un transfert se décident ensemble.' : undefined} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={lies.erreur} source="mouvements_carburant (saisie, décision, contre-mouvement d'annulation)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un mouvement de carburant (les bons de livraison se joignent à la livraison CBG)" /> },
      ]}
    />
  );
};

const TITRES_MOUVEMENT: Record<NomActionMouvement, string> = { valider: 'Valider le mouvement', rejeter: 'Rejeter le mouvement', annuler: 'Annuler le mouvement' };

export const ActionMouvement = ({ id, action }: { id: string; action: string }) => {
  const peutEcrire = useEcriture();
  const [m, setM] = useState<Mouvement | null>(null);
  const [lies, setLies] = useState<Mouvement[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('id', id), 'mouvement').then(async (r) => {
      const ligne = trouver(r.lignes, id);
      setM(ligne);
      let e = r.erreur || (ligne ? '' : 'Mouvement introuvable ou hors de votre périmètre.');
      if (ligne) { const l = await lireLies(ligne); setLies(l.lignes ?? []); e = e || l.erreur; }
      setErreur(e);
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_MOUVEMENT as readonly string[]).includes(action)) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un mouvement de carburant.`} />;
  const a = action as NomActionMouvement;
  const dejaAnnule = lies.some((x) => x.annule_mouvement_id === id && x.statut !== 'rejete');
  const reference = m ? libelleMouvement(m) : 'Mouvement';
  const paire = m?.transfert_id ? ' Les deux moitiés du transfert sont traitées ensemble.' : '';
  return (
    <PageAction
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={reference}
      id={idRoute('mouvement', id)}
      titre={`${TITRES_MOUVEMENT[a]} ${m ? `n° ${m.numero}` : ''}`.trim()}
      description={a === 'annuler'
        ? `Un contre-mouvement de ${m ? formatNombre(-Number(m.variation), 0) : '—'} L est créé et soumis à validation ; le mouvement d'origine n'est ni modifié ni supprimé.${paire}`
        : `${m ? `${LIBELLE_MOUVEMENT[m.type]} de ${formatNombre(Number(m.variation), 0)} L. ` : ''}La décision revient à une autre personne que l'auteur de la saisie (contrôle serveur).${paire}`}
      motif={a === 'valider' ? 'facultatif' : 'obligatoire'}
      motifMinimum={1}
      libelleConfirmer={a === 'valider' ? 'Valider' : a === 'rejeter' ? 'Rejeter' : 'Annuler le mouvement'}
      danger={a !== 'valider'}
      interdit={m ? actionMouvementInterdite(a, m, { peutEcrire, dejaAnnule }) : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={a === 'valider' ? 'Mouvement validé.' : a === 'rejeter' ? 'Mouvement rejeté.' : 'Contre-mouvement créé, à valider.'}
      onExecuter={async (motif) => {
        const { error } = a === 'annuler'
          ? await supabase.rpc('annuler_mouvement_carburant', { p_id: id, p_motif: motif })
          : await supabase.rpc('decider_mouvement_carburant', { p_id: id, p_valider: a === 'valider', p_motif: motif || null });
        return error ? error.message : null;
      }}
    />
  );
};

export const FicheInventaire = ({ id }: { id: string }) => {
  const peutEcrire = useEcriture();
  const [inventaire, setInventaire] = useState<Lecture<Inventaire>>(attente);
  const [ajustements, setAjustements] = useState<Lecture<Mouvement>>(attente);
  const [code, setCode] = useState('');

  useEffect(() => {
    lire<Inventaire>(supabase.from('inventaires_carburant').select(COLONNES_INVENTAIRE).eq('id', id), 'inventaire').then((r) => {
      setInventaire(r);
      const i = trouver(r.lignes, id);
      if (i) lireCode(i.stockage_id).then(setCode);
    });
    lire<Mouvement>(supabase.from('mouvements_carburant').select(COLONNES_MOUVEMENT).eq('inventaire_id', id), 'ajustement')
      .then((r) => setAjustements({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.inventaire_id === id) }));
  }, [id]);

  const i = trouver(inventaire.lignes, id);
  const routeId = idRoute('inventaire', id);
  const possible = Boolean(i) && actionInventaireInterdite(i?.statut ?? 'valide', peutEcrire) === null;
  const titre = i ? `Inventaire ${code || ''} du ${new Date(i.date_mesure).toLocaleDateString('fr-FR')}`.replace('  ', ' ') : 'Inventaire';

  const historique: EvenementHistorique[] | null = i ? fusionnerHistoriques(
    [{ id: 'inventaire-saisi', le: i.cree_le, libelle: `Inventaire saisi : ${litres(i.volume_mesure)} mesurés (${methode(i.methode_mesure)})`, detail: i.note, auteur: i.cree_par, source: 'inventaires_carburant.cree_le' }],
    i.decide_le ? [{ id: 'inventaire-decide', le: i.decide_le, libelle: i.statut === 'valide' ? 'Inventaire validé' : 'Inventaire rejeté', motif: i.motif_decision, auteur: i.decide_par, source: 'inventaires_carburant.decide_le' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={titre}
      statut={i ? LIBELLE_STATUT_DECISION[i.statut] : null}
      resume={i && <>Mesuré {litres(i.volume_mesure)} · théorique {i.solde_theorique === null ? 'sans données (ouverture)' : litres(i.solde_theorique)} · écart {litres(i.ecart)}</>}
      chargement={inventaire.lignes === null && !inventaire.erreur}
      erreur={inventaire.erreur}
      introuvable={inventaire.lignes !== null && !i}
      actions={[
        { id: 'valider', libelle: 'Valider', icone: <Check className="h-4 w-4" />, ton: 'principal', visible: possible, vers: routeAction(VUE_STOCKS, routeId, 'valider') },
        { id: 'rejeter', libelle: 'Rejeter', icone: <X className="h-4 w-4" />, ton: 'danger', visible: possible, vers: routeAction(VUE_STOCKS, routeId, 'rejeter') },
      ]}
      onglets={!i ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Mesure', champs: [['Stockage', code ? <a href={routeDetail(VUE_STOCKS, i.stockage_id)} className="font-semibold text-orange-800 hover:underline">{code}</a> : null],
              ['Date de la mesure', new Date(i.date_mesure).toLocaleString('fr-FR')], ['Méthode', methode(i.methode_mesure)], ['Volume mesuré', litres(i.volume_mesure)], ['Note', i.note]] },
            { titre: 'Écart et décision', champs: [['Solde théorique', i.solde_theorique === null ? 'Sans données (inventaire d\'ouverture)' : litres(i.solde_theorique)],
              ['Écart', litres(i.ecart)], ['État', LIBELLE_STATUT_DECISION[i.statut].libelle], ['Décidé le', i.decide_le ? new Date(i.decide_le).toLocaleString('fr-FR') : null],
              ['Motif de la décision', i.motif_decision]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Ajustement', compte: ajustements.lignes?.length ?? null, contenu: (
          <Relation titre="Ajustement créé à la validation" lignes={ajustements.lignes} erreur={ajustements.erreur} cle={(x) => x.id} vide="Aucun ajustement (inventaire non validé ou sans écart)"
            lien={(x) => routeDetail(VUE_STOCKS, idRoute('mouvement', x.id))}
            colonnes={[
              { libelle: 'Mouvement', valeur: (x) => `n° ${x.numero}` },
              { libelle: 'Variation', valeur: (x) => `${formatNombre(Number(x.variation), 0)} L` },
              { libelle: 'État', valeur: (x) => <Puce teinte={LIBELLE_STATUT_DECISION[x.statut].teinte}>{LIBELLE_STATUT_DECISION[x.statut].libelle}</Puce> },
            ]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} source="inventaires_carburant (saisie et décision)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un inventaire de carburant" /> },
      ]}
    />
  );
};

export const ActionInventaire = ({ id, action }: { id: string; action: string }) => {
  const peutEcrire = useEcriture();
  const [i, setI] = useState<Inventaire | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Inventaire>(supabase.from('inventaires_carburant').select(COLONNES_INVENTAIRE).eq('id', id), 'inventaire').then(async (r) => {
      const ligne = trouver(r.lignes, id);
      setI(ligne);
      if (ligne) setCode(await lireCode(ligne.stockage_id));
      setErreur(r.erreur || (ligne ? '' : 'Inventaire introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_INVENTAIRE as readonly string[]).includes(action)) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un inventaire de carburant.`} />;
  const a = action as NomActionInventaire;
  const valider = a === 'valider';
  return (
    <PageAction
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      reference={i ? `Inventaire ${code}`.trim() : 'Inventaire'}
      id={idRoute('inventaire', id)}
      titre={`${valider ? 'Valider' : 'Rejeter'} l'inventaire ${code}`.trim()}
      description={i && (valider
        ? <>Mesuré {litres(i.volume_mesure)}, théorique {i.solde_theorique === null ? 'sans données (ouverture)' : litres(i.solde_theorique)} : la validation crée un ajustement égal à l'écart ({litres(i.ecart)}). Refusée par le serveur si le solde a changé depuis la mesure ou si vous en êtes l'auteur.</>
        : <>L'inventaire est rejeté avec son motif ; aucun ajustement n'est créé.</>)}
      motif={valider ? 'facultatif' : 'obligatoire'}
      motifMinimum={1}
      libelleConfirmer={valider ? 'Valider' : 'Rejeter'}
      danger={!valider}
      interdit={i ? actionInventaireInterdite(i.statut, peutEcrire) : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={valider ? 'Inventaire validé.' : 'Inventaire rejeté.'}
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('decider_inventaire_carburant', { p_id: id, p_valider: valider, p_motif: motif || null });
        return error ? error.message : null;
      }}
    />
  );
};
