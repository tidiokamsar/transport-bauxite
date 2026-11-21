import { useEffect, useState } from 'react';
import { Ban, FileMinus2, PenTool, Printer, Send, Stamp, Undo2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { identifiantSur, lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import { formatNombre } from '../Dashboard/indicateurs';
import { DossierFinancier } from './DossierFinancier';
import {
  ANOMALIES, JOURNAL_FACTURE, NIVEAUX_RELANCE, STATUTS_FACTURE, STATUTS_LIGNE, VUE_FACTURES, VUE_RECONCILIATION, VUE_RECOUVREMENT, actionFactureInterdite,
  libelleFacture, montant, statutLigne, type ActionFacture, type Facture,
} from './facturation';

// Fiche d'une facture ou d'un avoir (D-029, D-090) : montants et lignes,
// chaine de preuve (contrat -> reconciliation -> voyages facturables ->
// tickets CBG), avoirs, encaissements et relances, historique (journal de
// la facture, encaissements, relances), actions selon le role et l'etat.

interface Ligne { id: string; facture_id: string; libelle: string; quantite: number; unite: string; prix_unitaire: number; montant: number; ordre: number }
interface Journal { id: string; facture_id: string; action: string; motif: string | null; auteur: string | null; le: string }
interface Contrat { id: string; reference: string; contrepartie: string; intitule: string }
interface Rec { id: string; periode_debut: string; periode_fin: string; statut: string; tonnage_facturable: number | null }
interface LigneRec { id: string; reconciliation_id: string; trip_id: string; reference: string; date_voyage: string; tonnage_base: number | null; ticket: string | null; fiche: string | null; anomalies: string[]; decision: string | null; motif_decision: string | null }
interface Ticket { id: string; trip_id: string; ticket: string; brut: number; tare: number; net: number; mesure_le: string; document_ref: string | null }
interface Encaissement { id: string; facture_id: string; date_encaissement: string; montant: number; mode: string; reference: string | null; note: string | null; saisi_par: string | null; saisi_le: string }
interface Relance { id: string; facture_id: string; niveau: number; date_relance: string; canal: string; note: string | null; auteur: string | null; le: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : null);
const t = (v: number | null) => (v === null ? '—' : `${formatNombre(Number(v), 2)} t`);

export const DetailFacture = ({ id }: { id: string }) => {
  const { hasPermission, profile, user } = useAuth();
  const droits = { ecrire: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), directeur: profile?.role === 'director', utilisateur: user?.id ?? null };
  const [facture, setFacture] = useState<Lecture<Facture>>(attente);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [lignes, setLignes] = useState<Lecture<Ligne>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [rec, setRec] = useState<Rec | null>(null);
  const [voyages, setVoyages] = useState<Lecture<LigneRec>>(attente);
  const [tickets, setTickets] = useState<Lecture<Ticket>>(attente);
  const [liees, setLiees] = useState<Lecture<Facture>>(attente);
  const [encaissements, setEncaissements] = useState<Lecture<Encaissement>>(attente);
  const [relances, setRelances] = useState<Lecture<Relance>>(attente);

  useEffect(() => {
    lire<Facture>(supabase.from('factures').select('*').eq('id', id), 'facture').then(async (r) => {
      setFacture(r);
      const f = trouver(r.lignes, id);
      if (!f) return;
      const c = await supabase.from('contrats').select('id, reference, contrepartie, intitule').eq('id', f.contrat_id);
      setContrat(((c.data ?? []) as Contrat[]).find((x) => x.id === f.contrat_id) ?? null);
      // Factures liees : avoirs de cette facture, facture d'origine d'un avoir.
      const ids = [id, f.facture_origine_id].filter((x): x is string => Boolean(x) && identifiantSur(x as string));
      if (ids.length === 0) setLiees({ lignes: [], erreur: '' }); else lire<Facture>(supabase.from('factures').select('*').or(ids.map((x) => (x === id ? `facture_origine_id.eq.${x}` : `id.eq.${x}`)).join(',')), 'factures liées')
        .then((l) => setLiees({ ...l, lignes: l.lignes && l.lignes.filter((x) => x.facture_origine_id === id || x.id === f.facture_origine_id) }));
      if (!f.reconciliation_id) { setVoyages({ lignes: [], erreur: '' }); setTickets({ lignes: [], erreur: '' }); return; }
      const rr = await supabase.from('reconciliations').select('id, periode_debut, periode_fin, statut, tonnage_facturable').eq('id', f.reconciliation_id);
      setRec(((rr.data ?? []) as Rec[]).find((x) => x.id === f.reconciliation_id) ?? null);
      const v = await lire<LigneRec>(supabase.from('reconciliation_lignes')
        .select('id, reconciliation_id, trip_id, reference, date_voyage, tonnage_base, ticket, fiche, anomalies, decision, motif_decision')
        .eq('reconciliation_id', f.reconciliation_id).order('date_voyage').order('reference'), 'voyages de la réconciliation');
      const facturables = (v.lignes ?? []).filter((l) => l.reconciliation_id === f.reconciliation_id && statutLigne(l.decision, l.anomalies) === 'facturable');
      setVoyages({ ...v, lignes: v.lignes && facturables });
      const trajets = facturables.map((l) => l.trip_id);
      if (trajets.length === 0) { setTickets({ lignes: [], erreur: '' }); return; }
      lire<Ticket>(supabase.from('tickets_pesee_cbg').select('id, trip_id, ticket, brut, tare, net, mesure_le, document_ref').in('trip_id', trajets), 'tickets CBG')
        .then((k) => setTickets({ ...k, lignes: k.lignes && k.lignes.filter((x) => trajets.includes(x.trip_id)) }));
    });
    lire<Ligne>(supabase.from('facture_lignes').select('*').eq('facture_id', id).order('ordre'), 'lignes de la facture')
      .then((r) => setLignes({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
    lire<Journal>(supabase.from('factures_journal').select('*').eq('facture_id', id).order('le'), 'journal de la facture')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
    lire<Encaissement>(supabase.from('encaissements').select('*').eq('facture_id', id).order('date_encaissement'), 'encaissements')
      .then((r) => setEncaissements({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
    lire<Relance>(supabase.from('relances').select('*').eq('facture_id', id).order('niveau'), 'relances')
      .then((r) => setRelances({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
  }, [id]);

  const f = trouver(facture.lignes, id);
  const permis = (a: ActionFacture) => Boolean(f) && actionFactureInterdite(a, f as Facture, droits) === null;
  const origine = (liees.lignes ?? []).find((x) => x.id === f?.facture_origine_id) ?? null;
  const avoirs = (liees.lignes ?? []).filter((x) => x.facture_origine_id === id);
  const ticketDe = (trip: string) => (tickets.lignes ?? []).find((k) => k.trip_id === trip);

  const historique: EvenementHistorique[] | null = journal.lignes && encaissements.lignes && relances.lignes ? fusionnerHistoriques(
    journal.lignes.map((j) => ({ id: `factures_journal-${j.id}`, le: j.le, libelle: JOURNAL_FACTURE[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'factures_journal' })),
    encaissements.lignes.map((e) => ({ id: `encaissements-${e.id}`, le: e.saisi_le, libelle: `Encaissement de ${montant(e.montant, f?.devise ?? '')}`,
      detail: `Reçu le ${jour(e.date_encaissement)}${e.reference ? ` · réf. ${e.reference}` : ''}${e.note ? ` · ${e.note}` : ''}`, auteur: e.saisi_par, source: 'encaissements' })),
    relances.lignes.map((r) => ({ id: `relances-${r.id}`, le: r.le, libelle: NIVEAUX_RELANCE[r.niveau] ?? `Relance ${r.niveau}`, detail: r.note, auteur: r.auteur, source: 'relances' })),
  ) : null;

  const titre = f ? `${f.type === 'avoir' ? 'Avoir' : 'Facture'} ${f.numero ?? '(brouillon)'}` : 'Facture';
  const reference = f ? libelleFacture(f) : 'Facture';

  return (
    <PageDetail
      vue={VUE_FACTURES}
      module="Facturation"
      reference={reference}
      titre={titre}
      statut={f ? { libelle: STATUTS_FACTURE[f.statut]?.libelle ?? f.statut, teinte: STATUTS_FACTURE[f.statut]?.teinte ?? 'gris' } : null}
      resume={f && <>{contrat?.contrepartie ?? 'Client'} · {montant(f.montant_ttc, f.devise)} TTC · {f.objet}</>}
      chargement={facture.lignes === null && !facture.erreur}
      erreur={facture.erreur}
      introuvable={facture.lignes !== null && !f}
      actions={[
        { id: 'apercu', libelle: 'Aperçu', icone: <Printer className="h-4 w-4" />, visible: Boolean(f), vers: routeAction(VUE_FACTURES, id, 'apercu') },
        { id: 'soumettre', libelle: 'Soumettre au DG', icone: <Send className="h-4 w-4" />, visible: permis('soumettre'), ton: 'principal', vers: routeAction(VUE_FACTURES, id, 'soumettre') },
        { id: 'signer', libelle: 'Signer', icone: <PenTool className="h-4 w-4" />, visible: permis('signer'), ton: 'principal', vers: routeAction(VUE_FACTURES, id, 'signer') },
        { id: 'renvoyer', libelle: 'Renvoyer', icone: <Undo2 className="h-4 w-4" />, visible: permis('renvoyer'), vers: routeAction(VUE_FACTURES, id, 'renvoyer') },
        { id: 'emettre', libelle: 'Émettre', icone: <Stamp className="h-4 w-4" />, visible: permis('emettre'), ton: 'principal', vers: routeAction(VUE_FACTURES, id, 'emettre') },
        { id: 'avoir', libelle: 'Créer un avoir', icone: <FileMinus2 className="h-4 w-4" />, visible: permis('avoir'), vers: routeAction(VUE_FACTURES, id, 'avoir') },
        { id: 'annuler', libelle: 'Annuler', icone: <Ban className="h-4 w-4" />, visible: permis('annuler'), ton: 'danger', vers: routeAction(VUE_FACTURES, id, 'annuler') },
      ]}
      onglets={!f ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Document', champs: [['Type', f.type === 'avoir' ? 'Avoir' : 'Facture'], ['Numéro', f.numero ?? 'Attribué à l\'émission'], ['Objet', f.objet],
              ['Statut', STATUTS_FACTURE[f.statut]?.libelle ?? f.statut], ['Motif (annulation ou avoir)', f.motif]] },
            { titre: 'Client', champs: [['Client', contrat?.contrepartie ?? null], ['Contrat', contrat ? `${contrat.reference} · ${contrat.intitule}` : null],
              ['Période', f.periode_debut ? `du ${jour(f.periode_debut)} au ${jour(f.periode_fin ?? null)}` : null]] },
            { titre: 'Montants', champs: [['Hors taxes', montant(f.montant_ht, f.devise)], [`Taxe (${Number(f.taux_taxe_pct).toLocaleString('fr-FR')} %)`, montant(f.montant_taxe, f.devise)],
              ['TTC', <b key="ttc">{montant(f.montant_ttc, f.devise)}</b>]] },
            { titre: 'Circuit', champs: [['Préparée le', new Date(f.prepare_le).toLocaleString('fr-FR')], ['Signée le', f.signee_le ? new Date(f.signee_le).toLocaleString('fr-FR') : null],
              ['Émise le', jour(f.date_emission)], ['Échéance', f.date_emission ? jour(f.date_echeance) ?? 'Non définie (délai absent du contrat)' : null]] },
          ]} />
        ) },
        { id: 'lignes', libelle: 'Lignes', compte: lignes.lignes?.length ?? null, contenu: (
          <Relation titre="Lignes de la facture" lignes={lignes.lignes} erreur={lignes.erreur} cle={(l) => l.id} vide="Aucune ligne"
            colonnes={[
              { libelle: 'Désignation', valeur: (l) => l.libelle },
              { libelle: 'Quantité', valeur: (l) => `${Number(l.quantite).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${l.unite}` },
              { libelle: 'Prix unitaire', valeur: (l) => montant(l.prix_unitaire, f.devise) },
              { libelle: 'Montant', valeur: (l) => montant(l.montant, f.devise) },
            ]} />
        ) },
        { id: 'dossier', libelle: 'Dossier financier', contenu: <DossierFinancier factureId={id} /> },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Contrat et réconciliation" cle={(x) => x.id} vide="Aucun rattachement visible"
              lignes={[...(contrat ? [{ id: `c-${contrat.id}`, quoi: 'Contrat', libelle: `${contrat.reference} · ${contrat.contrepartie}`, vers: routeDetail('contrats', contrat.id) }] : []),
                ...(rec ? [{ id: `r-${rec.id}`, quoi: 'Réconciliation', libelle: `du ${jour(rec.periode_debut)} au ${jour(rec.periode_fin)} · ${t(rec.tonnage_facturable)}`, vers: routeDetail(VUE_RECONCILIATION, rec.id) }] : []),
                ...(f.statut === 'emise' && f.type === 'facture' ? [{ id: 'creance', quoi: 'Créance', libelle: 'Recouvrement de cette facture', vers: routeDetail(VUE_RECOUVREMENT, id) }] : [])]}
              lien={(x) => x.vers}
              colonnes={[{ libelle: 'Lien', valeur: (x) => x.quoi }, { libelle: 'Détail', valeur: (x) => x.libelle }]} />
            <Relation titre={f.type === 'avoir' ? 'Facture d\'origine' : 'Avoirs émis sur cette facture'} lignes={liees.lignes && (f.type === 'avoir' ? (origine ? [origine] : []) : avoirs)}
              erreur={liees.erreur} cle={(x) => x.id} vide={f.type === 'avoir' ? 'Facture d\'origine non visible' : 'Aucun avoir'} lien={(x) => routeDetail(VUE_FACTURES, x.id)}
              colonnes={[{ libelle: 'Numéro', valeur: (x) => libelleFacture(x) }, { libelle: 'TTC', valeur: (x) => montant(x.montant_ttc, x.devise) },
                { libelle: 'Statut', valeur: (x) => <Puce teinte={STATUTS_FACTURE[x.statut]?.teinte ?? 'gris'}>{STATUTS_FACTURE[x.statut]?.libelle ?? x.statut}</Puce> }]} />
            {f.type === 'facture' && (
              <div className="lg:col-span-2">
                <Relation titre="Voyages facturés (lignes facturables de la réconciliation)" lignes={voyages.lignes} erreur={voyages.erreur} cle={(l) => l.id}
                  vide={f.reconciliation_id ? 'Aucun voyage facturable' : 'Facture sans réconciliation rattachée'}
                  note="Chaque voyage remonte à son ticket CBG (pesée) et à sa fiche terrain ; une décision motivée est affichée quand elle a levé une anomalie."
                  colonnes={[
                    { libelle: 'Voyage', valeur: (l) => l.reference },
                    { libelle: 'Date', valeur: (l) => jour(l.date_voyage) },
                    { libelle: 'Tonnage facturé', valeur: (l) => t(l.tonnage_base) },
                    { libelle: 'Ticket CBG', valeur: (l) => { const k = ticketDe(l.trip_id); return k ? `${k.ticket} · net ${t(k.net)}${k.document_ref ? ` · doc ${k.document_ref}` : ''}` : l.ticket ?? 'Sans ticket'; } },
                    { libelle: 'Fiche', valeur: (l) => l.fiche ?? '—' },
                    { libelle: 'Décision', valeur: (l) => (l.decision ? <span><Puce teinte={STATUTS_LIGNE.facturable.teinte}>Décidée</Puce> {l.motif_decision}</span>
                      : l.anomalies.length ? l.anomalies.map((a) => ANOMALIES[a]?.libelle ?? a).join(' ; ') : '—') },
                  ]} />
                {tickets.erreur && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{tickets.erreur}</p>}
              </div>
            )}
            <Relation titre="Encaissements" lignes={encaissements.lignes} erreur={encaissements.erreur} cle={(e) => e.id} vide="Aucun encaissement"
              colonnes={[{ libelle: 'Date', valeur: (e) => jour(e.date_encaissement) }, { libelle: 'Montant', valeur: (e) => montant(e.montant, f.devise) },
                { libelle: 'Mode', valeur: (e) => e.mode }, { libelle: 'Référence', valeur: (e) => e.reference ?? '—' }]} />
            <Relation titre="Relances" lignes={relances.lignes} erreur={relances.erreur} cle={(r) => r.id} vide="Aucune relance"
              colonnes={[{ libelle: 'Niveau', valeur: (r) => NIVEAUX_RELANCE[r.niveau] ?? r.niveau }, { libelle: 'Date', valeur: (r) => jour(r.date_relance) }, { libelle: 'Canal', valeur: (r) => r.canal }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur || encaissements.erreur || relances.erreur} source="factures_journal (circuit de signature), encaissements, relances" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une facture" /> },
      ]}
    />
  );
};
