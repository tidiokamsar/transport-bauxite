import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { routeDetail, routeListe } from '../ui/routeur';
import type { Vehicle, VehiculeDescriptif } from '../../types/vehicle';
import { COLONNES_VEHICULE, TYPES_VEHICULE, VUE_VEHICULES } from './flotte';
import { corpsVehicule, erreursVehicule, saisieDepuisVehicule } from './saisieVehicule';

// Creation et modification des champs descriptifs d'un engin en pleine page
// (D-062, D-090 ; remplace VehicleModal). Le statut, la propriete et le
// contrat passent par les actions de la fiche (fonctions serveur, journal) ;
// le kilometrage par les releves de compteur (D-043).

export const FormulaireVehicule = ({ id }: { id?: string }) => {
  const { sites } = useSite();
  const { profile } = useAuth();
  // Profil borne : l'engin est enregistre sur son site ; « engin global »
  // n'est propose qu'a un profil global (D-038, D-078).
  const siteProfil = profile?.site_id ?? null;
  const [vehicule, setVehicule] = useState<Vehicle | null>(null);
  const [chargement, setChargement] = useState(Boolean(id));
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie(saisieDepuisVehicule(null, siteProfil));

  useEffect(() => {
    if (!id) return;
    lire<Vehicle>(supabase.from('v_vehicules').select(COLONNES_VEHICULE).eq('id', id), 'engin').then((r) => {
      const v = trouver(r.lignes, id);
      setErreurChargement(r.erreur || (v ? '' : 'Engin introuvable ou hors de votre périmètre.'));
      setVehicule(v);
      if (v) initialiser(saisieDepuisVehicule(v, siteProfil));
      setChargement(false);
    });
  }, [id, initialiser, siteProfil]);

  const erreurs = erreursVehicule(f);
  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const corps: VehiculeDescriptif = corpsVehicule(f, siteProfil);
    if (vehicule) {
      const { error } = await supabase.from('vehicles').update(corps).eq('id', vehicule.id);
      return error ? { erreur: error.message } : { vers: routeDetail(VUE_VEHICULES, vehicule.id) };
    }
    const { data, error } = await supabase.from('vehicles').insert(corps).select('id');
    if (error) return { erreur: error.message };
    const nouveau = (data as { id: string }[] | null)?.[0]?.id;
    return { vers: nouveau ? routeDetail(VUE_VEHICULES, nouveau) : routeListe(VUE_VEHICULES) };
  };

  const texte = (cle: keyof typeof f, libelle: string, options: { type?: string; inputMode?: 'decimal' | 'numeric'; erreur?: string } = {}) => (
    <ChampPage libelle={libelle} erreur={options.erreur}>
      <input type={options.type ?? 'text'} inputMode={options.inputMode} value={f[cle]}
        onChange={(e) => poser(cle, cle === 'year' ? e.target.value.replace(/\D/g, '') : e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );

  return (
    <PageFormulaire
      vue={VUE_VEHICULES}
      module="Véhicules et engins"
      titre={id ? `Modifier ${vehicule?.registration ?? 'l\'engin'}` : 'Nouvel engin'}
      reference={vehicule?.registration}
      id={id}
      description="Propriété, contrat et statut se renseignent depuis la fiche de l'engin (actions journalisées) ; le kilométrage par les relevés de compteur."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Identification">
        {texte('registration', 'Immatriculation *')}
        {texte('brand_model', 'Marque et modèle *')}
        <ChampPage libelle="Type *">
          <select value={f.vehicle_type} onChange={(e) => poser('vehicle_type', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {Object.entries(TYPES_VEHICULE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        {texte('capacity_tonnes', 'Capacité (t) *', { inputMode: 'decimal', erreur: erreurs.find((m) => m.startsWith('Capacité en tonnes')) })}
        {texte('year', 'Année', { inputMode: 'numeric' })}
        {texte('chassis_number', 'Numéro de châssis')}
      </SectionFormulaire>
      <SectionFormulaire titre="Affectation et échéances">
        <ChampPage libelle="Site d'affectation" aide={siteProfil ? 'Votre profil est rattaché à ce site : l\'engin y est enregistré.' : undefined}>
          <select value={siteProfil ?? f.site_id} onChange={(e) => poser('site_id', e.target.value)} disabled={Boolean(siteProfil)} className={CHAMP_FENETRE}>
            {!siteProfil && <option value="">Aucun (engin global)</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <span />
        {texte('insurance_expiry', 'Expiration assurance', { type: 'date' })}
        {texte('technical_inspection_expiry', 'Expiration visite technique', { type: 'date' })}
      </SectionFormulaire>
    </PageFormulaire>
  );
};
