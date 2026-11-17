import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, FileText, Printer, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { FilAriane, Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage } from '../ui/PageFormulaire';
import { Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { arianeModule } from '../ui/pages';
import { ecrireRoute, routeAction, routeDetail } from '../ui/routeur';
import { CANAUX_RELANCE, MODES_ENCAISSEMENT, NIVEAUX_RELANCE, VUE_FACTURES, VUE_RECOUVREMENT, lireMontant, montant } from './facturation';
import { COLONNES_CREANCE, encaissementInterdit, niveauSuivant, relanceInterdite, type Creance } from './creances';

// Fiche d'une creance (D-031, D-090) : du, encaisse, reste et retard ;
// encaissements et relances (relations et historique) ; actions encaisser
// et relancer en pleine page ; lettre de relance imprimable en pleine page.

interface Encaissement { id: string; facture_id: string; date_encaissement: string; montant: number; mode: string; reference: string | null; note: string | null; saisi_par: string | null; saisi_le: string }
interface Relance { id: string; facture_id: string; niveau: number; date_relance: string; canal: string; note: string | null; auteur: string | null; le: string }
interface Societe { raison_sociale: string; adresse: string | null; rccm: string | null; nif: string | null; signataire_nom: string | null; signataire_fonction: string | null }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : null);
const MODULE = 'Recouvrement';

/** Creance et nom du client, lus pour une fiche, une action ou une lettre. */
const useCreance = (id: string) => {
  const [creance, setCreance] = useState<Lecture<Creance>>(attente);
  const [client, setClient] = useState('');
  useEffect(() => {
    lire<Creance>(supabase.from('v_creances').select(COLONNES_CREANCE).eq('id', id), 'créance').then(async (r) => {
      setCreance(r);
      const c = trouver(r.lignes, id);
      if (!c) return;
      const k = await supabase.from('contrats').select('id, contrepartie').eq('id', c.contrat_id);
      setClient(((k.data ?? []) as { id: string; contrepartie: string }[]).find((x) => x.id === c.contrat_id)?.contrepartie ?? '');
    });
  }, [id]);
  return { creance, c: trouver(creance.lignes, id), client };
};

