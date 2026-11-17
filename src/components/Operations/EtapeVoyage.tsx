import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { lire, trouver } from '../ui/lecture';
import { formatNombre } from '../Dashboard/indicateurs';
import { AVEC_MOTIF, AVEC_PESEE, ETATS, LIVRES_SANS_TICKET, actionsPossibles, estEtat, tonnageVoyage, type Etat } from '../Trips/cycle';
import { COLONNES_VOYAGE, type Voyage } from '../Trips/types';
import { VUE_VOYAGES } from './DetailVoyage';

// Saisie d'une etape du voyage en pleine page (D-088 suite, remplace la
// fenetre FicheVoyage) : l'heure saisie est l'heure reelle de l'evenement ;
// pesee (brut, tare) aux etats de pesee ; la pesee a l'arrivee est le ticket
// CBG saisi dans le meme geste (rattacher_ticket_cbg, D-078) ; les autres
// etapes passent par avancer_voyage. Le serveur controle ordre et coherence.

const versLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const nombre = (s: string) => Number(s.replace(',', '.'));
const poidsValide = (s: string) => s.trim() !== '' && Number.isFinite(nombre(s)) && nombre(s) >= 0;

const useVoyage = (id: string) => {
  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  useEffect(() => {
    lire<Voyage>(supabase.from('trips').select(COLONNES_VOYAGE).eq('id', id), 'voyage').then((r) => {
      const v = trouver(r.lignes, id);
      setVoyage(v);
      setErreur(r.erreur || (v ? '' : 'Voyage introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);
  return { voyage, erreur, chargement };
};

export const EtapeVoyage = ({ id, vers }: { id: string; vers: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const { voyage, erreur, chargement } = useVoyage(id);
  const [quand, setQuand] = useState(() => versLocal(new Date()));
  const [brut, setBrut] = useState('');
  const [tare, setTare] = useState('');
  const [ticket, setTicket] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [accepte, setAccepte] = useState('');

  const etat: Etat = voyage && estEtat(voyage.etat) ? voyage.etat : 'PLANNED';
  const cible = estEtat(vers) ? vers : null;
  const { normales, exceptions } = actionsPossibles(etat);
  const permise = !!cible && [...normales, ...exceptions].includes(cible);
  const pesee = !!cible && AVEC_PESEE.includes(cible);
  const reception = cible === 'WEIGHED_IN';
  const tonnage = voyage ? tonnageVoyage(voyage) : null;
  const interdit = !peutEcrire ? 'Droit d\'écriture sur les voyages requis.'
    : !cible ? `« ${vers} » n'est pas un état du voyage.`
      : voyage && !permise ? `Passage à « ${ETATS[cible].libelle} » impossible depuis « ${ETATS[etat].libelle} ».` : null;
  const pret = !!quand && !Number.isNaN(Date.parse(quand)) && (!pesee || (poidsValide(brut) && poidsValide(tare))) && (!reception || ticket.trim() !== '');

  return (
    <PageAction
      vue={VUE_VOYAGES} module="Voyages & Rotations" reference={voyage?.reference ?? 'Voyage'} id={id}
      titre={cible ? `${ETATS[cible].action} : ${voyage?.reference ?? ''}`.trim() : 'Étape du voyage'}
      description={voyage && cible ? <>De « {ETATS[etat].libelle} » vers « {ETATS[cible].libelle} ». Tonnage connu : {tonnage ? `${formatNombre(tonnage.valeur, 1)} t (${tonnage.nature})` : 'non pesé'}.</> : undefined}
      motif={cible && AVEC_MOTIF.includes(cible) ? 'obligatoire' : 'facultatif'}
      libelleConfirmer={cible ? `Enregistrer : ${ETATS[cible].libelle}` : 'Enregistrer'}
      danger={!!cible && AVEC_MOTIF.includes(cible)}
      interdit={interdit} chargement={chargement} erreurChargement={erreur} pret={pret}
      messageSucces={cible ? `Étape enregistrée : ${ETATS[cible].libelle}.` : 'Étape enregistrée.'}
      onExecuter={async (motif) => {
        if (!cible) return 'État inconnu';
        const survenu = new Date(quand).toISOString();
        if (reception) {
          const { error } = await supabase.rpc('rattacher_ticket_cbg', {
            p_trip_id: id, p_ticket: ticket.trim(), p_brut: nombre(brut), p_tare: nombre(tare), p_mesure_le: survenu,
            p_document_ref: documentRef.trim() || null, p_motif: motif || null,
          });
          return error ? error.message : null;
        }
        const donnees: Record<string, number> = {};
        if (pesee) { donnees.brut = nombre(brut); donnees.tare = nombre(tare); }
        if (cible === 'ACCEPTED' && accepte.trim()) donnees.accepte = nombre(accepte);
        const { error } = await supabase.rpc('avancer_voyage', { p_trip_id: id, p_etat: cible, p_survenu_le: survenu, p_note: motif || null, p_donnees: donnees });
        return error ? error.message : null;
      }}
    >
      <ChampPage libelle="Heure réelle de l'événement *">
        <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} className={CHAMP_FENETRE} />
      </ChampPage>
      {pesee && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChampPage libelle="Poids brut (t)" erreur={brut && !poidsValide(brut) ? 'Poids invalide' : null}>
            <input inputMode="decimal" value={brut} onChange={(e) => setBrut(e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Tare (t)" erreur={tare && !poidsValide(tare) ? 'Poids invalide' : null}>
            <input inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      )}
      {reception && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChampPage libelle="Numéro du ticket CBG *">
            <input value={ticket} onChange={(e) => setTicket(e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Référence du document">
            <input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      )}
      {cible === 'DELIVERED' && etat === 'UNLOADING' && (
        <p role="note" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          Livraison sans pesée CBG : le voyage ne sera pas facturable tant que le ticket CBG n&apos;est pas rattaché.
        </p>
      )}
      {cible === 'ACCEPTED' && (
        <ChampPage libelle="Tonnage accepté (t)">
          <input inputMode="decimal" value={accepte} onChange={(e) => setAccepte(e.target.value)} className={CHAMP_FENETRE}
            placeholder={tonnage ? `Vide = ${formatNombre(tonnage.valeur, 1)} t (${tonnage.nature})` : 'Requis : aucune pesée'} />
        </ChampPage>
      )}
    </PageAction>
  );
};

/** Rattachement motive du ticket CBG a un voyage deja livre sans ticket (D-078). */
export const RattacherTicket = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const { voyage, erreur, chargement } = useVoyage(id);
  const [quand, setQuand] = useState(() => versLocal(new Date()));
  const [brut, setBrut] = useState('');
  const [tare, setTare] = useState('');
  const [ticket, setTicket] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const etat = voyage && estEtat(voyage.etat) ? voyage.etat : null;
  const interdit = !peutEcrire ? 'Droit d\'écriture sur les voyages requis.'
    : voyage && (!etat || !LIVRES_SANS_TICKET.includes(etat)) ? 'Le rattachement tardif concerne un voyage déjà pesé ou livré.' : null;
  return (
    <PageAction
      vue={VUE_VOYAGES} module="Voyages & Rotations" reference={voyage?.reference ?? 'Voyage'} id={id}
      titre={`Rattacher le ticket CBG : ${voyage?.reference ?? ''}`.trim()}
      description="Voyage livré sans ticket : il n'est pas facturable tant que le ticket CBG n'est pas saisi. Le motif est conservé au journal."
      motif="obligatoire" libelleConfirmer="Rattacher le ticket" interdit={interdit} chargement={chargement} erreurChargement={erreur}
      pret={!!quand && ticket.trim() !== '' && poidsValide(brut) && poidsValide(tare)} messageSucces="Ticket CBG rattaché."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('rattacher_ticket_cbg', {
          p_trip_id: id, p_ticket: ticket.trim(), p_brut: nombre(brut), p_tare: nombre(tare), p_mesure_le: new Date(quand).toISOString(),
          p_document_ref: documentRef.trim() || null, p_motif: motif,
        });
        return error ? error.message : null;
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChampPage libelle="Numéro du ticket CBG *"><input value={ticket} onChange={(e) => setTicket(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Heure de la pesée CBG *"><input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Poids brut (t) *"><input inputMode="decimal" value={brut} onChange={(e) => setBrut(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Tare (t) *"><input inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Référence du document"><input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </div>
    </PageAction>
  );
};
