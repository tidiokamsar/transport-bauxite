import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { DEVISES_COUT, MODES_COUT, MODULE_COUTS, SAISIE_COUT_VIDE, VUE_COUTS, erreursDepense } from './couts';

// Nouvelle depense en pleine page (D-058, D-090) par enregistrer_cout. Pas
// de modification : le serveur n'en propose pas (annulation motivee puis
// nouvelle saisie).

interface Lib { id: string; libelle: string }
interface PieceReprise { source: 'bon_commande' | 'facture_loueur'; id: string; libelle: string }
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const FormulaireCout = () => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [refs, setRefs] = useState<{ categories: Lib[]; sites: Lib[]; engins: Lib[] } | null>(null);
  const [pieces, setPieces] = useState<PieceReprise[]>([]);
  const [erreurPieces, setErreurPieces] = useState('');
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ ...SAISIE_COUT_VIDE, date: aujourdhui() });

  useEffect(() => {
    Promise.all([
      supabase.from('cost_categories').select('id, name').eq('active', true).order('name'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      // Pieces du circuit fournisseur lisibles par le compte (RLS).
      supabase.from('purchase_orders').select('id, po_number').in('status', ['approved', 'partially_received', 'received', 'closed'])
        .order('po_date', { ascending: false }).limit(200),
      supabase.from('factures_fournisseur').select('id, numero_fournisseur').order('date_facture', { ascending: false }).limit(200),
    ]).then(([ca, si, ve, b, fa]) => {
      const echec = ca.error ?? si.error ?? ve.error;
      setErreurChargement(echec ? `Référentiels indisponibles : ${echec.message}` : '');
      setRefs({
        categories: (ca.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })),
        sites: (si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })),
        engins: (ve.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })),
      });
      setErreurPieces(b.error || fa.error ? `Pièces fournisseur non chargées : ${(b.error ?? fa.error)?.message}` : '');
      setPieces([
        ...(b.data ?? []).map((x) => ({ source: 'bon_commande' as const, id: x.id as string, libelle: `Bon ${x.po_number as string}` })),
        ...(fa.data ?? []).map((x) => ({ source: 'facture_loueur' as const, id: x.id as string, libelle: `Facture loueur ${x.numero_fournisseur as string}` })),
      ]);
    });
  }, []);

  const erreurs = [...(!peutSaisir ? ['Droit d\'écriture sur les coûts requis.'] : []), ...erreursDepense(f, aujourdhui())];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const piece = pieces.find((x) => `${x.source}:${x.id}` === f.piece);
    const { data, error } = await supabase.rpc('enregistrer_cout', {
      p_date: f.date, p_description: f.description.trim(), p_montant: Number(f.montant.replace(/\s/g, '').replace(',', '.')), p_devise: f.devise,
      p_categorie: f.categorie || null, p_site: f.site || null, p_vehicule: f.vehicule || null,
      p_reference: f.reference.trim() || null, p_mode_paiement: f.mode || null, p_notes: f.notes.trim() || null,
      p_piece_source: piece?.source ?? null, p_piece_id: piece?.id ?? null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Dépense enregistrée.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_COUTS, data) : routeListe(VUE_COUTS) };
  };

  return (
    <PageFormulaire
      vue={VUE_COUTS}
      module={MODULE_COUTS}
      titre="Nouvelle dépense"
      description="Montant toutes taxes comprises (TTC), comme les budgets. Une dépense qui reprend une pièce fournisseur (bon de commande, facture du loueur) n'est pas recomptée au réalisé budgétaire : la pièce y figure déjà. Une dépense sans site n'est visible que des profils sans affectation de site."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={refs === null}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Dépense">
        <ChampPage libelle="Date *">
          <input type="date" max={aujourdhui()} value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Description *">
          <input value={f.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Montant TTC *">
          <input inputMode="decimal" value={f.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Devise *">
          <select value={f.devise} onChange={(e) => poser('devise', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>{DEVISES_COUT.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Catégorie">
          <select value={f.categorie} onChange={(e) => poser('categorie', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Sans catégorie</option>{(refs?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Site">
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Sans site (siège)</option>{(refs?.sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Engin">
          <select value={f.vehicule} onChange={(e) => poser('vehicule', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Aucun</option>{(refs?.engins ?? []).map((v) => <option key={v.id} value={v.id}>{v.libelle}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Pièce et règlement">
        <ChampPage libelle="Référence de la pièce">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Mode de paiement">
          <select value={f.mode} onChange={(e) => poser('mode', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseigné</option>{MODES_COUT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Reprend une pièce du circuit fournisseur" erreur={erreurPieces || null}>
          <select value={f.piece} onChange={(e) => poser('piece', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Aucune</option>{pieces.map((x) => <option key={`${x.source}:${x.id}`} value={`${x.source}:${x.id}`}>{x.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Notes">
          <input value={f.notes} onChange={(e) => poser('notes', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
