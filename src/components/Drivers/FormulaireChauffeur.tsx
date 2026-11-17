import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { routeDetail, routeListe } from '../ui/routeur';
import { CONTRATS_CHAUFFEUR, VUE_CHAUFFEURS, corpsChauffeur, saisieDepuisChauffeur, type Chauffeur } from './chauffeur';

// Creation et modification d'un dossier chauffeur en pleine page (D-090,
// remplace DriverModal). Le statut change par les actions de la fiche
// (suspendre, reactiver, archiver) ; les infractions et habilitations se
// gerent dans la fiche. Dates et champs facultatifs vides -> null (D-078).

const CATEGORIES: Record<string, string> = { A: 'A - Moto', B: 'B - Voiture', C: 'C - Poids lourd', D: 'D - Transport de personnes', E: 'E - Remorque' };

export const FormulaireChauffeur = ({ id }: { id?: string }) => {
  const { profile } = useAuth();
  const { sites } = useSite();
  // Profil borne : le chauffeur est cree sur son site (RLS D-038) ; seul un
  // profil global peut creer un chauffeur global (D-078).
  const siteProfil = profile?.site_id ?? null;
  const [chauffeur, setChauffeur] = useState<Chauffeur | null>(null);
  const [chargement, setChargement] = useState(Boolean(id));
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie(saisieDepuisChauffeur(null, siteProfil));

  useEffect(() => {
    if (!id) return;
    lire<Chauffeur>(supabase.from('drivers').select('*').eq('id', id), 'chauffeur').then((r) => {
      const d = trouver(r.lignes, id);
      setErreurChargement(r.erreur || (d ? '' : 'Chauffeur introuvable ou hors de votre périmètre.'));
      setChauffeur(d);
      if (d) initialiser(saisieDepuisChauffeur(d, siteProfil));
      setChargement(false);
    });
  }, [id, initialiser, siteProfil]);

  const { corps, erreur } = corpsChauffeur(f, siteProfil);
  const erreurs = [!String(f.employee_id).trim() && 'ID employé requis.', erreur].filter((m): m is string => Boolean(m));

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    if (!corps) return { erreur: erreur ?? 'Saisie incomplète' };
    if (chauffeur) {
      const { error } = await supabase.from('drivers').update({ ...corps, updated_at: new Date().toISOString() }).eq('id', chauffeur.id);
      return error ? { erreur: error.message } : { vers: routeDetail(VUE_CHAUFFEURS, chauffeur.id) };
    }
    const { data, error } = await supabase.from('drivers').insert([corps]).select('id');
    if (error) return { erreur: error.message };
    const nouveau = (data as { id: string }[] | null)?.[0]?.id;
    return { vers: nouveau ? routeDetail(VUE_CHAUFFEURS, nouveau) : routeListe(VUE_CHAUFFEURS) };
  };

  const texte = (cle: string, libelle: string, type = 'text', className = '') => (
    <ChampPage libelle={libelle} className={className}>
      <input type={type} value={String(f[cle] ?? '')} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );

  return (
    <PageFormulaire
      vue={VUE_CHAUFFEURS}
      module="Chauffeurs"
      titre={id ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'}
      reference={chauffeur?.name}
      id={id}
      description={id ? 'Le statut du dossier se change par les actions de la fiche (suspendre, réactiver, archiver).' : 'Le dossier est créé actif.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Informations personnelles">
        {texte('name', 'Nom complet *')}
        {texte('employee_id', 'ID Employé *')}
        {texte('phone', 'Téléphone', 'tel')}
        {texte('email', 'Email', 'email')}
        {texte('birth_date', 'Date de naissance', 'date')}
        {texte('address', 'Adresse')}
      </SectionFormulaire>
      <SectionFormulaire titre="Contact d'urgence">
        {texte('emergency_contact_name', 'Nom du contact')}
        {texte('emergency_contact_phone', 'Téléphone d\'urgence', 'tel')}
      </SectionFormulaire>
      <SectionFormulaire titre="Permis de conduire">
        {texte('license_number', 'Numéro de permis *')}
        <ChampPage libelle="Catégorie *">
          <select value={String(f.license_category)} onChange={(e) => poser('license_category', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        {texte('license_expiry', 'Date d\'expiration du permis *', 'date')}
        {texte('health_certificate_expiry', 'Expiration certificat médical', 'date')}
      </SectionFormulaire>
      <SectionFormulaire titre="Informations contractuelles">
        {texte('hire_date', 'Date d\'embauche *', 'date')}
        <ChampPage libelle="Type de contrat *">
          <select value={String(f.contract_type)} onChange={(e) => poser('contract_type', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(CONTRATS_CHAUFFEUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Salaire de base (GNF)" erreur={erreur?.startsWith('Salaire') ? erreur : null}>
          <input inputMode="numeric" value={String(f.base_salary ?? '')} onChange={(e) => poser('base_salary', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Site d'affectation" aide={siteProfil ? 'Votre profil est rattaché à ce site : le chauffeur y est enregistré.' : undefined}>
          <select value={siteProfil ?? String(f.site_id)} onChange={(e) => poser('site_id', e.target.value)} disabled={Boolean(siteProfil)} className={CHAMP_FENETRE}>
            {!siteProfil && <option value="">Aucun (chauffeur global, tous sites)</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Notes" className="sm:col-span-2">
          <textarea value={String(f.notes ?? '')} onChange={(e) => poser('notes', e.target.value)} rows={3} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
