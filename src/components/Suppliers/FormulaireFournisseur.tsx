import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { lire, trouver } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { TYPES_FOURNISSEUR, type Fournisseur } from './fournisseurs';
import { COLONNES_FOURNISSEUR } from './donnees';
import { MODULE_FOURNISSEURS, VUE_FOURNISSEURS } from './routes';
import { erreursSaisieFournisseur, saisieDepuisFournisseur, type SaisieFournisseur } from './saisie';

// Creation et modification d'une fiche fournisseur en pleine page (D-059,
// D-090) par enregistrer_fournisseur : numero attribue par le serveur,
// raison sociale et identifiant fiscal uniques. La suspension et la
// reactivation passent par leurs actions motivees.

export const ModifierFournisseur = ({ id }: { id: string }) => {
  const [f, setF] = useState<Fournisseur | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    lire<Fournisseur>(supabase.from('suppliers').select(COLONNES_FOURNISSEUR).eq('id', id), 'fournisseur').then((r) => {
      const x = trouver(r.lignes, id);
      setF(x);
      setErreur(r.erreur || (x ? '' : 'Fournisseur introuvable ou non visible avec vos droits.'));
    });
  }, [id]);
  return f ? <FormulaireFournisseur key={f.id} fournisseur={f} /> : <FormulaireFournisseur chargement={!erreur} erreurChargement={erreur} />;
};

export const FormulaireFournisseur = ({ fournisseur, chargement, erreurChargement }: { fournisseur?: Fournisseur; chargement?: boolean; erreurChargement?: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const { valeurs: s, poser, modifie } = useSaisie<SaisieFournisseur>(saisieDepuisFournisseur(fournisseur));
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur les achats requis.'] : []), ...erreursSaisieFournisseur(s)];
  const val = (k: keyof SaisieFournisseur) => s[k].trim() || null;

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('enregistrer_fournisseur', {
      p_id: fournisseur?.id ?? null, p_raison_sociale: val('nom'), p_type: s.type, p_telephone: val('telephone'), p_email: val('email'),
      p_adresse: val('adresse'), p_ville: val('ville'), p_pays: val('pays'), p_identifiant_fiscal: val('nif'),
      p_registre_commerce: val('rccm'), p_conditions_paiement: val('conditions'), p_note: val('note'),
    });
    if (error) return { erreur: error.message };
    poserAnnonce(fournisseur ? 'Fiche fournisseur mise à jour.' : 'Fournisseur créé : numéro attribué par le serveur.');
    const id = fournisseur?.id ?? (typeof data === 'string' && data ? data : null);
    return { vers: id ? routeDetail(VUE_FOURNISSEURS, id) : routeListe(VUE_FOURNISSEURS) };
  };

  const champ = (k: keyof SaisieFournisseur, libelle: string, type = 'text', className = '') => (
    <ChampPage libelle={libelle} className={className}>
      <input type={type} value={s[k]} onChange={(e) => poser(k, e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );

  return (
    <PageFormulaire
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      titre={fournisseur ? `Modifier ${fournisseur.company_name}` : 'Nouveau fournisseur'}
      reference={fournisseur?.company_name}
      id={fournisseur?.id}
      description="Numéro attribué par le serveur. Raison sociale et identifiant fiscal uniques."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer la fiche"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Identité">
        {champ('nom', 'Raison sociale *')}
        <ChampPage libelle="Type *">
          <select value={s.type} onChange={(e) => poser('type', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(TYPES_FOURNISSEUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        {champ('nif', 'Identifiant fiscal (NIF)')}
        {champ('rccm', 'Registre du commerce')}
      </SectionFormulaire>
      <SectionFormulaire titre="Coordonnées">
        {champ('telephone', 'Téléphone', 'tel')}
        {champ('email', 'Courriel', 'email')}
        {champ('adresse', 'Adresse')}
        {champ('ville', 'Ville')}
        {champ('pays', 'Pays')}
      </SectionFormulaire>
      <SectionFormulaire titre="Conditions">
        {champ('conditions', 'Conditions de paiement')}
        {champ('note', 'Note', 'text', 'sm:col-span-2')}
      </SectionFormulaire>
    </PageFormulaire>
  );
};