export const DetailCreance = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const ecrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const { creance, c, client } = useCreance(id);
  const [encaissements, setEncaissements] = useState<Lecture<Encaissement>>(attente);
  const [relances, setRelances] = useState<Lecture<Relance>>(attente);

  useEffect(() => {
    lire<Encaissement>(supabase.from('encaissements').select('*').eq('facture_id', id).order('date_encaissement'), 'encaissements')
      .then((r) => setEncaissements({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
    lire<Relance>(supabase.from('relances').select('*').eq('facture_id', id).order('niveau'), 'relances')
      .then((r) => setRelances({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
  }, [id]);

  const historique: EvenementHistorique[] | null = encaissements.lignes && relances.lignes ? fusionnerHistoriques(
    encaissements.lignes.map((e) => ({ id: `encaissements-${e.id}`, le: e.saisi_le, libelle: `Encaissement de ${montant(e.montant, c?.devise ?? '')}`,
      detail: `Reçu le ${jour(e.date_encaissement)} · ${MODES_ENCAISSEMENT[e.mode] ?? e.mode}${e.reference ? ` · réf. ${e.reference}` : ''}${e.note ? ` · ${e.note}` : ''}`, auteur: e.saisi_par, source: 'encaissements' })),
    relances.lignes.map((r) => ({ id: `relances-${r.id}`, le: r.le, libelle: `${NIVEAUX_RELANCE[r.niveau] ?? `Relance ${r.niveau}`} (${CANAUX_RELANCE[r.canal] ?? r.canal})`, detail: r.note, auteur: r.auteur, source: 'relances' })),
  ) : null;

  return (
    <PageDetail
      vue={VUE_RECOUVREMENT}
      module={MODULE}
      reference={c?.numero ?? 'Créance'}
      titre={c ? `Créance ${c.numero}` : undefined}
      statut={c ? (Number(c.reste) <= 0 ? { libelle: 'Soldée', teinte: 'vert' } : (c.jours_retard ?? 0) > 0 ? { libelle: `${c.jours_retard} j de retard`, teinte: 'rouge' } : { libelle: 'Non échue', teinte: 'bleu' }) : null}
      resume={c && <>{client} · reste {montant(c.reste, c.devise)} sur {montant(c.du, c.devise)}</>}
      chargement={creance.lignes === null && !creance.erreur}
      erreur={creance.erreur}
      introuvable={creance.lignes !== null && !c}
      actions={[
        { id: 'encaisser', libelle: 'Encaisser', icone: <Wallet className="h-4 w-4" />, visible: Boolean(c) && encaissementInterdit(c as Creance, ecrire) === null, ton: 'principal', vers: routeAction(VUE_RECOUVREMENT, id, 'encaisser') },
        { id: 'relancer', libelle: c ? NIVEAUX_RELANCE[niveauSuivant(c)] ?? 'Relancer' : 'Relancer', icone: <BellRing className="h-4 w-4" />, visible: Boolean(c) && relanceInterdite(c as Creance, ecrire) === null, vers: routeAction(VUE_RECOUVREMENT, id, 'relancer') },
        { id: 'facture', libelle: 'Fiche de la facture', icone: <FileText className="h-4 w-4" />, visible: Boolean(c), vers: routeDetail(VUE_FACTURES, id) },
      ]}
      onglets={!c ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Facture', champs: [['Numéro', c.numero], ['Client', client || null], ['Émise le', jour(c.date_emission)], ['Échéance', jour(c.date_echeance) ?? 'Non définie (délai absent du contrat)']] },
            { titre: 'Montants', champs: [['TTC', montant(c.montant_ttc, c.devise)], ['Avoirs émis', montant(c.avoirs, c.devise)], ['Dû', montant(c.du, c.devise)],
              ['Encaissé', montant(c.encaisse, c.devise)], ['Reste', <b key="reste">{montant(c.reste, c.devise)}</b>],
              ['Retard', (c.jours_retard ?? 0) > 0 ? `${c.jours_retard} jour(s)` : 'Aucun'], ['Dernier encaissement', jour(c.dernier_encaissement)]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Encaissements et relances', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Encaissements" lignes={encaissements.lignes} erreur={encaissements.erreur} cle={(e) => e.id} vide="Aucun encaissement"
              colonnes={[{ libelle: 'Date', valeur: (e) => jour(e.date_encaissement) }, { libelle: 'Montant', valeur: (e) => montant(e.montant, c.devise) },
                { libelle: 'Mode', valeur: (e) => MODES_ENCAISSEMENT[e.mode] ?? e.mode }, { libelle: 'Référence', valeur: (e) => e.reference ?? '—' }]} />
            <Relation titre="Relances" lignes={relances.lignes} erreur={relances.erreur} cle={(r) => r.id} vide="Aucune relance"
              lien={(r) => ecrireRoute({ vue: VUE_RECOUVREMENT, mode: 'action', id, action: 'lettre', requete: { niveau: String(r.niveau) } })}
              note="Le niveau ouvre la lettre imprimable de la relance."
              colonnes={[{ libelle: 'Niveau', valeur: (r) => NIVEAUX_RELANCE[r.niveau] ?? r.niveau }, { libelle: 'Date', valeur: (r) => jour(r.date_relance) },
                { libelle: 'Canal', valeur: (r) => CANAUX_RELANCE[r.canal] ?? r.canal }, { libelle: 'Note', valeur: (r) => r.note ?? '—' }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={encaissements.erreur || relances.erreur} source="encaissements, relances (le circuit de la facture est dans sa fiche)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une créance (preuve de paiement)" /> },
      ]}
    />
  );
};

export const ActionCreance = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const ecrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const { creance, c } = useCreance(id);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), montant: '', mode: 'virement', reference: '', canal: 'email', note: '' });
  const [initialise, setInitialise] = useState(false);
  useEffect(() => {
    if (c && !initialise) { setF((x) => ({ ...x, montant: String(c.reste) })); setInitialise(true); }
  }, [c, initialise]);

  if (action !== 'encaisser' && action !== 'relancer') {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du recouvrement.`} />;
  }
  const commun = {
    vue: VUE_RECOUVREMENT, module: MODULE, reference: c?.numero ?? 'Créance', id,
    chargement: creance.lignes === null && !creance.erreur, erreurChargement: creance.erreur || (creance.lignes !== null && !c ? 'Créance introuvable ou non visible avec vos droits.' : ''),
  };

  if (action === 'encaisser') {
    const valeur = lireMontant(f.montant);
    return (
      <PageAction
        {...commun}
        titre={`Encaissement · ${c?.numero ?? ''}`.trim()}
        description={c && <>Reste dû : <b>{montant(c.reste, c.devise)}</b>. Le montant encaissé ne dépasse pas le reste dû (contrôle serveur).</>}
        motif="aucun"
        libelleConfirmer="Enregistrer l'encaissement"
        interdit={c ? encaissementInterdit(c, ecrire) : null}
        pret={Boolean(f.date) && valeur !== null && valeur > 0}
        messageSucces={`Encaissement enregistré sur ${c?.numero ?? 'la facture'}.`}
        onExecuter={async () => {
          const { error } = await supabase.rpc('enregistrer_encaissement', {
            p_facture_id: id, p_date: f.date, p_montant: valeur, p_mode: f.mode, p_reference: f.reference.trim() || null, p_note: f.note.trim() || null,
          });
          return error ? error.message : null;
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChampPage libelle="Date *"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle={`Montant * (${c?.devise ?? ''})`} erreur={f.montant.trim() && (valeur === null || valeur <= 0) ? 'Montant supérieur à zéro.' : null}>
            <input inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Mode"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={CHAMP_FENETRE}>{Object.entries(MODES_ENCAISSEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></ChampPage>
          <ChampPage libelle="Référence bancaire"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Note" className="sm:col-span-2"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        </div>
      </PageAction>
    );
  }

  const niveau = c ? niveauSuivant(c) : 1;
  return (
    <PageAction
      {...commun}
      titre={`${NIVEAUX_RELANCE[niveau] ?? 'Relance'} · ${c?.numero ?? ''}`.trim()}
      description={c && <>Reste dû : <b>{montant(c.reste, c.devise)}</b>, {c.jours_retard} jour(s) de retard. La lettre imprimable s'ouvre depuis les relances de la fiche.</>}
      motif="aucun"
      libelleConfirmer="Enregistrer la relance"
      interdit={c ? relanceInterdite(c, ecrire) : null}
      messageSucces={`${NIVEAUX_RELANCE[niveau] ?? 'Relance'} enregistré(e) : la lettre est dans l'onglet Encaissements et relances.`}
      onExecuter={async () => {
        const { error } = await supabase.rpc('relancer', { p_facture_id: id, p_canal: f.canal, p_note: f.note.trim() || null });
        return error ? error.message : null;
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <ChampPage libelle="Canal"><select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })} className={CHAMP_FENETRE}>{Object.entries(CANAUX_RELANCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></ChampPage>
        <ChampPage libelle="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
      </div>
    </PageAction>
  );
};

/** Lettre de relance imprimable d'un niveau deja enregistre (pleine page). */
export const LettreRelance = ({ id, niveau }: { id: string; niveau: number }) => {
  const { creance, c, client } = useCreance(id);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [relance, setRelance] = useState<Lecture<Relance>>(attente);
  useEffect(() => {
    supabase.from('societe').select('raison_sociale, adresse, rccm, nif, signataire_nom, signataire_fonction').eq('id', 1).maybeSingle()
      .then(({ data }) => setSociete(data as Societe | null));
    lire<Relance>(supabase.from('relances').select('*').eq('facture_id', id).eq('niveau', niveau), 'relance').then(setRelance);
  }, [id, niveau]);
  const r = (relance.lignes ?? []).find((x) => x.facture_id === id && x.niveau === niveau) ?? null;
  const erreur = creance.erreur || relance.erreur || (creance.lignes !== null && !c ? 'Créance introuvable.' : relance.lignes !== null && !r ? 'Aucune relance de ce niveau enregistrée sur cette facture.' : '');

  return (
    <div className="space-y-4">
      <div className="pas-imprime space-y-3">
        <FilAriane elements={arianeModule(VUE_RECOUVREMENT, MODULE, { libelle: c?.numero ?? 'Créance', vers: routeDetail(VUE_RECOUVREMENT, id) }, { libelle: 'Lettre de relance' })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={routeDetail(VUE_RECOUVREMENT, id, 'relations')} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Retour à la fiche</a>
          <button type="button" onClick={() => window.print()} disabled={!c || !r} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>
      {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
        : !c || !r ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : (
            <div className="zone-impression rounded-2xl bg-stone-200/70 p-4 sm:p-6">
              <article className="mx-auto max-w-[210mm] bg-white p-12 text-sm text-black shadow" aria-label="Lettre de relance">
                <p className="font-black">{societe?.raison_sociale}</p>
                <p>{societe?.adresse}</p><p>{[societe?.rccm && `RCCM ${societe.rccm}`, societe?.nif && `NIF ${societe.nif}`].filter(Boolean).join(' · ')}</p>
                <p className="mt-8 text-right">À l'attention de {client}</p>
                <p className="text-right">Le {jour(r.date_relance)}</p>
                <p className="mt-8 font-bold uppercase">Objet : {NIVEAUX_RELANCE[niveau]} · facture {c.numero}</p>
                <p className="mt-4">Madame, Monsieur,</p>
                <p className="mt-2">Sauf erreur de notre part, la facture n° {c.numero} émise le {jour(c.date_emission)}, échue le {jour(c.date_echeance) ?? '—'}, présente un solde impayé de <b>{montant(c.reste, c.devise)}</b> (montant dû {montant(c.du, c.devise)}, déjà réglé {montant(c.encaisse, c.devise)}).</p>
                <p className="mt-2">{niveau === 3
                  ? 'Malgré nos précédentes relances, ce montant reste impayé. Nous vous mettons en demeure de le régler sous huit jours à compter de la réception de la présente, faute de quoi nous nous réservons le droit d\'engager toute action utile au recouvrement de notre créance.'
                  : niveau === 2 ? 'Notre précédent rappel étant resté sans effet, nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.'
                    : 'Nous vous remercions de bien vouloir procéder à son règlement. Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce rappel.'}</p>
                <p className="mt-4">Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
                <p className="mt-10 font-bold">{societe?.signataire_fonction ?? 'Pour la société'}</p><p>{societe?.signataire_nom ?? ''}</p>
              </article>
            </div>
          )}
      {r && <p className="pas-imprime text-xs text-stone-500"><Puce teinte="gris">{CANAUX_RELANCE[r.canal] ?? r.canal}</Puce> Relance enregistrée le {new Date(r.le).toLocaleString('fr-FR')}.</p>}
    </div>
  );
};
