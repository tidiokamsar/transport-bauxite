import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { routeDetail, routeListe } from '../ui/routeur';
import {
  COLONNES_SITE, TYPES_SITE_SAISIS, VUE_SITES, corpsSite, erreursSite, libelleTypeSite, saisieDepuisSite, verifierCapacite, verifierCoordonnees,
  type SiteSaisi,
} from './saisieSite';


// Creation et modification d'un site en pleine page (D-090, remplace
// SiteModal). Toutes les colonnes saisies sont rechargees depuis la ligne :
// une modification ne remet jamais a vide un champ non touche (D-079).

interface Compte { id: string; full_name: string | null; role: string }

export const FormulaireSite = ({ id }: { id?: string }) => {
  const [site, setSite] = useState<SiteSaisi | null>(null);
  const [chargement, setChargement] = useState(Boolean(id));
  const [erreurChargement, setErreurChargement] = useState('');
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [erreurComptes, setErreurComptes] = useState('');
  const [organisations, setOrganisations] = useState<{ id: string; raison_sociale: string }[]>([]);
  const [erreurOrganisations, setErreurOrganisations] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie(saisieDepuisSite(null));

  useEffect(() => {
    if (!id) return;
    lire<SiteSaisi>(supabase.from('sites').select(COLONNES_SITE).eq('id', id), 'site').then((r) => {
      const ligne = trouver(r.lignes, id);
      setErreurChargement(r.erreur || (ligne ? '' : 'Site introuvable ou hors de votre périmètre.'));
      setSite(ligne);
      if (ligne) initialiser(saisieDepuisSite(ligne));
      setChargement(false);
    });
  }, [id, initialiser]);

  useEffect(() => {
    // Responsable : un compte actif (fonction serveur reservee a qui ecrit le referentiel).
    supabase.rpc('comptes_selectionnables').then(({ data, error }) => {
      setErreurComptes(error ? `Liste des comptes indisponible : ${error.message}` : '');
      setComptes((data as Compte[] | null) ?? []);
    });
    supabase.from('organisations').select('id, raison_sociale').order('raison_sociale').then(({ data, error }) => {
      setErreurOrganisations(error ? `Organisations indisponibles : ${error.message}` : '');
      setOrganisations((data as { id: string; raison_sociale: string }[] | null) ?? []);
    });
  }, []);

  const erreurCoordonnees = verifierCoordonnees(f.latitude, f.longitude);
  const erreurCapacite = verifierCapacite(f.capacity);
  const erreurs = erreursSite(f);

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const corps = corpsSite(f, site);
    if (site) {
      const { error } = await supabase.from('sites').update(corps).eq('id', site.id);
      return error ? { erreur: error.message } : { vers: routeDetail(VUE_SITES, site.id) };
    }
    const { data, error } = await supabase.from('sites').insert([corps]).select('id');
    if (error) return { erreur: error.message };
    const nouveau = (data as { id: string }[] | null)?.[0]?.id;
    return { vers: nouveau ? routeDetail(VUE_SITES, nouveau) : routeListe(VUE_SITES) };
  };

  const champ = (cle: string, libelle: string, options: { type?: string; inputMode?: 'decimal'; placeholder?: string; erreur?: string; large?: boolean } = {}) => (
    <ChampPage libelle={libelle} erreur={options.erreur} className={options.large ? 'sm:col-span-2' : ''}>
      <input type={options.type ?? 'text'} inputMode={options.inputMode} value={f[cle]} placeholder={options.placeholder}
        onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );

  return (
    <PageFormulaire
      vue={VUE_SITES}
      module="Sites"
      titre={id ? 'Modifier le site' : 'Nouveau site'}
      reference={site?.name}
      id={id}
      description={id ? 'Mettre à jour les informations du site. Le statut se change par l\'action Désactiver ou Réactiver.' : 'Ajouter un site au référentiel ; il est créé actif.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre={id ? 'Mettre à jour' : 'Créer le site'}
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Informations principales">
        {champ('name', 'Nom du site *', { placeholder: 'Ex. Dépôt carburant Sangarédi', large: true })}
        <ChampPage libelle="Type de site *">
          <select value={f.type} onChange={(e) => poser('type', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(TYPES_SITE_SAISIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            {!(f.type in TYPES_SITE_SAISIS) && <option value={f.type}>{libelleTypeSite(f.type)} (hérité)</option>}
          </select>
        </ChampPage>
        <ChampPage libelle="Organisation (D-038)" erreur={erreurOrganisations}>
          <select value={f.organisation_id} onChange={(e) => poser('organisation_id', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">À rattacher (aucune)</option>
            {organisations.map((o) => <option key={o.id} value={o.id}>{o.raison_sociale}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>

      <SectionFormulaire titre="Localisation">
        {champ('address', 'Adresse complète *', { placeholder: 'Ex. Zone industrielle, secteur B', large: true })}
        {champ('city', 'Ville *', { placeholder: 'Ex. Sangarédi' })}
        {champ('country', 'Pays *')}
        {champ('latitude', 'Latitude (facultative)', { inputMode: 'decimal', placeholder: 'Degrés décimaux, ex. 7.65' })}
        {champ('longitude', 'Longitude (facultative)', { inputMode: 'decimal', placeholder: 'Degrés décimaux, ex. -8.40' })}
        {erreurCoordonnees && <p className="text-sm text-red-700 sm:col-span-2">{erreurCoordonnees}</p>}
      </SectionFormulaire>

      <SectionFormulaire titre="Contact">
        {champ('contact_name', 'Nom du contact')}
        {champ('contact_phone', 'Téléphone', { type: 'tel', placeholder: '+224 620 00 00 00' })}
        {champ('contact_email', 'Email', { type: 'email', placeholder: 'contact@exemple.gn' })}
        <ChampPage libelle="Responsable du site (compte actif)" erreur={erreurComptes}>
          <select value={f.responsable_id} onChange={(e) => poser('responsable_id', e.target.value)} disabled={Boolean(erreurComptes)} className={CHAMP_FENETRE}>
            <option value="">Aucun responsable</option>
            {comptes.map((c) => <option key={c.id} value={c.id}>{c.full_name || 'Nom non défini'} ({c.role})</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>

      <SectionFormulaire titre="Capacité et notes">
        {champ('capacity', 'Capacité de stockage (tonnes)', { inputMode: 'decimal', placeholder: 'Vide si inconnue', erreur: erreurCapacite })}
        <p className="text-sm text-stone-600">Le stock d'un site ne se saisit pas : un solde se calcule à partir des mouvements, et aucune source calculée n'existe encore pour le stock d'un site.</p>
        <ChampPage libelle="Notes" className="sm:col-span-2">
          <textarea value={f.notes} onChange={(e) => poser('notes', e.target.value)} rows={3} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
