import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import type { ExigenceMotif } from '../ui/pages';
import { lignesOffrePourServeur, type Fournisseur } from './fournisseurs';
import { COLONNES_CONSULTATION, aujourdhui, lignesDe, type Consultation, type Invite, type LigneConsultation, type Offre } from './donnees';
import {
  ACTIONS_CONSULTATION, MODULE_FOURNISSEURS, VUE_FOURNISSEURS, actionConsultationInterdite, idRouteConsultation, routeConsultation,
  type ActionConsultation,
} from './routes';
import { erreursSaisieOffre, type SaisieOffre } from './saisie';

// Actions d'une consultation en pleine page (D-059, D-090, remplace les
// window.prompt et les saisies en ligne), chacune par sa fonction serveur.
// Motif exige (non vide) par selectionner_offre, retirer_offre et
// annuler_consultation.

export const ActionConsultationVue = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [c, setC] = useState<Consultation | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [lignes, setLignes] = useState<LigneConsultation[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Pick<Fournisseur, 'id' | 'company_name' | 'active'>[]>([]);
  const [depots, setDepots] = useState<{ id: string; libelle: string }[]>([]);
  const [offre, setOffre] = useState<SaisieOffre>({ fournisseur: '', reference: '', recue: aujourdhui(), delai: '', validite: '', conditions: '' });
  const [prix, setPrix] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState('');
  const [preparer, setPreparer] = useState(true);
  const [depotBon, setDepotBon] = useState('');

  useEffect(() => {
    Promise.all([
      lire<Consultation>(supabase.from('consultations_fournisseurs').select(COLONNES_CONSULTATION).eq('id', id), 'consultation'),
      lire<LigneConsultation>(supabase.from('consultations_lignes').select('id, consultation_id, ordre, stock_item_id, designation, quantite').eq('consultation_id', id).order('ordre'), 'lignes'),
      lire<Invite>(supabase.from('consultations_invites').select('consultation_id, supplier_id').eq('consultation_id', id), 'fournisseurs consultés'),
      lire<Offre>(supabase.from('offres_fournisseurs').select('id, consultation_id, supplier_id, reference_offre, recue_le, delai_livraison_jours, validite_jusqu_au, conditions, montant_total, lignes_chiffrees, statut, motif_retrait').eq('consultation_id', id), 'offres'),
      supabase.from('suppliers').select('id, company_name, active').order('company_name'),
      supabase.from('warehouses').select('id, name, code').order('name'),
    ]).then(([co, li, inv, of, fo, de]) => {
      const x = trouver(co.lignes, id);
      setC(x);
      setLignes(lignesDe(li.lignes, 'consultation_id', id) ?? []);
      const lesInvites = lignesDe(inv.lignes, 'consultation_id', id) ?? [];
      const lesOffres = lignesDe(of.lignes, 'consultation_id', id) ?? [];
      setInvites(lesInvites);
      setOffres(lesOffres);
      setFournisseurs((fo.data ?? []) as Pick<Fournisseur, 'id' | 'company_name' | 'active'>[]);
      setDepots(((de.data ?? []) as { id: string; name: string; code: string }[]).map((d) => ({ id: d.id, libelle: `${d.name} (${d.code})` })));
      const premier = lesInvites.find((i) => !lesOffres.some((o) => o.supplier_id === i.supplier_id && o.statut !== 'retiree'));
      if (premier) setOffre((o) => ({ ...o, fournisseur: premier.supplier_id }));
      setErreur(co.erreur || li.erreur || inv.erreur || of.erreur || (x ? '' : 'Consultation introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_CONSULTATION as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une consultation.`} />;
  }
  const a = action as ActionConsultation;
  const nom = (s: string) => fournisseurs.find((f) => f.id === s)?.company_name ?? 'Fournisseur non visible';
  const offreCible = a === 'retenir' || a === 'retirer-offre' ? (offres.find((o) => o.id === requete.offre) ?? null) : undefined;
  const interditEtat = c ? actionConsultationInterdite(a, c, peutEcrire, chargement ? undefined : offreCible) : null;
  const sansOffre = invites.filter((i) => !offres.some((o) => o.supplier_id === i.supplier_id && o.statut !== 'retiree'));
  const nonConsultes = fournisseurs.filter((f) => f.active !== false && !invites.some((i) => i.supplier_id === f.id));
  const prixServeur = lignesOffrePourServeur(prix);
  const erreursOffre = erreursSaisieOffre(offre, prixServeur !== null);
  const preparerALaSelection = preparer && Boolean(c?.warehouse_id);

  const definition: Record<ActionConsultation, {
    titre: string; confirmer: string; succes: string; description: ReactNode; motif: ExigenceMotif; danger?: boolean; pret?: boolean; interdit?: string | null;
    executer: (motif: string) => PromiseLike<{ error: { message: string } | null }>; champs?: ReactNode;
  }> = {
    offre: {
      titre: 'Saisir une offre reçue', confirmer: 'Enregistrer l\'offre', motif: 'aucun', succes: 'Offre enregistrée.', pret: erreursOffre.length === 0,
      interdit: !chargement && sansOffre.length === 0 ? 'Tous les fournisseurs consultés ont une offre en cours : retirer une offre (motif) avant de la ressaisir.' : null,
      description: 'Prix unitaires par ligne ; une ligne laissée vide n\'est pas chiffrée et l\'offre ne sera pas classée.',
      executer: () => supabase.rpc('enregistrer_offre', {
        p_consultation: id, p_fournisseur: offre.fournisseur, p_lignes: prixServeur, p_delai_jours: Number(offre.delai.trim()),
        p_recue_le: offre.recue || aujourdhui(), p_reference: offre.reference.trim() || null, p_validite: offre.validite || null,
        p_conditions: offre.conditions.trim() || null,
      }),
      champs: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampPage libelle="Fournisseur *">
              <select value={offre.fournisseur} onChange={(e) => setOffre({ ...offre, fournisseur: e.target.value })} className={CHAMP_FENETRE}>
                {sansOffre.map((i) => <option key={i.supplier_id} value={i.supplier_id}>{nom(i.supplier_id)}</option>)}
              </select>
            </ChampPage>
            <ChampPage libelle="Référence de l'offre"><input value={offre.reference} onChange={(e) => setOffre({ ...offre, reference: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
            <ChampPage libelle="Reçue le *"><input type="date" value={offre.recue} onChange={(e) => setOffre({ ...offre, recue: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
            <ChampPage libelle="Délai de livraison (jours) *"><input inputMode="numeric" value={offre.delai} onChange={(e) => setOffre({ ...offre, delai: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
            <ChampPage libelle="Valable jusqu'au"><input type="date" value={offre.validite} onChange={(e) => setOffre({ ...offre, validite: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
            <ChampPage libelle="Conditions"><input value={offre.conditions} onChange={(e) => setOffre({ ...offre, conditions: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-1 pr-2">Ligne</th><th className="py-1 pr-2">Quantité</th><th className="py-1 pr-2">Prix unitaire (GNF), vide si non chiffré</th></tr></thead>
            <tbody>{lignes.map((l) => (
              <tr key={l.id}><td className="py-1 pr-2">{l.designation}</td><td className="py-1 pr-2">{l.quantite}</td>
                <td className="py-1 pr-2"><input aria-label={`Prix ${l.designation}`} inputMode="numeric" value={prix[l.id] ?? ''} onChange={(e) => setPrix({ ...prix, [l.id]: e.target.value })} className={CHAMP_FENETRE} /></td></tr>
            ))}</tbody>
          </table>
          {erreursOffre.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-800">{erreursOffre.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      ),
    },
    retenir: {
      titre: `Retenir l'offre de ${offreCible ? nom(offreCible.supplier_id) : 'ce fournisseur'}`, confirmer: 'Retenir l\'offre', motif: 'obligatoire',
      succes: preparerALaSelection ? 'Offre retenue : bon de commande brouillon préparé (à soumettre dans Achats).'
        : c?.warehouse_id ? 'Offre retenue.' : 'Offre retenue. Choisir le dépôt de livraison pour préparer le bon de commande.',
      description: 'La sélection attribue la consultation ; les autres offres sont écartées. Le motif est conservé sur la consultation et au journal.',
      executer: (motif) => supabase.rpc('selectionner_offre', { p_offre: offreCible?.id, p_motif: motif, p_preparer_bon: preparerALaSelection }),
      champs: (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={preparerALaSelection} disabled={!c?.warehouse_id} onChange={(e) => setPreparer(e.target.checked)} />
          {!c?.warehouse_id && 'Dépôt à préciser : bon à préparer après la sélection. '}Préparer le bon de commande brouillon
        </label>
      ),
    },
    'retirer-offre': {
      titre: `Retirer l'offre de ${offreCible ? nom(offreCible.supplier_id) : 'ce fournisseur'}`, confirmer: 'Retirer l\'offre', danger: true, motif: 'obligatoire',
      succes: 'Offre retirée.', description: 'L\'offre n\'est pas supprimée : elle est marquée retirée avec son motif et peut être ressaisie.',
      executer: (motif) => supabase.rpc('retirer_offre', { p_offre: offreCible?.id, p_motif: motif }),
    },
    annuler: {
      titre: `Annuler la consultation ${c?.numero ?? ''}`.trim(), confirmer: 'Annuler la consultation', danger: true, motif: 'obligatoire',
      succes: 'Consultation annulée.', description: 'La consultation reste consultable, avec le motif de l\'annulation.',
      executer: (motif) => supabase.rpc('annuler_consultation', { p_id: id, p_motif: motif }),
    },
    inviter: {
      titre: 'Consulter un autre fournisseur', confirmer: 'Ajouter', motif: 'aucun', succes: 'Fournisseur ajouté à la consultation.', pret: Boolean(invite),
      interdit: !chargement && nonConsultes.length === 0 ? 'Tous les fournisseurs actifs sont déjà consultés.' : null,
      description: 'Seuls les fournisseurs actifs peuvent être consultés.',
      executer: () => supabase.rpc('inviter_fournisseur_consultation', { p_consultation: id, p_fournisseur: invite }),
      champs: (
        <ChampPage libelle="Fournisseur à consulter *">
          <select value={invite} onChange={(e) => setInvite(e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>{nonConsultes.map((f) => <option key={f.id} value={f.id}>{f.company_name}</option>)}
          </select>
        </ChampPage>
      ),
    },
    'preparer-bon': {
      titre: 'Préparer le bon de commande', confirmer: 'Préparer le bon de commande', motif: 'aucun', succes: 'Bon de commande brouillon préparé.',
      pret: Boolean(c?.warehouse_id) || Boolean(depotBon),
      description: 'Le bon de commande brouillon reprend l\'offre retenue ; il se soumet ensuite dans Achats (circuit D-053).',
      executer: () => supabase.rpc('preparer_bon_commande_consultation', { p_consultation: id, p_depot: c?.warehouse_id ? null : depotBon }),
      champs: c && !c.warehouse_id ? (
        <ChampPage libelle="Dépôt de livraison du bon *">
          <select value={depotBon} onChange={(e) => setDepotBon(e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Dépôt de livraison requis</option>{depots.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
          </select>
        </ChampPage>
      ) : null,
    },
  };
  const d = definition[a];

  return (
    <PageAction
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      reference={c ? `Consultation ${c.numero}` : 'Consultation'}
      id={idRouteConsultation(id)}
      chargement={chargement}
      erreurChargement={erreur}
      titre={d.titre}
      description={d.description}
      motif={d.motif}
      motifMinimum={1}
      libelleConfirmer={d.confirmer}
      danger={d.danger}
      interdit={interditEtat ?? d.interdit ?? null}
      pret={d.pret ?? true}
      messageSucces={d.succes}
      versApres={routeConsultation(id, a === 'offre' || a === 'retenir' || a === 'retirer-offre' ? 'offres' : undefined)}
      onExecuter={async (motif) => {
        const { error } = await d.executer(motif);
        return error ? error.message : null;
      }}
    >
      {d.champs}
    </PageAction>
  );
};
