import { useEffect, useState } from 'react';
import { CheckCircle2, DoorClosed, MessageSquarePlus, Printer, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail } from '../ui/routeur';
import {
  CATEGORIES_EVENEMENT, COLONNES_POSTE, LIBELLE_STATUT_POSTE, MODULE_POSTES, VUE_POSTES, actionPosteInterdite, resumeBilan, teintePoste, type Poste,
} from './postes';

// Fiche d'un poste (D-048, D-090) : consignes et bilan, equipe et presence,
// evenements, historique (journal des etats du poste et evenements
// consignes), actions selon le droit et l'etat du poste.

interface Membre { id: string; poste_id: string; driver_id: string | null; vehicle_id: string | null; present: boolean | null; retard_minutes: number | null; motif_absence: string | null }
interface Evenement { id: string; poste_id: string; survenu_le: string; categorie: keyof typeof CATEGORIES_EVENEMENT; description: string }
interface Journal { id: string; poste_id: string; etat_avant: string | null; etat_apres: string; motif: string | null; auteur: string | null; cree_le: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const libelleEtat = (e: string | null) => (e ? LIBELLE_STATUT_POSTE[e as keyof typeof LIBELLE_STATUT_POSTE] ?? e : null);

export const DetailPoste = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const droits = { exploiter: hasPermission('trips', 'create') || hasPermission('trips', 'edit'), valider: hasPermission('planning', 'edit') };
  const [poste, setPoste] = useState<Lecture<Poste>>(attente);
  const [equipe, setEquipe] = useState<Lecture<Membre>>(attente);
  const [evenements, setEvenements] = useState<Lecture<Evenement>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [noms, setNoms] = useState({ shift: '', site: '', chauffeurs: new Map<string, string>(), engins: new Map<string, string>() });

  useEffect(() => {
    lire<Poste>(supabase.from('postes').select(COLONNES_POSTE).eq('id', id), 'poste').then(async (r) => {
      setPoste(r);
      const p = trouver(r.lignes, id);
      if (!p) return;
      const [sh, si] = await Promise.all([
        supabase.from('work_shifts').select('id, display_name').eq('id', p.shift_id),
        supabase.from('sites').select('id, name').eq('id', p.site_id),
      ]);
      const shift = ((sh.data ?? []) as { id: string; display_name: string }[]).find((x) => x.id === p.shift_id)?.display_name ?? 'Shift';
      const site = ((si.data ?? []) as { id: string; name: string }[]).find((x) => x.id === p.site_id)?.name ?? 'Site';
      setNoms((n) => ({ ...n, shift, site }));
    });
    lire<Membre>(supabase.from('postes_equipe').select('id, poste_id, driver_id, vehicle_id, present, retard_minutes, motif_absence').eq('poste_id', id), 'équipe du poste')
      .then(async (r) => {
        const lignes = (r.lignes ?? []).filter((m) => m.poste_id === id);
        setEquipe({ ...r, lignes: r.lignes && lignes });
        const chauffeurs = [...new Set(lignes.map((m) => m.driver_id).filter((x): x is string => Boolean(x)))];
        const engins = [...new Set(lignes.map((m) => m.vehicle_id).filter((x): x is string => Boolean(x)))];
        const [d, v] = await Promise.all([
          chauffeurs.length ? supabase.from('drivers').select('id, name').in('id', chauffeurs) : Promise.resolve({ data: [] }),
          engins.length ? supabase.from('vehicles').select('id, registration').in('id', engins) : Promise.resolve({ data: [] }),
        ]);
        setNoms((n) => ({
          ...n,
          chauffeurs: new Map(((d.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
          engins: new Map(((v.data ?? []) as { id: string; registration: string }[]).map((x) => [x.id, x.registration])),
        }));
      });
    lire<Evenement>(supabase.from('postes_evenements').select('id, poste_id, survenu_le, categorie, description').eq('poste_id', id).order('survenu_le'), 'événements du poste')
      .then((r) => setEvenements({ ...r, lignes: r.lignes && r.lignes.filter((e) => e.poste_id === id) }));
    lire<Journal>(supabase.from('postes_journal').select('id, poste_id, etat_avant, etat_apres, motif, auteur, cree_le').eq('poste_id', id).order('rang'), 'journal du poste')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((j) => j.poste_id === id) }));
  }, [id]);

