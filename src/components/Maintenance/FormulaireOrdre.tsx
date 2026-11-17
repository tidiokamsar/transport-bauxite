import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  ATELIERS_ORDRE, MODULE_ORDRES, PRIORITES_ORDRE, TYPES_ORDRE, VUE_ORDRES, erreursOrdre, modificationOrdreInterdite, saisieDepuisOrdre, valeursOrdre,
  type Ordre,
} from './ordres';

// Creation et modification d'un ordre de travail en pleine page (D-061,
// D-090). Ecriture dans maintenance_orders sous RLS et droits de colonne,
// comme l'ecran d'origine (aucune fonction serveur de saisie) : le numero et
// les gardes d'etat sont tenus par le declencheur garde_ordre_travail. Le
// statut ne se modifie pas ici : il passe par les actions de la fiche.

interface Engin { id: string; registration: string; brand_model: string }
interface Lib { id: string; libelle: string }

export const FormulaireOrdre = ({ ordre, chargement, erreurChargement }: { ordre?: Ordre; chargement?: boolean; erreurChargement?: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [engins, setEngins] = useState<Engin[] | null>(null);
  const [sites, setSites] = useState<Lib[]>([]);
  const [erreurRef, setErreurRef] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie(saisieDepuisOrdre(ordre));

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, registration, brand_model').order('registration'),
      supabase.from('sites').select('id, name').order('name'),
    ]).then(([e, s]) => {
      setErreurRef(e.error ? `Engins indisponibles : ${e.error.message}` : '');
      setEngins((e.data ?? []) as Engin[]);
      setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    });
  }, []);

  const interdit = ordre ? modificationOrdreInterdite(ordre.status, peutEcrire) : (peutEcrire ? null : 'Droit d\'écriture sur la maintenance requis.');
  const erreurs = [...(interdit ? [interdit] : []), ...erreursOrdre(f)];
  const reference = ordre?.work_order_number ?? ordre?.title ?? undefined;

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const valeurs = valeursOrdre(f);
    if (ordre) {
      const { error } = await supabase.from('maintenance_orders').update({ ...valeurs, updated_at: new Date().toISOString() }).eq('id', ordre.id);
      if (error) return { erreur: error.message };
      poserAnnonce('Ordre modifié.');
      return { vers: routeDetail(VUE_ORDRES, ordre.id) };
    }
    const { data, error } = await supabase.from('maintenance_orders')
      .insert({ ...valeurs, status: 'open', request_date: new Date().toISOString().slice(0, 10) }).select('id');
    if (error) return { erreur: error.message };
    poserAnnonce('Ordre créé : son numéro est attribué par le serveur.');
    const id = ((data ?? []) as { id: string }[])[0]?.id;
    return { vers: id ? routeDetail(VUE_ORDRES, id) : routeListe(VUE_ORDRES) };
  };

  return (
    <PageFormulaire
      vue={VUE_ORDRES}
      module={MODULE_ORDRES}
      titre={ordre ? `Modifier l'ordre ${reference ?? ''}`.trim() : 'Nouvel ordre de travail'}
      reference={reference}
      id={ordre?.id}
      description={ordre ? 'Le statut se change par les actions de la fiche (démarrer, terminer, annuler).' : 'Numéro : attribué à l\'enregistrement. L\'ordre est créé ouvert.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre={ordre ? 'Enregistrer les modifications' : 'Créer l\'ordre'}
      chargement={chargement || engins === null}
      erreurChargement={erreurChargement || erreurRef}
    >
      {engins?.length === 0 && <ReferentielVide>Aucun engin enregistré : créez d'abord l'engin (Flotte → Véhicules et engins).</ReferentielVide>}
      <SectionFormulaire titre="Intervention">
        <ChampPage libelle="Engin *">
          <select value={f.engin} onChange={(e) => poser('engin', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(engins ?? []).map((e) => <option key={e.id} value={e.id}>{e.registration} · {e.brand_model}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Intitulé *">
          <input value={f.titre} onChange={(e) => poser('titre', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Type *">
          <select value={f.type} onChange={(e) => poser('type', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {Object.entries(TYPES_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Priorité">
          <select value={f.priorite} onChange={(e) => poser('priorite', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseignée</option>
            {Object.entries(PRIORITES_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Atelier">
          <select value={f.atelier} onChange={(e) => poser('atelier', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseigné</option>
            {Object.entries(ATELIERS_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Site">
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Site de l'engin</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Date prévue">
          <input type="date" value={f.prevue} onChange={(e) => poser('prevue', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Compteur (km)">
          <input inputMode="numeric" value={f.km} onChange={(e) => poser('km', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Description" className="sm:col-span-2">
          <input value={f.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Main d'œuvre et coûts (GNF)">
        <ChampPage libelle="Heures de main d'œuvre">
          <input inputMode="decimal" value={f.heures} onChange={(e) => poser('heures', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Coût main d'œuvre (GNF)">
          <input inputMode="numeric" value={f.mo} onChange={(e) => poser('mo', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Coût estimé (GNF)">
          <input inputMode="numeric" value={f.estime} onChange={(e) => poser('estime', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Coût réel constaté (GNF)" aide="Le coût des pièces se lit sur la fiche (registre des stocks).">
          <input inputMode="numeric" value={f.reel} onChange={(e) => poser('reel', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Notes" className="sm:col-span-2">
          <textarea value={f.notes} onChange={(e) => poser('notes', e.target.value)} rows={3} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
