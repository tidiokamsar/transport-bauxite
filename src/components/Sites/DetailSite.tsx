import { useEffect, useState } from 'react';
import { Edit2, Power, PowerOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { identifiantSur, lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail, routeModifier } from '../ui/routeur';
import { COLONNES_SITE, VUE_SITES, libelleTypeSite, type SiteSaisi } from './saisieSite';

// Fiche d'un site (D-090) : informations, relations (engins, chauffeurs,
// voyages au depart ou a l'arrivee, comptes affectes), historique et
// actions. Le referentiel des sites ne tient pas de journal de ses propres
// modifications : l'historique montre les affectations de comptes, seul
// journal existant qui porte le site (ecart signale dans l'onglet).

interface Engin { id: string; registration: string; vehicle_type: string; status: string }
interface Chauffeur { id: string; name: string; status: string }
interface Voyage { id: string; reference: string; planned_date: string | null; etat: string | null; departure_site_id: string | null; arrival_site_id: string | null }
interface Affectation { id: string; utilisateur: string; debut: string; fin: string | null; annulee_le: string | null }
interface JournalAffectation { id: number; utilisateur: string; evenement: string; motif: string | null; auteur: string | null; le: string }

const EVENEMENTS: Record<string, string> = { creation: 'Affectation d\'un compte au site', cloture: 'Fin d\'affectation d\'un compte', annulation: 'Affectation annulée' };
const jour = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : '—');
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