  const p = trouver(poste.lignes, id);
  const reference = p ? `${noms.shift || 'Poste'} · ${noms.site} · ${new Date(`${p.date_poste}T00:00:00`).toLocaleDateString('fr-FR')}` : 'Poste';
  const possible = (a: Parameters<typeof actionPosteInterdite>[0]) => Boolean(p) && actionPosteInterdite(a, p?.statut ?? '', droits) === null;
  const nomMembre = (m: Membre) => (m.driver_id ? noms.chauffeurs.get(m.driver_id) ?? 'Chauffeur' : m.vehicle_id ? noms.engins.get(m.vehicle_id) ?? 'Engin' : 'Membre');

  // Journal des etats (D-087) ; a defaut (postes anterieurs au journal), les
  // horodatages enregistres sur le poste. Evenements consignes en plus.
  const historique: EvenementHistorique[] | null = p && journal.lignes && evenements.lignes ? fusionnerHistoriques(
    journal.lignes.length > 0
      ? journal.lignes.map((j) => ({
        id: `postes_journal-${j.id}`, le: j.cree_le, libelle: j.etat_avant ? `${libelleEtat(j.etat_avant)} → ${libelleEtat(j.etat_apres)}` : `Poste ${libelleEtat(j.etat_apres)?.toLowerCase()}`,
        motif: j.motif, auteur: j.auteur, source: 'postes_journal',
      }))
      : [
        { id: 'postes-ouvert', le: p.ouvert_le, libelle: 'Poste ouvert', source: 'postes.ouvert_le' },
        ...(p.cloture_le ? [{ id: 'postes-clos', le: p.cloture_le, libelle: 'Poste clos (bilan figé)', source: 'postes.cloture_le' }] : []),
        ...(p.valide_le ? [{ id: 'postes-valide', le: p.valide_le, libelle: 'Clôture validée', source: 'postes.valide_le' }] : []),
      ],
    evenements.lignes.map((e) => ({ id: `postes_evenements-${e.id}`, le: e.survenu_le, libelle: `Événement : ${CATEGORIES_EVENEMENT[e.categorie] ?? e.categorie}`, detail: e.description, source: 'postes_evenements' })),
  ) : null;

  const pointer = (m: Membre, present: boolean) => ecrireRoute({ vue: VUE_POSTES, mode: 'action', id, action: 'pointer', requete: { membre: m.id, presence: present ? 'present' : 'absent' } });

