import { useEffect, useMemo, useState } from 'react';
import { FileSearch, Printer, Send, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Provenance } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import { montant } from '../Facturation/facturation';
import {
  MODES_REGUL, MODULE_FACTURES_NEEMBA, STATUTS_FACTURE_F, VUE_FACTURES_NEEMBA, actionFactureFInterdite, quantite,
  type ActionFactureF, type ContratLoueur, type FactureF, type LigneF, type RegulF,
} from './facturesNeemba';

// Fiche d'une facture du loueur (D-032, D-033, D-090) : montants facture,
// attendu, reclame et recouvre ; lignes du controle (unite de chaque engin)
// et regularisations ; historique depuis les horodatages enregistres (pas
// de journal dedie aux factures du loueur).

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR') : null);

export const DetailFactureNeemba = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [facture, setFacture] = useState<Lecture<FactureF>>(attente);
  const [lignes, setLignes] = useState<Lecture<LigneF>>(attente);
  const [reguls, setReguls] = useState<Lecture<RegulF>>(attente);
  const [contrat, setContrat] = useState<ContratLoueur | null>(null);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);

  useEffect(() => {
    lire<FactureF>(supabase.from('factures_fournisseur').select('*').eq('id', id), 'facture du loueur').then(async (r) => {
      setFacture(r);
      const f = trouver(r.lignes, id);
      if (!f) return;
      const { data } = await supabase.from('contrats').select('id, reference, contrepartie, devise, nature').eq('id', f.contrat_id);
      setContrat(((data ?? []) as ContratLoueur[]).find((c) => c.id === f.contrat_id) ?? null);
    });
    lire<LigneF>(supabase.from('factures_fournisseur_lignes').select('*').eq('facture_id', id).order('libelle'), 'lignes de la facture')
      .then((r) => setLignes({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.facture_id === id) }));
    lire<RegulF>(supabase.from('regularisations_fournisseur').select('*').eq('facture_id', id).order('date_regularisation'), 'régularisations')
      .then((r) => setReguls({ ...r, lignes: r.lignes && r.lignes.filter((g) => g.facture_id === id) }));
    supabase.from('vehicles').select('id, registration').then(({ data }) => setEngins((data ?? []) as { id: string; registration: string }[]));
  }, [id]);

  const f = trouver(facture.lignes, id);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const recouvre = (reguls.lignes ?? []).reduce((s, x) => s + Number(x.montant), 0);
  const possible = (a: ActionFactureF) => Boolean(f) && actionFactureFInterdite(a, f?.statut ?? 'conforme', peutEcrire) === null;
  const nomLigne = (l: LigneF) => (l.vehicle_id ? immat.get(l.vehicle_id) ?? l.libelle : l.libelle);

  const historique: EvenementHistorique[] | null = f && reguls.lignes ? fusionnerHistoriques(
    [
      ...(f.saisie_le ? [{ id: 'ff-saisie', le: f.saisie_le, libelle: 'Facture saisie', auteur: f.saisie_par ?? null, source: 'factures_fournisseur.saisie_le' }] : []),
      ...(f.controle_le ? [{ id: 'ff-controle', le: f.controle_le, libelle: 'Dernier contrôle', auteur: f.controle_par ?? null, detail: f.ecart_total !== null ? `Écart total ${montant(f.ecart_total, f.devise)}` : null, source: 'factures_fournisseur.controle_le' }] : []),
      ...(f.notifiee_le ? [{ id: 'ff-notification', le: `${f.notifiee_le}T00:00:00`, libelle: 'Écart notifié au loueur (date de notification)', detail: f.reference_notification ? `Réf. ${f.reference_notification}` : null, source: 'factures_fournisseur.notifiee_le' }] : []),
    ],
    reguls.lignes.filter((g) => g.saisi_le).map((g) => ({
      id: `regularisations_fournisseur-${g.id}`, le: g.saisi_le ?? '', libelle: `Régularisation ${MODES_REGUL[g.mode] ?? g.mode}`,
      detail: `${montant(g.montant, f.devise)} au ${jour(g.date_regularisation)}${g.reference ? ` · réf. ${g.reference}` : ''}`, auteur: g.saisi_par ?? null, source: 'regularisations_fournisseur',
    })),
  ) : null;

  return (
    <PageDetail
      vue={VUE_FACTURES_NEEMBA}
      module={MODULE_FACTURES_NEEMBA}
      reference={f ? `Facture ${f.numero_fournisseur}` : 'Facture du loueur'}
      statut={f ? { libelle: STATUTS_FACTURE_F[f.statut]?.l ?? f.statut, teinte: STATUTS_FACTURE_F[f.statut]?.t ?? 'gris' } : null}
      resume={f && <>{contrat ? `${contrat.contrepartie} · ${contrat.reference}` : 'Contrat'} · du {jour(f.periode_debut)} au {jour(f.periode_fin)}</>}
      chargement={facture.lignes === null && !facture.erreur}
      erreur={facture.erreur}
      introuvable={facture.lignes !== null && !f}
      actions={[
        { id: 'controler', libelle: 'Contrôler', icone: <FileSearch className="h-4 w-4" />, visible: possible('controler'), ton: 'principal', vers: routeAction(VUE_FACTURES_NEEMBA, id, 'controler') },
        { id: 'notifier', libelle: 'Notifier l\'écart', icone: <Send className="h-4 w-4" />, visible: possible('notifier'), ton: 'danger', vers: routeAction(VUE_FACTURES_NEEMBA, id, 'notifier') },
        { id: 'regulariser', libelle: 'Régularisation', icone: <Wallet className="h-4 w-4" />, visible: possible('regulariser'), ton: 'principal', vers: routeAction(VUE_FACTURES_NEEMBA, id, 'regulariser') },
        { id: 'notification', libelle: 'Notification', icone: <Printer className="h-4 w-4" />, visible: possible('notification'), vers: routeAction(VUE_FACTURES_NEEMBA, id, 'notification') },
      ]}
      onglets={!f ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <section aria-label="Montants" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Facturé HT', montant(f.montant_ht_facture, f.devise), 'text-stone-900'],
                ['Attendu (lignes contrôlables)', f.montant_attendu === null ? 'Non contrôlé' : montant(f.montant_attendu, f.devise), 'text-stone-900'],
                ['Réclamé', f.montant_reclame === null ? '—' : montant(f.montant_reclame, f.devise), 'text-red-700'],
                ['Recouvré', montant(recouvre, f.devise), 'text-green-700'],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
                  <p className="text-sm text-stone-500">{l}</p>
                  <p className={`text-lg font-black ${c}`}>{v}</p>
                </div>
              ))}
            </section>
            <Informations groupes={[
              { titre: 'Facture', champs: [
                ['N° du loueur', f.numero_fournisseur], ['Date', jour(f.date_facture)],
                ['Contrat', contrat ? <a href={routeDetail('contrats', contrat.id)} className="text-orange-800 hover:underline">{contrat.reference} · {contrat.contrepartie}</a> : null],
                ['Période', `du ${jour(f.periode_debut)} au ${jour(f.periode_fin)}`], ['Devise', f.devise], ['Note', f.note ?? null],
              ] },
              { titre: 'Contrôle et notification', champs: [
                ['Contrôlée le', f.controle_le ? new Date(f.controle_le).toLocaleString('fr-FR') : null],
                ['Écart total', f.ecart_total === null ? null : montant(f.ecart_total, f.devise)],
                ['Notifiée le', jour(f.notifiee_le)], ['Référence de la notification', f.reference_notification],
              ] },
            ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Lignes et régularisations', compte: lignes.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <Relation titre="Lignes du contrôle" lignes={lignes.lignes} erreur={lignes.erreur} cle={(l) => l.id} vide="Aucune ligne"
              lien={(l) => (l.vehicle_id ? routeDetail('vehicles', l.vehicle_id) : routeDetail(VUE_FACTURES_NEEMBA, id, 'relations'))}
              colonnes={[
                { libelle: 'Ligne', valeur: (l) => nomLigne(l) },
                { libelle: 'Catégorie, constat', valeur: (l) => [l.categorie_materiel, l.constat].filter(Boolean).join(' · ') || '—' },
                { libelle: 'Quantité facturée', valeur: (l) => quantite(l.quantite_facturee, l.unite_facturee, l.heures_facturees) },
                { libelle: 'Quantité attendue', valeur: (l) => quantite(l.quantite_attendue, l.unite_attendue) },
                { libelle: 'Arrêt loueur', valeur: (l) => (l.heures_arret_loueur ? `${l.heures_arret_loueur} h` : '—') },
                { libelle: 'Facturé', valeur: (l) => montant(l.montant_facture, f.devise) },
                { libelle: 'Attendu', valeur: (l) => (l.montant_attendu === null ? '—' : montant(l.montant_attendu, f.devise)) },
                { libelle: 'Écart', valeur: (l) => (l.ecart === null ? '—' : <span className={(l.ecart ?? 0) > 0 ? 'font-semibold text-red-700' : ''}>{montant(l.ecart, f.devise)}</span>) },
              ]}
              note={<Provenance source="unité et tarif de chaque engin dans la version du contrat en vigueur à la fin de la période : heures de marche des fiches de pointage signées ou kilomètres relevés des voyages livrés ; immobilisations imputées au loueur" />} />
            <Relation titre="Régularisations" lignes={reguls.lignes} erreur={reguls.erreur} cle={(g) => g.id} vide="Aucune régularisation"
              colonnes={[
                { libelle: 'Date', valeur: (g) => jour(g.date_regularisation) },
                { libelle: 'Mode', valeur: (g) => MODES_REGUL[g.mode] ?? g.mode },
                { libelle: 'Montant', valeur: (g) => montant(g.montant, f.devise) },
                { libelle: 'Référence', valeur: (g) => g.reference ?? 'Non renseignée' },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={reguls.erreur}
            absent="Les factures du loueur n'ont pas de journal dédié : l'historique reprend les horodatages enregistrés (saisie, dernier contrôle, notification, régularisations). Un contrôle relancé remplace le précédent."
            source="factures_fournisseur (saisie_le, controle_le, notifiee_le), regularisations_fournisseur (saisi_le)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une facture du loueur" /> },
      ]}
    />
  );
};