export const DetailSite = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const [site, setSite] = useState<Lecture<SiteSaisi>>(attente);
  const [organisation, setOrganisation] = useState('');
  const [responsable, setResponsable] = useState('');
  const [engins, setEngins] = useState<Lecture<Engin>>(attente);
  const [chauffeurs, setChauffeurs] = useState<Lecture<Chauffeur>>(attente);
  const [voyages, setVoyages] = useState<Lecture<Voyage>>(attente);
  const [affectations, setAffectations] = useState<Lecture<Affectation>>(attente);
  const [journal, setJournal] = useState<Lecture<JournalAffectation>>(attente);

  useEffect(() => {
    lire<SiteSaisi>(supabase.from('sites').select(COLONNES_SITE).eq('id', id), 'site').then(async (r) => {
      setSite(r);
      const s = trouver(r.lignes, id);
      if (s?.organisation_id) {
        const o = await supabase.from('organisations').select('id, raison_sociale').eq('id', s.organisation_id);
        const ligne = ((o.data ?? []) as { id: string; raison_sociale: string }[]).find((x) => x.id === s.organisation_id);
        setOrganisation(ligne?.raison_sociale ?? (o.error ? 'Non visible avec vos droits' : 'Organisation inconnue'));
      }
      if (s?.responsable_id) {
        const p = await supabase.from('profiles').select('id, full_name').eq('id', s.responsable_id);
        const ligne = ((p.data ?? []) as { id: string; full_name: string | null }[]).find((x) => x.id === s.responsable_id);
        setResponsable(ligne?.full_name ?? `Compte ${s.responsable_id.slice(0, 8)}`);
      }
    });
    lire<Engin>(supabase.from('vehicles').select('id, registration, vehicle_type, status').eq('site_id', id).order('registration'), 'engins du site').then(setEngins);
    lire<Chauffeur>(supabase.from('drivers').select('id, name, status').eq('site_id', id).order('name'), 'chauffeurs du site').then(setChauffeurs);
    if (!identifiantSur(id)) setVoyages({ lignes: [], erreur: '' }); else lire<Voyage>(supabase.from('trips').select('id, reference, planned_date, etat, departure_site_id, arrival_site_id')
      .or(`departure_site_id.eq.${id},arrival_site_id.eq.${id}`).order('planned_date', { ascending: false }).limit(20), 'voyages du site').then(setVoyages);
    lire<Affectation>(supabase.from('affectations_sites').select('id, utilisateur, debut, fin, annulee_le').eq('site_id', id).order('debut', { ascending: false }), 'affectations').then(setAffectations);
    lire<JournalAffectation>(supabase.from('journal_affectations_sites').select('id, utilisateur, evenement, motif, auteur, le').eq('site_id', id).order('le', { ascending: false }), 'journal des affectations').then(setJournal);
  }, [id]);

  const s = trouver(site.lignes, id);
  const peutModifier = hasPermission('settings', 'edit');
  const actif = s?.is_active !== false;

  const historique: EvenementHistorique[] | null = journal.lignes && fusionnerHistoriques(journal.lignes.map((j) => ({
    id: `journal_affectations_sites-${j.id}`, le: j.le, libelle: EVENEMENTS[j.evenement] ?? j.evenement,
    detail: `Compte ${j.utilisateur.slice(0, 8)}`, motif: j.motif, auteur: j.auteur, source: 'journal_affectations_sites',
  })));

  return (
    <PageDetail
      vue={VUE_SITES}
      module="Sites"
      reference={s?.name ?? 'Site'}
      statut={s ? (actif ? { libelle: 'Actif', teinte: 'vert' } : { libelle: 'Inactif', teinte: 'gris' }) : null}
      resume={s && <>{libelleTypeSite(s.type)}{s.city ? ` · ${s.city}` : ''}{s.country ? `, ${s.country}` : ''}</>}
      chargement={site.lignes === null && !site.erreur}
      erreur={site.erreur}
      introuvable={site.lignes !== null && !s}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <Edit2 className="h-4 w-4" />, visible: peutModifier, ton: 'principal', vers: routeModifier(VUE_SITES, id) },
        { id: 'desactiver', libelle: 'Désactiver', icone: <PowerOff className="h-4 w-4" />, visible: peutModifier && actif, ton: 'danger', vers: routeAction(VUE_SITES, id, 'desactiver') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <Power className="h-4 w-4" />, visible: peutModifier && !actif, vers: routeAction(VUE_SITES, id, 'reactiver') },
      ]}
      onglets={!s ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Identification', champs: [['Nom', s.name], ['Type', libelleTypeSite(s.type)], ['Organisation', s.organisation_id ? organisation || '…' : null], ['Statut', actif ? 'Actif' : 'Inactif']] },
            { titre: 'Localisation', champs: [['Adresse', s.address], ['Ville', s.city], ['Pays', s.country],
              ['Coordonnées', s.latitude != null && s.longitude != null ? `${s.latitude}, ${s.longitude}` : null]] },
            { titre: 'Contact', champs: [['Contact', s.contact_name], ['Téléphone', s.contact_phone], ['Email', s.contact_email], ['Responsable', s.responsable_id ? responsable || '…' : null]] },
            { titre: 'Capacité et notes', champs: [['Capacité de stockage', s.capacity != null ? `${s.capacity.toLocaleString('fr-FR')} t` : null], ['Stock', 'Non saisissable : aucune source calculée (D-079)'], ['Notes', s.notes]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Engins affectés" lignes={engins.lignes} erreur={engins.erreur} cle={(e) => e.id} vide="Aucun engin affecté à ce site"
              lien={(e) => routeDetail('vehicles', e.id)}
              colonnes={[{ libelle: 'Immatriculation', valeur: (e) => e.registration }, { libelle: 'Type', valeur: (e) => e.vehicle_type }, { libelle: 'Statut', valeur: (e) => e.status }]} />
            <Relation titre="Chauffeurs affectés" lignes={chauffeurs.lignes} erreur={chauffeurs.erreur} cle={(c) => c.id} vide="Aucun chauffeur affecté à ce site"
              lien={(c) => routeDetail('drivers', c.id)}
              colonnes={[{ libelle: 'Nom', valeur: (c) => c.name }, { libelle: 'Statut', valeur: (c) => c.status }]} />
            <Relation titre="Derniers voyages (départ ou arrivée)" lignes={voyages.lignes} erreur={voyages.erreur} cle={(v) => v.id} vide="Aucun voyage au départ ou à l'arrivée de ce site"
              note="Les 20 plus récents ; la fiche d'un voyage s'ouvre depuis Voyages & Rotations."
              colonnes={[{ libelle: 'Voyage', valeur: (v) => v.reference }, { libelle: 'Date prévue', valeur: (v) => jour(v.planned_date) },
                { libelle: 'Sens', valeur: (v) => (v.departure_site_id === id ? 'Départ' : 'Arrivée') }, { libelle: 'État', valeur: (v) => v.etat ?? '—' }]} />
            <Relation titre="Comptes affectés au site" lignes={affectations.lignes} erreur={affectations.erreur} cle={(a) => a.id} vide="Aucune affectation de compte"
              note="Lecture réservée à l'administration (affectations multisites, D-064)."
              colonnes={[{ libelle: 'Compte', valeur: (a) => a.utilisateur.slice(0, 8) }, { libelle: 'Du', valeur: (a) => jour(a.debut) },
                { libelle: 'Au', valeur: (a) => (a.fin ? jour(a.fin) : 'en cours') }, { libelle: 'État', valeur: (a) => (a.annulee_le ? <Puce teinte="gris">Annulée</Puce> : <Puce teinte="vert">Valide</Puce>) }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="journal_affectations_sites (affectations de comptes au site)"
            absent="Les modifications de la fiche (nom, adresse, statut) ne sont pas journalisées : le référentiel des sites n'a pas de table de journal (écart D-090, à traiter côté serveur)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un site" /> },
      ]}
    />
  );
};