  return (
    <PageDetail
      vue={VUE_POSTES}
      module={MODULE_POSTES}
      reference={reference}
      statut={p ? { libelle: LIBELLE_STATUT_POSTE[p.statut] ?? p.statut, teinte: teintePoste(p.statut) } : null}
      resume={p && <>Ouvert le {new Date(p.ouvert_le).toLocaleString('fr-FR')}{p.cloture_le ? ` · clos le ${new Date(p.cloture_le).toLocaleString('fr-FR')}` : ''}</>}
      chargement={poste.lignes === null && !poste.erreur}
      erreur={poste.erreur}
      introuvable={poste.lignes !== null && !p}
      actions={[
        { id: 'affecter', libelle: 'Ajouter un chauffeur', icone: <UserPlus className="h-4 w-4" />, visible: possible('affecter'), vers: routeAction(VUE_POSTES, id, 'affecter') },
        { id: 'consigner', libelle: 'Consigner un événement', icone: <MessageSquarePlus className="h-4 w-4" />, visible: possible('consigner'), vers: routeAction(VUE_POSTES, id, 'consigner') },
        { id: 'cloturer', libelle: 'Clore le poste', icone: <DoorClosed className="h-4 w-4" />, visible: possible('cloturer'), ton: 'principal', vers: routeAction(VUE_POSTES, id, 'cloturer') },
        { id: 'valider', libelle: 'Valider la clôture', icone: <CheckCircle2 className="h-4 w-4" />, visible: possible('valider'), ton: 'principal', vers: routeAction(VUE_POSTES, id, 'valider') },
      ]}
      onglets={!p ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <Informations groupes={[
              { titre: 'Poste', champs: [['Date', new Date(`${p.date_poste}T00:00:00`).toLocaleDateString('fr-FR')], ['Shift', noms.shift || null], ['Site', noms.site || null],
                ['Statut', LIBELLE_STATUT_POSTE[p.statut] ?? p.statut], ['Validé le', p.valide_le ? new Date(p.valide_le).toLocaleString('fr-FR') : null]] },
              { titre: 'Passation', champs: [['Consignes reçues', p.consignes_recues && <span className="whitespace-pre-line">{p.consignes_recues}</span>],
                ['Consignes transmises', p.consignes_sortie ? <span className="whitespace-pre-line">{p.consignes_sortie}</span> : (droits.exploiter && possible('cloturer') ? 'À rédiger à la clôture' : null)],
                ['Rapport de poste', p.rapport && <span className="whitespace-pre-line">{p.rapport}</span>], ['Bilan figé', p.bilan ? resumeBilan(p.bilan) : null]] },
            ]} />
            <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"><Printer className="h-4 w-4" /> Imprimer le rapport</button>
          </div>
        ) },
        { id: 'relations', libelle: 'Équipe et événements', compte: equipe.lignes?.length ?? null, contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Équipe" lignes={equipe.lignes} erreur={equipe.erreur} cle={(m) => m.id} vide="Aucun membre affecté"
              lien={(m) => (m.driver_id ? routeDetail('drivers', m.driver_id) : m.vehicle_id ? routeDetail('vehicles', m.vehicle_id) : routeDetail(VUE_POSTES, id, 'relations'))}
              colonnes={[
                { libelle: 'Membre', valeur: nomMembre },
                { libelle: 'Présence', valeur: (m) => (m.present === null ? <Puce teinte="gris">Non pointé</Puce> : m.present
                  ? <Puce teinte="vert">Présent{m.retard_minutes ? ` (retard ${m.retard_minutes} min)` : ''}</Puce>
                  : <Puce teinte="rouge">Absent : {m.motif_absence}</Puce>) },
                ...(possible('pointer') ? [{ libelle: 'Pointage', valeur: (m: Membre) => (
                  <span className="flex gap-2 text-xs">
                    <a href={pointer(m, true)} aria-label={`Présent ${nomMembre(m)}`} className="rounded border border-stone-300 px-2 py-1 font-semibold">Présent</a>
                    <a href={pointer(m, false)} aria-label={`Absent ${nomMembre(m)}`} className="rounded border border-stone-300 px-2 py-1 font-semibold">Absent</a>
                  </span>
                ) }] : []),
              ]} />
            <Relation titre="Événements" lignes={evenements.lignes} erreur={evenements.erreur} cle={(e) => e.id} vide="Aucun événement consigné"
              colonnes={[
                { libelle: 'Heure', valeur: (e) => new Date(e.survenu_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
                { libelle: 'Catégorie', valeur: (e) => CATEGORIES_EVENEMENT[e.categorie] ?? e.categorie },
                { libelle: 'Description', valeur: (e) => e.description },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur || evenements.erreur} source="postes_journal (états du poste), postes_evenements ; à défaut de journal, horodatages du poste" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un poste de travail" /> },
      ]}
    />
  );
};
