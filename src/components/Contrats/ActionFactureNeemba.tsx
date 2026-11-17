import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BOUTON_SECONDAIRE, CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { FilAriane } from '../ui/PageDetail';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { arianeModule } from '../ui/pages';
import { routeDetail } from '../ui/routeur';
import { montant } from '../Facturation/facturation';
import {
  ACTIONS_FACTURE_F, MODES_REGUL, MODULE_FACTURES_NEEMBA, VUE_FACTURES_NEEMBA, actionFactureFInterdite, nombre, quantite,
  type ActionFactureF, type ContratLoueur, type FactureF, type LigneF, type RegulF,
} from './facturesNeemba';

// Actions d'une facture du loueur en pleine page (D-032, D-090, remplacent
// le window.prompt, la fenetre de regularisation et la lettre en
// superposition) : controler_facture_fournisseur,
// notifier_ecart_fournisseur (reference du courrier facultative),
// enregistrer_regularisation ; lettre de notification imprimable.

interface Societe { raison_sociale: string; adresse: string | null; rccm: string | null; nif: string | null; signataire_nom: string | null; signataire_fonction: string | null }

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : '—');
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const ActionFactureNeemba = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [facture, setFacture] = useState<FactureF | null>(null);
  const [reguls, setReguls] = useState<RegulF[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [champs, setChamps] = useState({ reference: '', date: aujourdhui(), montant: '', mode: 'avoir', refRegul: '' });
  const poser = (k: keyof typeof champs, v: string) => setChamps((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    Promise.all([
      lire<FactureF>(supabase.from('factures_fournisseur').select('*').eq('id', id), 'facture du loueur'),
      lire<RegulF>(supabase.from('regularisations_fournisseur').select('*').eq('facture_id', id), 'régularisations'),
    ]).then(([r, g]) => {
      const f = trouver(r.lignes, id);
      const liste = (g.lignes ?? []).filter((x) => x.facture_id === id);
      setFacture(f);
      setReguls(liste);
      setErreur(r.erreur || g.erreur || (f ? '' : 'Facture introuvable ou non visible avec vos droits.'));
      // Reste reclame propose : calcule sur les montants enregistres.
      if (f?.montant_reclame !== null && f?.montant_reclame !== undefined) {
        const reste = Number(f.montant_reclame) - liste.reduce((s, x) => s + Number(x.montant), 0);
        setChamps((c) => ({ ...c, montant: reste > 0 ? String(reste) : '' }));
      }
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_FACTURE_F as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une facture du loueur.`} />;
  }
  const a = action as ActionFactureF;
  if (a === 'notification') return <LettreNotification id={id} />;

  const commun = {
    vue: VUE_FACTURES_NEEMBA, module: MODULE_FACTURES_NEEMBA, id, chargement, erreurChargement: erreur,
    reference: facture ? `Facture ${facture.numero_fournisseur}` : 'Facture du loueur',
    interdit: facture ? actionFactureFInterdite(a, facture.statut, peutEcrire) : null,
  };
  const resultat = ({ error }: { error: { message: string } | null }) => (error ? error.message : null);

  if (a === 'controler') {
    return (
      <PageAction
        {...commun}
        titre="Contrôler la facture"
        description="Le serveur confronte chaque ligne, dans l'unité du tarif de l'engin, aux heures pointées signées ou aux kilomètres des voyages livrés et au tarif du contrat ; un nouveau contrôle remplace le précédent."
        motif="aucun"
        libelleConfirmer="Contrôler"
        messageSucces="Contrôle effectué."
        onExecuter={async () => resultat(await supabase.rpc('controler_facture_fournisseur', { p_id: id }))}
      />
    );
  }

  if (a === 'notifier') {
    return (
      <PageAction
        {...commun}
        titre="Notifier l'écart au loueur"
        description="Le contrôle est relancé avant la notification : sans écart, la facture passe « Conforme » ; sinon la lettre de notification est disponible depuis la fiche (Notification)."
        motif="aucun"
        libelleConfirmer="Notifier l'écart"
        danger
        pret={Boolean(champs.date) && champs.date <= aujourdhui()}
        messageSucces="Notification traitée : voir le statut de la facture (« Écart notifié », ou « Conforme » si le contrôle ne relève plus d'écart)."
        onExecuter={async () => resultat(await supabase.rpc('notifier_ecart_fournisseur', { p_id: id, p_date: champs.date, p_reference: champs.reference.trim() || null }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Date de notification *">
            <input type="date" value={champs.date} max={aujourdhui()} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Référence du courrier de notification (facultatif)">
            <input value={champs.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      </PageAction>
    );
  }

  const m = nombre(champs.montant);
  const reste = facture?.montant_reclame !== null && facture?.montant_reclame !== undefined
    ? Number(facture.montant_reclame) - reguls.reduce((s, x) => s + Number(x.montant), 0) : null;
  return (
    <PageAction
      {...commun}
      titre="Enregistrer une régularisation"
      description={reste !== null && facture ? `Reste réclamé : ${montant(reste, facture.devise)}. La facture passe « Régularisée » quand le reste est soldé.` : undefined}
      motif="aucun"
      libelleConfirmer="Enregistrer"
      pret={m !== null && !Number.isNaN(m) && m > 0 && Boolean(champs.date) && champs.date <= aujourdhui()}
      messageSucces="Régularisation enregistrée."
      onExecuter={async () => resultat(await supabase.rpc('enregistrer_regularisation', {
        p_id: id, p_date: champs.date, p_montant: m, p_mode: champs.mode, p_reference: champs.refRegul.trim() || null, p_note: null,
      }))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampPage libelle="Date *"><input type="date" value={champs.date} max={aujourdhui()} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle={`Montant *${facture ? ` (${facture.devise})` : ''}`}><input inputMode="decimal" value={champs.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Mode">
          <select value={champs.mode} onChange={(e) => poser('mode', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(MODES_REGUL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Référence"><input value={champs.refRegul} onChange={(e) => poser('refRegul', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </div>
    </PageAction>
  );
};

/** Lettre de notification d'ecart en pleine page, imprimable (remplace la superposition). */
const LettreNotification = ({ id }: { id: string }) => {
  const [facture, setFacture] = useState<FactureF | null>(null);
  const [lignes, setLignes] = useState<LigneF[]>([]);
  const [contrat, setContrat] = useState<ContratLoueur | null>(null);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      lire<FactureF>(supabase.from('factures_fournisseur').select('*').eq('id', id), 'facture du loueur'),
      lire<LigneF>(supabase.from('factures_fournisseur_lignes').select('*').eq('facture_id', id).order('libelle'), 'lignes de la facture'),
      supabase.from('societe').select('raison_sociale, adresse, rccm, nif, signataire_nom, signataire_fonction').eq('id', 1).maybeSingle(),
      supabase.from('vehicles').select('id, registration'),
    ]).then(async ([r, l, s, v]) => {
      const f = trouver(r.lignes, id);
      setFacture(f);
      setLignes((l.lignes ?? []).filter((x) => x.facture_id === id));
      setSociete(s.data as Societe | null);
      setEngins((v.data ?? []) as { id: string; registration: string }[]);
      setErreur(r.erreur || l.erreur || (f ? '' : 'Facture introuvable ou non visible avec vos droits.'));
      if (f) {
        const { data } = await supabase.from('contrats').select('id, reference, contrepartie, devise, nature').eq('id', f.contrat_id);
        setContrat(((data ?? []) as ContratLoueur[]).find((c) => c.id === f.contrat_id) ?? null);
      }
      setChargement(false);
    });
  }, [id]);

  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const interdit = facture ? actionFactureFInterdite('notification', facture.statut, true) : null;
  const ecarts = lignes.filter((l) => (l.ecart ?? 0) > 0);
  const reference = facture ? `Facture ${facture.numero_fournisseur}` : 'Facture du loueur';

  return (
    <div className="space-y-5">
      <div className="pas-imprime space-y-3">
        <FilAriane elements={arianeModule(VUE_FACTURES_NEEMBA, MODULE_FACTURES_NEEMBA, { libelle: reference, vers: routeDetail(VUE_FACTURES_NEEMBA, id) }, { libelle: 'Notification d\'écart' })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-black text-stone-900">Notification d'écart</h1>
          <div className="flex gap-2">
            <a href={routeDetail(VUE_FACTURES_NEEMBA, id)} className={BOUTON_SECONDAIRE}>Retour à la fiche</a>
            {facture && !interdit && (
              <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimer</button>
            )}
          </div>
        </div>
      </div>
      {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
        : chargement ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : interdit || !facture ? <SansDonnees message="Lettre indisponible" detail={interdit ?? undefined} />
            : (
              <div className="zone-impression">
                <article className="mx-auto max-w-[210mm] bg-white p-12 text-sm text-black shadow" aria-label="Notification d'écart">
                  <p className="font-black">{societe?.raison_sociale}</p><p>{societe?.adresse}</p>
                  <p>{[societe?.rccm && `RCCM ${societe.rccm}`, societe?.nif && `NIF ${societe.nif}`].filter(Boolean).join(' · ')}</p>
                  <p className="mt-8 text-right">À l'attention de {contrat?.contrepartie}</p>
                  <p className="text-right">Le {jour(facture.notifiee_le)}{facture.reference_notification ? ` · réf. ${facture.reference_notification}` : ''}</p>
                  <p className="mt-8 font-bold uppercase">Objet : notification d'écart · facture n° {facture.numero_fournisseur} du {jour(facture.date_facture)}</p>
                  <p className="mt-4">Madame, Monsieur,</p>
                  <p className="mt-2">Le contrôle de votre facture n° {facture.numero_fournisseur} (période du {jour(facture.periode_debut)} au {jour(facture.periode_fin)}, contrat {contrat?.reference}) au regard des quantités relevées sur nos justificatifs signés (heures de fonctionnement ou kilomètres parcourus selon l'unité contractuelle de chaque engin) et des tarifs contractuels fait apparaître les écarts suivants :</p>
                  <table className="mt-3 w-full border-collapse text-xs">
                    <thead><tr className="border-y border-black text-left"><th className="py-1">Engin</th><th className="py-1 text-right">Quantité facturée</th><th className="py-1 text-right">Quantité relevée</th><th className="py-1 text-right">Facturé</th><th className="py-1 text-right">Dû selon contrat</th><th className="py-1 text-right">Écart</th></tr></thead>
                    <tbody>{ecarts.map((l) => (
                      <tr key={l.id} className="border-b border-stone-300">
                        <td className="py-1">{l.vehicle_id ? immat.get(l.vehicle_id) ?? l.libelle : l.libelle}</td>
                        <td className="py-1 text-right">{quantite(l.quantite_facturee, l.unite_facturee, l.heures_facturees)}</td>
                        <td className="py-1 text-right">{quantite(l.quantite_attendue, l.unite_attendue)}</td>
                        <td className="py-1 text-right">{montant(l.montant_facture, facture.devise)}</td>
                        <td className="py-1 text-right">{l.montant_attendu === null ? '—' : montant(l.montant_attendu, facture.devise)}</td>
                        <td className="py-1 text-right font-bold">{montant(l.ecart ?? 0, facture.devise)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <p className="mt-3">Le montant facturé en excédent s'élève à <b>{montant(facture.montant_reclame ?? 0, facture.devise)}</b>. Nous vous demandons d'en procéder à la régularisation par avoir, ou d'accepter sa déduction sur le prochain règlement, et restons à votre disposition pour rapprocher contradictoirement les relevés.</p>
                  <p className="mt-4">Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
                  <p className="mt-10 font-bold">{societe?.signataire_fonction ?? 'Pour la société'}</p><p>{societe?.signataire_nom ?? ''}</p>
                </article>
              </div>
            )}
    </div>
  );
};
