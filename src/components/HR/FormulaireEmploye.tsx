import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { routeDetail, routeListe } from '../ui/routeur';
import { GENRES, VUE_EMPLOYES, erreursEmploye, nomEmploye, saisieDepuisEmploye, type Employe, type SaisieEmploye } from './employe';

// Creation et modification d'une fiche employe en pleine page (D-094,
// remplace EmployeeModal). Ecriture par enregistrer_employe ; le statut
// change par les actions de la fiche. Champ vide -> NULL cote serveur ;
// le salaire reste vide s'il n'est pas saisi.

export const FormulaireEmploye = ({ id }: { id?: string }) => {
  const { profile } = useAuth();
  const { sites } = useSite();
  const siteProfil = profile?.site_id ?? null;
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [chargement, setChargement] = useState(Boolean(id));
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie<SaisieEmploye>(saisieDepuisEmploye(null, siteProfil));

  useEffect(() => {
    if (!id) return;
    lire<Employe>(supabase.from('employees').select('*').eq('id', id), 'employé').then((r) => {
      const e = trouver(r.lignes, id);
      setErreurChargement(r.erreur || (e ? '' : 'Employé introuvable ou hors de votre périmètre.'));
      setEmploye(e);
      if (e) initialiser(saisieDepuisEmploye(e, siteProfil));
      setChargement(false);
    });
  }, [id, initialiser, siteProfil]);

  const erreurs = erreursEmploye(f);

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('enregistrer_employe', { p_id: employe?.id ?? null, p: f });
    if (error) return { erreur: error.message };
    const cible = (data as string | null) ?? employe?.id;
    return { vers: cible ? routeDetail(VUE_EMPLOYES, cible) : routeListe(VUE_EMPLOYES) };
  };

  const texte = (cle: keyof SaisieEmploye, libelle: string, type = 'text', className = '') => (
    <ChampPage libelle={libelle} className={className}>
      <input type={type} value={f[cle]} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );

  return (
    <PageFormulaire
      vue={VUE_EMPLOYES}
      module="Employés"
      titre={id ? 'Modifier l\'employé' : 'Ajouter un employé'}
      reference={employe ? nomEmploye(employe) : undefined}
      id={id}
      description={id ? 'Le statut se change par les actions de la fiche (suspendre, désactiver, réactiver). Chaque modification est journalisée.' : 'La fiche est créée active ; sa création est journalisée.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Identité">
        {texte('employee_number', 'Matricule *')}
        {texte('first_name', 'Prénom *')}
        {texte('last_name', 'Nom *')}
        {texte('date_of_birth', 'Date de naissance', 'date')}
        <ChampPage libelle="Genre">
          <select value={f.gender} onChange={(e) => poser('gender', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseigné</option>
            {Object.entries(GENRES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        {texte('national_id', 'Pièce d\'identité (numéro)')}
      </SectionFormulaire>
      <SectionFormulaire titre="Poste et affectation">
        {texte('position', 'Poste *')}
        {texte('department', 'Département *')}
        {texte('hire_date', 'Date d\'embauche *', 'date')}
        <ChampPage libelle="Site d'affectation" aide={siteProfil ? 'Votre profil est rattaché à ce site : l\'employé y est enregistré.' : undefined}>
          <select value={siteProfil ?? f.site_id} onChange={(e) => poser('site_id', e.target.value)} disabled={Boolean(siteProfil)} className={CHAMP_FENETRE}>
            {!siteProfil && <option value="">Aucun (employé global, tous sites)</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Coordonnées et urgence">
        {texte('phone', 'Téléphone', 'tel')}
        {texte('email', 'Email', 'email')}
        {texte('address', 'Adresse', 'text', 'sm:col-span-2')}
        {texte('emergency_contact_name', 'Contact d\'urgence')}
        {texte('emergency_contact_phone', 'Téléphone d\'urgence', 'tel')}
      </SectionFormulaire>
      <SectionFormulaire titre="Rémunération">
        <ChampPage libelle="Salaire de base (GNF)" aide="Laisser vide si non connu : aucune valeur n'est supposée.">
          <input inputMode="numeric" value={f.base_salary} onChange={(e) => poser('base_salary', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        {texte('bank_name', 'Banque')}
        {texte('bank_account', 'Compte bancaire')}
        <ChampPage libelle="Notes" className="sm:col-span-2">
          <textarea value={f.notes} onChange={(e) => poser('notes', e.target.value)} rows={3} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
