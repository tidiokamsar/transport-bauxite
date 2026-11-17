import { useEffect, useMemo, useState } from 'react';
import { Archive, Ban, Edit2, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeModifier } from '../ui/routeur';
import { InfractionsChauffeur } from './InfractionsChauffeur';
import { TYPES_HABILITATION, etatHabilitation, type Habilitation } from './habilitations';
import { SANCTIONS, TYPES_INFRACTION, type Infraction, type Sanction } from './infractions';
import { CONTRATS_CHAUFFEUR, STATUTS_CHAUFFEUR, VUE_CHAUFFEURS, actionChauffeurPermise, joursAvant, type Chauffeur } from './chauffeur';

// Fiche d'un chauffeur en pleine page (D-090, remplace DriverModal) :
// informations, relations (voyages, habilitations), infractions et
// sanctions (registre D-066, actions motivees), historique reconstitue des
// evenements horodates en base (habilitations, infractions, sanctions,
// creation du dossier). Les modifications du dossier lui-meme ne sont pas
// journalisees : l'ecart est affiche.

interface Voyage { id: string; reference: string; planned_date: string | null; etat: string | null }

const date = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : '—');
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

export const DetailChauffeur = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const { sites } = useSite();
  const [chauffeur, setChauffeur] = useState<Lecture<Chauffeur>>(attente);
  const [voyages, setVoyages] = useState<Lecture<Voyage>>(attente);
  const [habilitations, setHabilitations] = useState<Lecture<Habilitation>>(attente);
  const [infractions, setInfractions] = useState<Lecture<Infraction>>(attente);
  const [sanctions, setSanctions] = useState<Lecture<Sanction>>(attente);
  const aujourdhui = useMemo(() => new Date(), []);

  useEffect(() => {
    lire<Chauffeur>(supabase.from('drivers').select('*').eq('id', id), 'chauffeur').then(setChauffeur);
    lire<Voyage>(supabase.from('trips').select('id, reference, planned_date, etat').eq('driver_id', id).order('planned_date', { ascending: false }).limit(20), 'voyages').then(setVoyages);
    lire<Habilitation>(supabase.from('habilitations_chauffeur').select('id, driver_id, type, libelle, numero, delivre_le, expire_le, revoque_le, motif_revocation')
      .eq('driver_id', id).order('delivre_le', { ascending: false }), 'habilitations').then(setHabilitations);
    lire<Infraction>(supabase.from('infractions_chauffeur').select('id, numero, driver_id, type, survenue_le, lieu, trip_id, vehicle_id, constat, source, reference_source, statut, motif_annulation, declare_le')
      .eq('driver_id', id), 'infractions').then(async (r) => {
      setInfractions(r);
      const ids = (r.lignes ?? []).filter((i) => i.driver_id === id).map((i) => i.id);
      if (!ids.length) { setSanctions({ lignes: [], erreur: '' }); return; }
      setSanctions(await lire<Sanction>(supabase.from('sanctions_infraction').select('id, infraction_id, sanction, detail, motif, decide_le, statut, motif_annulation').in('infraction_id', ids), 'sanctions'));
    });
  }, [id]);

  const d = trouver(chauffeur.lignes, id);
  const peutModifier = hasPermission('drivers', 'edit');
  const statut = d ? STATUTS_CHAUFFEUR[d.status] ?? { libelle: d.status, teinte: 'gris' as const } : null;
  const siens = <T extends { driver_id: string },>(l: T[] | null) => l && l.filter((x) => x.driver_id === id);

  const historique: EvenementHistorique[] | null = habilitations.lignes && infractions.lignes && sanctions.lignes && fusionnerHistoriques(
    d?.created_at ? [{ id: 'drivers-creation', le: d.created_at, libelle: 'Dossier créé', source: 'drivers' }] : [],
    (siens(habilitations.lignes) ?? []).flatMap((h) => [
      { id: `habilitations_chauffeur-${h.id}`, le: h.delivre_le, libelle: `Habilitation délivrée : ${TYPES_HABILITATION[h.type] ?? h.type}`, detail: [h.libelle, h.numero].filter(Boolean).join(' · ') || null, source: 'habilitations_chauffeur' },
      ...(h.revoque_le ? [{ id: `habilitations_chauffeur-${h.id}-revocation`, le: h.revoque_le, libelle: `Habilitation révoquée : ${TYPES_HABILITATION[h.type] ?? h.type}`, motif: h.motif_revocation, source: 'habilitations_chauffeur' }] : []),
    ]),
    (siens(infractions.lignes) ?? []).map((i) => ({
      id: `infractions_chauffeur-${i.id}`, le: i.declare_le, libelle: `Infraction enregistrée ${i.numero}`,
      detail: `${TYPES_INFRACTION[i.type] ?? i.type} · ${i.constat}${i.statut === 'annulee' ? ' (annulée)' : ''}`, motif: i.motif_annulation, source: 'infractions_chauffeur',
    })),
    sanctions.lignes.map((s) => ({
      id: `sanctions_infraction-${s.id}`, le: s.decide_le, libelle: `Sanction décidée : ${SANCTIONS[s.sanction] ?? s.sanction}`,
      detail: s.statut === 'annulee' ? `Annulée${s.motif_annulation ? ` : ${s.motif_annulation}` : ''}` : s.detail, motif: s.motif, source: 'sanctions_infraction',
    })),
  );
  const erreurHistorique = habilitations.erreur || infractions.erreur || sanctions.erreur;
  const expiration = d ? joursAvant(d.license_expiry, aujourdhui) : 0;

  return (
    <PageDetail
      vue={VUE_CHAUFFEURS}
      module="Chauffeurs"
      reference={d?.name ?? 'Chauffeur'}
      statut={statut}
      resume={d && <>{d.employee_id ? `${d.employee_id} · ` : ''}Permis {d.license_number} (cat. {d.license_category}) · {CONTRATS_CHAUFFEUR[d.contract_type] ?? d.contract_type}</>}
      chargement={chauffeur.lignes === null && !chauffeur.erreur}
      erreur={chauffeur.erreur}
      introuvable={chauffeur.lignes !== null && !d}
      actions={!d ? [] : [
        { id: 'modifier', libelle: 'Modifier', icone: <Edit2 className="h-4 w-4" />, visible: peutModifier, ton: 'principal', vers: routeModifier(VUE_CHAUFFEURS, id) },
        { id: 'suspendre', libelle: 'Suspendre', icone: <Ban className="h-4 w-4" />, visible: peutModifier && actionChauffeurPermise('suspendre', d.status), vers: routeAction(VUE_CHAUFFEURS, id, 'suspendre') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <RotateCcw className="h-4 w-4" />, visible: peutModifier && actionChauffeurPermise('reactiver', d.status), vers: routeAction(VUE_CHAUFFEURS, id, 'reactiver') },
        { id: 'archiver', libelle: 'Archiver le dossier', icone: <Archive className="h-4 w-4" />, visible: peutModifier && actionChauffeurPermise('archiver', d.status), ton: 'danger', vers: routeAction(VUE_CHAUFFEURS, id, 'archiver') },
      ]}
      onglets={!d ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Identité et contact', champs: [['Nom', d.name], ['ID employé', d.employee_id], ['Téléphone', d.phone], ['Email', d.email], ['Date de naissance', d.birth_date ? date(d.birth_date) : null], ['Adresse', d.address]] },
            { titre: 'Permis', champs: [['Numéro', d.license_number], ['Catégorie', d.license_category],
              ['Expiration', <>{date(d.license_expiry)} {expiration < 0 ? <Puce teinte="rouge">Expiré</Puce> : expiration <= 30 ? <Puce teinte="orange">Expire dans {expiration} j</Puce> : <Puce teinte="vert">Valide</Puce>}</>],
              ['Certificat médical', d.health_certificate_expiry ? date(d.health_certificate_expiry) : null]] },
            { titre: 'Contrat', champs: [['Embauche', date(d.hire_date)], ['Type de contrat', CONTRATS_CHAUFFEUR[d.contract_type] ?? d.contract_type],
              ['Salaire de base', d.base_salary === null ? null : `${d.base_salary.toLocaleString('fr-FR')} GNF`],
              ['Site', d.site_id ? sites.find((s) => s.id === d.site_id)?.name ?? 'Site non visible' : 'Global (tous sites)'], ['Statut', statut?.libelle]] },
            { titre: 'Urgence et notes', champs: [['Contact d\'urgence', d.emergency_contact_name], ['Téléphone d\'urgence', d.emergency_contact_phone], ['Notes', d.notes]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Derniers voyages" lignes={voyages.lignes} erreur={voyages.erreur} cle={(v) => v.id} vide="Aucun voyage affecté"
              note="Les 20 plus récents ; l'affectation se décide dans le Dispatch."
              colonnes={[{ libelle: 'Voyage', valeur: (v) => v.reference }, { libelle: 'Date prévue', valeur: (v) => date(v.planned_date) }, { libelle: 'État', valeur: (v) => v.etat ?? '—' }]} />
            <Relation titre="Habilitations" lignes={siens(habilitations.lignes)} erreur={habilitations.erreur} cle={(h) => h.id} vide="Aucune habilitation enregistrée"
              note="Saisie et révocation dans Flotte → Habilitations."
              colonnes={[{ libelle: 'Type', valeur: (h) => TYPES_HABILITATION[h.type] ?? h.type }, { libelle: 'Délivrée le', valeur: (h) => date(h.delivre_le) },
                { libelle: 'Expire le', valeur: (h) => date(h.expire_le) }, { libelle: 'État', valeur: (h) => { const e = etatHabilitation(h, aujourdhui); return <Puce teinte={e.teinte}>{e.texte}</Puce>; } }]} />
          </div>
        ) },
        { id: 'infractions', libelle: 'Infractions', compte: siens(infractions.lignes)?.filter((i) => i.statut === 'enregistree').length ?? null,
          contenu: <section className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte"><InfractionsChauffeur chauffeurId={id} /></section> },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={erreurHistorique ? [] : historique} erreur={erreurHistorique} source="drivers (création), habilitations_chauffeur, infractions_chauffeur, sanctions_infraction"
            absent="Les modifications du dossier (coordonnées, contrat, statut) ne sont pas journalisées : la table drivers n'a pas de journal (écart D-090, à traiter côté serveur)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un chauffeur" /> },
      ]}
    />
  );
};
