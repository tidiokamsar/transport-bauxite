import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { MODULE_PAIEMENTS, VUE_PAIEMENTS, erreursProposition, lireMontant, montantPaiement, type PiecePayable } from './paiements';

// Bon a payer en pleine page (D-055, D-090) : proposer_paiement plafonne le
// montant au reste a payer de la piece (controle serveur, repris ici pour
// prevenir la saisie).

export const FormulairePaiement = ({ source, piece: pieceId }: { source: string; piece: string }) => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [piece, setPiece] = useState<PiecePayable | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie({ montant: '', objet: '' });

  useEffect(() => {
    if (!pieceId || !['facture_loueur', 'bon_commande'].includes(source)) {
      setErreurChargement('Pièce payable non précisée : ouvrez le bon à payer depuis la liste des pièces payables.');
      setChargement(false);
      return;
    }
    supabase.from('v_reste_a_payer').select('*').eq('piece_id', pieceId).then(({ data, error }) => {
      const p = ((data ?? []) as PiecePayable[]).find((x) => x.piece_id === pieceId && x.source === source) ?? null;
      setPiece(p);
      setErreurChargement(error ? `Pièce payable indisponible : ${error.message}` : p ? '' : 'Pièce introuvable, non payable ou hors de vos droits.');
      if (p) initialiser({ montant: String(p.reste), objet: '' });
      setChargement(false);
    });
  }, [source, pieceId, initialiser]);

  const erreurs = [
    ...(!peutSaisir ? ['Droit d\'écriture sur les factures requis.'] : []),
    ...(piece && !(piece.reste > 0) ? ['Pièce entièrement payée ou engagée.'] : []),
    ...erreursProposition(f, piece?.reste ?? null),
  ];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    if (!piece) return { erreur: 'Pièce payable non chargée.' };
    const { data, error } = await supabase.rpc('proposer_paiement', {
      p_montant: lireMontant(f.montant), p_objet: f.objet.trim(),
      p_facture: piece.source === 'facture_loueur' ? piece.piece_id : null, p_bon: piece.source === 'bon_commande' ? piece.piece_id : null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Bon à payer proposé : il attend l\'approbation d\'une autre personne.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_PAIEMENTS, data) : routeListe(VUE_PAIEMENTS) };
  };

  return (
    <PageFormulaire
      vue={VUE_PAIEMENTS}
      module={MODULE_PAIEMENTS}
      titre={piece ? `Bon à payer : ${piece.piece}` : 'Bon à payer'}
      description={piece && <>{piece.source === 'facture_loueur' ? 'Facture du loueur' : 'Bon de commande'} · {piece.beneficiaire ?? 'Bénéficiaire non renseigné'} · reste à payer {montantPaiement(piece.reste, piece.devise)}</>}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Proposer"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Bon à payer">
        <ChampPage libelle={`Montant (${piece?.devise ?? ''}) *`} aide="Au plus le reste à payer de la pièce.">
          <input inputMode="decimal" value={f.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Objet *">
          <input value={f.objet} onChange={(e) => poser('objet', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
