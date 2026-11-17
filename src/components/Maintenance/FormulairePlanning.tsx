import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { MODULE_PREVENTIF, TYPES_PLANNING, VUE_PREVENTIF, erreursPlanning, saisieDepuisPlanning, valeursPlanning, type Planning } from './preventif';
import { chargerLocationsEngins, type LocationEngin } from './locationsEngins';

// Creation et modification d'un planning preventif en pleine page (D-061,
// D-090). Ecriture dans maintenance_schedules sous RLS (droit maintenance),
// comme l'ecran d'origine : aucune fonction serveur de saisie n'existe.
// L'activation se change par les actions de la fiche.

interface Engin { id: string; registration: string; brand_model: string }

export const FormulairePlanning = ({ planning, chargement, erreurChargement }: { planning?: Planning; chargement?: boolean; erreurChargement?: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [engins, setEngins] = useState<Engin[] | null>(null);
  const [locations, setLocations] = useState<Map<string, LocationEngin>>(new Map());
  const [erreurRef, setErreurRef] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie(saisieDepuisPlanning(planning));

  useEffect(() => {
    Promise.all([supabase.from('vehicles').select('id, registration, brand_model').order('registration'), chargerLocationsEngins()]).then(([e, loc]) => {
      setErreurRef(e.error ? `Engins indisponibles : ${e.error.message}` : '');
      setEngins((e.data ?? []) as Engin[]);
      setLocations(loc);
    });
  }, []);

  const erreurs = [...(peutEcrire ? [] : ['Droit d\'écriture sur la maintenance requis.']), ...erreursPlanning(f)];
  const location = f.engin ? locations.get(f.engin) : undefined;
  const types = TYPES_PLANNING.includes(f.type) || !f.type ? TYPES_PLANNING : [f.type, ...TYPES_PLANNING];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const valeurs = valeursPlanning(f);
    if (planning) {
      const { error } = await supabase.from('maintenance_schedules').update(valeurs).eq('id', planning.id);
      if (error) return { erreur: error.message };
      poserAnnonce('Planning modifié.');
      return { vers: routeDetail(VUE_PREVENTIF, planning.id) };
    }
    const { data, error } = await supabase.from('maintenance_schedules').insert({ ...valeurs, is_active: true }).select('id');
    if (error) return { erreur: error.message };
    poserAnnonce('Planning créé.');
    const id = ((data ?? []) as { id: string }[])[0]?.id;
    return { vers: id ? routeDetail(VUE_PREVENTIF, id) : routeListe(VUE_PREVENTIF) };
  };

  return (
    <PageFormulaire
      vue={VUE_PREVENTIF}
      module={MODULE_PREVENTIF}
      titre={planning ? `Modifier le planning ${planning.title}` : 'Nouveau planning préventif'}
      reference={planning?.title}
      id={planning?.id}
      description="Au moins un intervalle. Sans dernière intervention connue, l'échéance reste « inconnue »."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre={planning ? 'Enregistrer les modifications' : 'Créer le planning'}
      chargement={chargement || engins === null}
      erreurChargement={erreurChargement || erreurRef}
    >
      {engins?.length === 0 && <ReferentielVide>Aucun engin enregistré : créez d'abord l'engin (Flotte → Véhicules et engins).</ReferentielVide>}
      <SectionFormulaire titre="Planning">
        <ChampPage libelle="Engin *">
          <select value={f.engin} onChange={(e) => poser('engin', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(engins ?? []).map((e) => <option key={e.id} value={e.id}>{e.registration} · {e.brand_model}{locations.has(e.id) ? ' (au contrat de location)' : ''}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Intitulé *">
          <input value={f.titre} onChange={(e) => poser('titre', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Type *">
          <select value={f.type} onChange={(e) => poser('type', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Coût estimé (GNF, facultatif)">
          <input inputMode="numeric" value={f.cout} onChange={(e) => poser('cout', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Description" className="sm:col-span-2">
          <input value={f.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        {location && (
          <p className="text-sm text-amber-800 sm:col-span-2">
            Cet engin figure au contrat de location {location.reference} ({location.contrepartie}) : sa maintenance relève du loueur.
          </p>
        )}
      </SectionFormulaire>
      <SectionFormulaire titre="Intervalle et dernière intervention">
        <ChampPage libelle="Intervalle (km)">
          <input inputMode="numeric" value={f.km} onChange={(e) => poser('km', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Intervalle (jours)">
          <input inputMode="numeric" value={f.jours} onChange={(e) => poser('jours', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Dernière intervention : compteur (km)">
          <input inputMode="numeric" value={f.dernierKm} onChange={(e) => poser('dernierKm', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Dernière intervention : date">
          <input type="date" value={f.derniereDate} onChange={(e) => poser('derniereDate', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
