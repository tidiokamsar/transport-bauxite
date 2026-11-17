import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { versIso, versLocal } from './immobilisations';
import {
  ACTIONS_INTERVENTION, MODULE_INTERVENTIONS, VUE_INTERVENTIONS, actionInterventionInterdite, lireNombre, piecesValides,
  type ActionIntervention, type Piece, type StatutIntervention,
} from './interventions';

// Actions d'une intervention du loueur en pleine page (D-049, D-090,
// remplacent les window.prompt et les formulaires en ligne) :
// prendre_en_charge_intervention, terminer_intervention (rapport, pieces),
// valider_remise_en_service (validation, ou refus avec motif exige).

interface Intervention { id: string; numero: string; vehicle_id: string; statut: StatutIntervention; fin_saisie_par: string | null }

const PIECE_VIDE: Piece = { designation: '', reference: '', quantite: '1', fournie_par: 'loueur' };
const TITRES: Record<ActionIntervention, string> = {
  'prendre-en-charge': 'Prise en charge par le loueur', terminer: 'Fin d\'intervention',
  valider: 'Valider la remise en service', refuser: 'Refuser la remise en service',
};

export const ActionInterventionVue = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission, user } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [engin, setEngin] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [champs, setChamps] = useState({ quand: versLocal(new Date()), technicien: '', rapport: '' });
  const [pieces, setPieces] = useState<Piece[]>([]);
  const poser = (k: keyof typeof champs, v: string) => setChamps((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    lire<Intervention>(supabase.from('v_interventions_loueur').select('id, numero, vehicle_id, statut, fin_saisie_par').eq('id', id), 'intervention').then(async (r) => {
      const i = trouver(r.lignes, id);
      setIntervention(i);
      setErreur(r.erreur || (i ? '' : 'Intervention introuvable ou hors de votre périmètre.'));
      if (i) {
        const { data } = await supabase.from('vehicles').select('id, registration').eq('id', i.vehicle_id);
        setEngin(((data ?? []) as { id: string; registration: string }[]).find((v) => v.id === i.vehicle_id)?.registration ?? '');
      }
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_INTERVENTION as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une intervention du loueur.`} />;
  }
  const a = action as ActionIntervention;
  const commun = {
    vue: VUE_INTERVENTIONS, module: MODULE_INTERVENTIONS, id, chargement, erreurChargement: erreur,
    reference: intervention ? `${intervention.numero}${engin ? ` · ${engin}` : ''}` : 'Intervention',
    titre: TITRES[a],
    interdit: intervention ? actionInterventionInterdite(a, intervention.statut, peutEcrire, intervention.fin_saisie_par, user?.id ?? null) : null,
  };
  const resultat = ({ error }: { error: { message: string } | null }) => (error ? error.message : null);
  const quand = versIso(champs.quand);
  const quandValide = Boolean(quand) && new Date(quand ?? '').getTime() <= Date.now();

  if (a === 'prendre-en-charge') {
    return (
      <PageAction
        {...commun}
        description="Arrivée du technicien du loueur sur l'engin ; le délai de prise en charge est calculé depuis la demande."
        motif="aucun"
        libelleConfirmer="Enregistrer la prise en charge"
        pret={quandValide && Boolean(champs.technicien.trim())}
        messageSucces="Prise en charge enregistrée."
        onExecuter={async () => resultat(await supabase.rpc('prendre_en_charge_intervention', { p_id: id, p_quand: quand, p_technicien: champs.technicien.trim() }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Heure de prise en charge *">
            <input type="datetime-local" value={champs.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Technicien du loueur *">
            <input value={champs.technicien} onChange={(e) => poser('technicien', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      </PageAction>
    );
  }

  if (a === 'terminer') {
    const majPiece = (n: number, p: Piece) => setPieces(pieces.map((x, j) => (j === n ? p : x)));
    return (
      <PageAction
        {...commun}
        description="Le rapport et les pièces remplacées sont enregistrés ; la remise en service est ensuite validée par une autre personne."
        motif="aucun"
        libelleConfirmer="Enregistrer la fin"
        pret={quandValide && Boolean(champs.rapport.trim()) && piecesValides(pieces)}
        messageSucces="Fin d'intervention enregistrée : remise en service à valider par une autre personne."
        onExecuter={async () => resultat(await supabase.rpc('terminer_intervention', {
          p_id: id, p_quand: quand, p_rapport: champs.rapport.trim(),
          p_pieces: pieces.filter((p) => p.designation.trim()).map((p) => ({
            designation: p.designation.trim(), reference: p.reference.trim(), quantite: lireNombre(p.quantite), fournie_par: p.fournie_par,
          })),
        }))}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampPage libelle="Fin de l'intervention *">
              <input type="datetime-local" value={champs.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
            </ChampPage>
          </div>
          <ChampPage libelle="Rapport d'intervention *">
            <textarea value={champs.rapport} onChange={(e) => poser('rapport', e.target.value)} rows={3} className={CHAMP_FENETRE} />
          </ChampPage>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-700">Pièces remplacées</legend>
            {pieces.map((p, n) => (
              <div key={n} className="flex flex-wrap items-end gap-2">
                <ChampPage libelle={`Pièce ${n + 1}`}><input value={p.designation} onChange={(e) => majPiece(n, { ...p, designation: e.target.value })} className={`${CHAMP_FENETRE} w-48`} /></ChampPage>
                <ChampPage libelle="Référence"><input value={p.reference} onChange={(e) => majPiece(n, { ...p, reference: e.target.value })} className={`${CHAMP_FENETRE} w-32`} /></ChampPage>
                <ChampPage libelle="Quantité"><input inputMode="decimal" value={p.quantite} onChange={(e) => majPiece(n, { ...p, quantite: e.target.value })} className={`${CHAMP_FENETRE} w-20`} /></ChampPage>
                <ChampPage libelle="Fournie par">
                  <select value={p.fournie_par} onChange={(e) => majPiece(n, { ...p, fournie_par: e.target.value as Piece['fournie_par'] })} className={`${CHAMP_FENETRE} w-32`}>
                    <option value="loueur">Loueur</option><option value="exploitant">Exploitant</option>
                  </select>
                </ChampPage>
                <button type="button" onClick={() => setPieces(pieces.filter((_, j) => j !== n))} aria-label={`Retirer la pièce ${n + 1}`} className="rounded p-2 text-stone-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {!piecesValides(pieces) && <p className="text-xs text-red-700">Chaque pièce saisie porte une quantité positive.</p>}
            <button type="button" onClick={() => setPieces([...pieces, { ...PIECE_VIDE }])} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Pièce remplacée</button>
          </fieldset>
        </div>
      </PageAction>
    );
  }

  const valider = a === 'valider';
  return (
    <PageAction
      {...commun}
      description={valider
        ? 'La validation clôture l\'immobilisation à l\'heure de fin de l\'intervention ; l\'engin redevient disponible.'
        : 'Le refus renvoie l\'intervention en cours (prise en charge) ; le motif est conservé au journal.'}
      motif={valider ? 'facultatif' : 'obligatoire'}
      motifMinimum={1}
      danger={!valider}
      libelleConfirmer={valider ? 'Valider la remise en service' : 'Refuser la remise en service'}
      messageSucces={valider ? 'Remise en service validée : immobilisation close, engin disponible.' : 'Remise en service refusée : l\'intervention reprend.'}
      onExecuter={async (motif) => resultat(await supabase.rpc('valider_remise_en_service', { p_id: id, p_valider: valider, p_motif: motif || null }))}
    />
  );
};
