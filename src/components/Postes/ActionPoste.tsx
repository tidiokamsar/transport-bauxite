import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import {
  ACTIONS_POSTE, CATEGORIES_EVENEMENT, COLONNES_POSTE, MODULE_POSTES, VUE_POSTES, actionPosteInterdite, lireRetard,
  type ActionPoste, type Poste,
} from './postes';

// Actions d'un poste en pleine page (D-048, D-090, remplace les
// window.prompt) : chacune par sa fonction serveur existante. Le motif
// d'absence est exige par pointer_presence ; les autres actions n'ont pas
// de motif conserve (leurs champs propres sont la saisie).

interface Membre { id: string; poste_id: string; driver_id: string | null; vehicle_id: string | null }

const TITRES: Record<ActionPoste, string> = {
  affecter: 'Ajouter un chauffeur au poste', pointer: 'Pointer la présence', consigner: 'Consigner un événement',
  cloturer: 'Clore le poste', valider: 'Valider la clôture du poste',
};

export const ActionPosteVue = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const droits = { exploiter: hasPermission('trips', 'create') || hasPermission('trips', 'edit'), valider: hasPermission('planning', 'edit') };
  const [poste, setPoste] = useState<Poste | null>(null);
  const [reference, setReference] = useState('Poste');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [chauffeurs, setChauffeurs] = useState<{ id: string; name: string }[]>([]);
  const [champs, setChamps] = useState({ chauffeur: '', retard: '', categorie: 'information', description: '', sortie: '', rapport: '' });
  const poser = (k: keyof typeof champs, v: string) => setChamps((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    Promise.all([
      lire<Poste>(supabase.from('postes').select(COLONNES_POSTE).eq('id', id), 'poste'),
      lire<Membre>(supabase.from('postes_equipe').select('id, poste_id, driver_id, vehicle_id').eq('poste_id', id), 'équipe du poste'),
      supabase.from('drivers').select('id, name').eq('status', 'active').order('name'),
    ]).then(async ([p, e, d]) => {
      const ligne = trouver(p.lignes, id);
      setPoste(ligne);
      setMembres((e.lignes ?? []).filter((m) => m.poste_id === id));
      setChauffeurs((d.data ?? []) as { id: string; name: string }[]);
      setErreur(p.erreur || e.erreur || (ligne ? '' : 'Poste introuvable ou hors de votre périmètre.'));
      if (ligne) {
        const [sh, si] = await Promise.all([
          supabase.from('work_shifts').select('id, display_name').eq('id', ligne.shift_id),
          supabase.from('sites').select('id, name').eq('id', ligne.site_id),
        ]);
        const shift = ((sh.data ?? []) as { id: string; display_name: string }[]).find((x) => x.id === ligne.shift_id)?.display_name ?? 'Poste';
        const site = ((si.data ?? []) as { id: string; name: string }[]).find((x) => x.id === ligne.site_id)?.name ?? '';
        setReference(`${shift} · ${site} · ${new Date(`${ligne.date_poste}T00:00:00`).toLocaleDateString('fr-FR')}`);
      }
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_POSTE as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un poste de travail.`} />;
  }
  const a = action as ActionPoste;
  const commun = { vue: VUE_POSTES, module: MODULE_POSTES, reference, id, chargement, erreurChargement: erreur };
  const interditEtat = poste ? actionPosteInterdite(a, poste.statut, droits) : null;
  const nomChauffeur = (driver: string | null) => chauffeurs.find((c) => c.id === driver)?.name ?? 'membre';

  if (a === 'pointer') {
    const membre = membres.find((m) => m.id === requete.membre) ?? null;
    const present = requete.presence !== 'absent';
    const retard = lireRetard(champs.retard);
    return (
      <PageAction
        {...commun}
        titre={`${present ? 'Présent' : 'Absent'} : ${membre ? nomChauffeur(membre.driver_id) : 'membre'}`}
        description={present ? 'La présence est enregistrée sur le poste ; un retard se saisit en minutes.' : 'L\'absence est enregistrée avec son motif (exigé par le serveur).'}
        motif={present ? 'aucun' : 'obligatoire'}
        motifMinimum={1}
        libelleConfirmer={present ? 'Pointer présent' : 'Pointer absent'}
        interdit={interditEtat ?? (!chargement && !membre ? 'Membre introuvable dans l\'équipe de ce poste.' : null)}
        pret={present ? retard.erreur === null : true}
        messageSucces="Présence pointée."
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('pointer_presence', {
            p_membre_id: membre?.id, p_present: present, p_retard_minutes: present ? retard.valeur : null, p_motif: present ? null : motif,
          });
          return error ? error.message : null;
        }}
      >
        {present && (
          <ChampPage libelle="Retard en minutes (vide si à l'heure)" erreur={retard.erreur}>
            <input inputMode="numeric" value={champs.retard} onChange={(e) => poser('retard', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        )}
      </PageAction>
    );
  }

  const definition: Record<Exclude<ActionPoste, 'pointer'>, {
    pret: boolean; confirmer: string; succes: string; description: string; executer: () => PromiseLike<{ error: { message: string } | null }>; champs?: ReactNode;
  }> = {
    affecter: {
      pret: Boolean(champs.chauffeur), confirmer: 'Ajouter', succes: 'Chauffeur ajouté au poste.',
      description: 'Le chauffeur rejoint l\'équipe du poste ; sa présence se pointe ensuite depuis la fiche.',
      executer: () => supabase.rpc('affecter_au_poste', { p_poste_id: id, p_driver_id: champs.chauffeur, p_vehicle_id: null }),
      champs: (
        <ChampPage libelle="Chauffeur *">
          <select value={champs.chauffeur} onChange={(e) => poser('chauffeur', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {chauffeurs.filter((c) => !membres.some((m) => m.driver_id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </ChampPage>
      ),
    },
    consigner: {
      pret: Boolean(champs.description.trim()), confirmer: 'Consigner', succes: 'Événement consigné.',
      description: 'L\'événement est horodaté à l\'enregistrement et entre dans le bilan du poste.',
      executer: () => supabase.rpc('consigner_evenement_poste', {
        p_poste_id: id, p_categorie: champs.categorie, p_description: champs.description.trim(), p_quand: new Date().toISOString(), p_vehicle_id: null,
      }),
      champs: (
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <ChampPage libelle="Catégorie">
            <select value={champs.categorie} onChange={(e) => poser('categorie', e.target.value)} className={CHAMP_FENETRE}>
              {Object.entries(CATEGORIES_EVENEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </ChampPage>
          <ChampPage libelle="Description *">
            <input value={champs.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      ),
    },
    cloturer: {
      pret: Boolean(champs.sortie.trim()), confirmer: 'Clore le poste', succes: 'Poste clos : bilan figé, consignes transmises au poste suivant.',
      description: 'La clôture fige le bilan (objectif, livraisons, présence, événements) et transmet les consignes au poste suivant du site.',
      executer: () => supabase.rpc('cloturer_poste', { p_poste_id: id, p_consignes_sortie: champs.sortie.trim(), p_rapport: champs.rapport.trim() || null }),
      champs: (
        <div className="space-y-4">
          <ChampPage libelle="Consignes pour le poste suivant * (même « rien à signaler »)">
            <textarea value={champs.sortie} onChange={(e) => poser('sortie', e.target.value)} rows={3} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Rapport de poste">
            <textarea value={champs.rapport} onChange={(e) => poser('rapport', e.target.value)} rows={3} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      ),
    },
    valider: {
      pret: true, confirmer: 'Valider la clôture', succes: 'Clôture validée.',
      description: 'La validation est faite par une autre personne que celle qui a clos le poste (contrôle serveur).',
      executer: () => supabase.rpc('valider_cloture_poste', { p_poste_id: id }),
    },
  };
  const d = definition[a];

  return (
    <PageAction
      {...commun}
      titre={TITRES[a]}
      description={d.description}
      motif="aucun"
      libelleConfirmer={d.confirmer}
      interdit={interditEtat}
      pret={d.pret}
      messageSucces={d.succes}
      onExecuter={async () => {
        const { error } = await d.executer();
        return error ? error.message : null;
      }}
    >
      {d.champs}
    </PageAction>
  );
};
