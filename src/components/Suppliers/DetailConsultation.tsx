import { useEffect, useMemo, useState } from 'react';
import { Ban, FileText, Inbox, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeDetail } from '../ui/routeur';
import { STATUTS_CONSULTATION, STATUTS_OFFRE, comparerOffres, type Fournisseur } from './fournisseurs';
import {
  COLONNES_CONSULTATION, EVENEMENTS_CONSULTATION, GNF, lignesDe,
  type Consultation, type Invite, type JournalConsultation, type LigneConsultation, type Offre, type PrixOffre,
} from './donnees';
import {
  MODULE_FOURNISSEURS, VUE_FOURNISSEURS, actionConsultationInterdite, idRouteConsultation, routeActionConsultation, routeConsultations,
  type ActionConsultation,
} from './routes';

// Fiche d'une consultation de prix (D-059, D-090) : objet et lignes,
// comparaison des offres (le systeme compare, l'acheteur decide et
// motive), fournisseurs consultes, bon de commande prepare, historique
// (consultations_journal). Actions selon le droit et le statut.

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const LIEN_LIGNE = 'rounded border border-stone-300 px-2 py-1 text-xs font-semibold';

export const DetailConsultation = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [consultation, setConsultation] = useState<Lecture<Consultation>>(attente);
  const [lignes, setLignes] = useState<Lecture<LigneConsultation>>(attente);
  const [invites, setInvites] = useState<Lecture<Invite>>(attente);
  const [offres, setOffres] = useState<Lecture<Offre>>(attente);
  const [prix, setPrix] = useState<PrixOffre[]>([]);
  const [journal, setJournal] = useState<Lecture<JournalConsultation>>(attente);
  const [fournisseurs, setFournisseurs] = useState<Pick<Fournisseur, 'id' | 'company_name' | 'active'>[]>([]);
  const [depot, setDepot] = useState<string | null>(null);
  const [bon, setBon] = useState<string | null>(null);

  useEffect(() => {
    lire<Consultation>(supabase.from('consultations_fournisseurs').select(COLONNES_CONSULTATION).eq('id', id), 'consultation').then(async (r) => {
      setConsultation(r);
      const c = trouver(r.lignes, id);
      if (!c) return;
      const [d, b] = await Promise.all([
        c.warehouse_id ? supabase.from('warehouses').select('id, name, code').eq('id', c.warehouse_id) : Promise.resolve({ data: [] }),
        c.purchase_order_id ? supabase.from('purchase_orders').select('id, po_number').eq('id', c.purchase_order_id) : Promise.resolve({ data: [] }),
      ]);
      const w = ((d.data ?? []) as { id: string; name: string; code: string }[]).find((x) => x.id === c.warehouse_id);
      setDepot(w ? `${w.name} (${w.code})` : null);
      setBon(((b.data ?? []) as { id: string; po_number: string }[]).find((x) => x.id === c.purchase_order_id)?.po_number ?? null);
    });
    lire<LigneConsultation>(supabase.from('consultations_lignes').select('id, consultation_id, ordre, stock_item_id, designation, quantite').eq('consultation_id', id).order('ordre'), 'lignes')
      .then((r) => setLignes({ ...r, lignes: lignesDe(r.lignes, 'consultation_id', id) }));
    lire<Invite>(supabase.from('consultations_invites').select('consultation_id, supplier_id').eq('consultation_id', id), 'fournisseurs consultés')
      .then((r) => setInvites({ ...r, lignes: lignesDe(r.lignes, 'consultation_id', id) }));
    lire<Offre>(supabase.from('offres_fournisseurs').select('id, consultation_id, supplier_id, reference_offre, recue_le, delai_livraison_jours, validite_jusqu_au, conditions, montant_total, lignes_chiffrees, statut, motif_retrait').eq('consultation_id', id).order('saisi_le'), 'offres')
      .then(async (r) => {
        const os = lignesDe(r.lignes, 'consultation_id', id);
        setOffres({ ...r, lignes: os });
        if (os && os.length) {
          const p = await supabase.from('offres_lignes').select('id, offre_id, consultation_ligne_id, prix_unitaire').in('offre_id', os.map((o) => o.id));
          setPrix(((p.data ?? []) as PrixOffre[]).filter((x) => os.some((o) => o.id === x.offre_id)));
        }
      });
    lire<JournalConsultation>(supabase.from('consultations_journal').select('id, consultation_id, evenement, motif, par, le').eq('consultation_id', id).order('le'), 'journal de la consultation')
      .then((r) => setJournal({ ...r, lignes: lignesDe(r.lignes, 'consultation_id', id) }));
    supabase.from('suppliers').select('id, company_name, active').order('company_name')
      .then(({ data }) => setFournisseurs((data ?? []) as Pick<Fournisseur, 'id' | 'company_name' | 'active'>[]));
  }, [id]);

  const c = trouver(consultation.lignes, id);
  const nom = useMemo(() => new Map(fournisseurs.map((f) => [f.id, f.company_name])), [fournisseurs]);
  const nomDe = (s: string) => nom.get(s) ?? 'Fournisseur non visible';
  const lesOffres = offres.lignes ?? [];
  const actives = lesOffres.filter((o) => o.statut !== 'retiree');
  const lesInvites = invites.lignes ?? [];
  const sansOffre = lesInvites.filter((i) => !lesOffres.some((o) => o.supplier_id === i.supplier_id && o.statut !== 'retiree'));
  const nonConsultes = fournisseurs.filter((f) => f.active !== false && !lesInvites.some((i) => i.supplier_id === f.id));
  const possible = (a: ActionConsultation) => Boolean(c) && actionConsultationInterdite(a, c ?? { statut: 'annulee', purchase_order_id: null }, peutEcrire) === null;

  const comparaison = lignes.lignes && c ? comparerOffres(
    lignes.lignes.map((l) => ({ id: l.id, designation: l.designation, quantite: l.quantite })),
    lesOffres.map((o) => ({
      id: o.id, fournisseur: nomDe(o.supplier_id), delai: o.delai_livraison_jours, statut: o.statut, recueLe: o.recue_le,
      prix: Object.fromEntries(prix.filter((p) => p.offre_id === o.id).map((p) => [p.consultation_ligne_id, p.prix_unitaire])),
    })),
    c.date_limite,
  ) : null;

  const historique = journal.lignes ? fusionnerHistoriques(journal.lignes.map((j) => ({
    id: `consultations_journal-${j.id}`, le: j.le, libelle: EVENEMENTS_CONSULTATION[j.evenement] ?? j.evenement, motif: j.motif, auteur: j.par, source: 'consultations_journal',
  }))) : null;

  const statut = c ? STATUTS_CONSULTATION[c.statut] : null;
  return (
    <PageDetail
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      reference={c ? `Consultation ${c.numero}` : 'Consultation'}
      statut={statut ? { libelle: statut.texte, teinte: statut.teinte } : null}
      resume={c && <>{c.objet} · <a href={routeConsultations()} className="underline">toutes les consultations</a></>}
      chargement={consultation.lignes === null && !consultation.erreur}
      erreur={consultation.erreur}
      introuvable={consultation.lignes !== null && !c}
      actions={[
        { id: 'offre', libelle: 'Saisir une offre reçue', icone: <Inbox className="h-4 w-4" />, visible: possible('offre') && sansOffre.length > 0, ton: 'principal', vers: routeActionConsultation(id, 'offre') },
        { id: 'inviter', libelle: 'Consulter un autre fournisseur', icone: <UserPlus className="h-4 w-4" />, visible: possible('inviter') && nonConsultes.length > 0, vers: routeActionConsultation(id, 'inviter') },
        { id: 'preparer-bon', libelle: 'Préparer le bon de commande', icone: <FileText className="h-4 w-4" />, visible: possible('preparer-bon'), ton: 'principal', vers: routeActionConsultation(id, 'preparer-bon') },
        { id: 'annuler', libelle: 'Annuler la consultation', icone: <Ban className="h-4 w-4" />, visible: possible('annuler'), ton: 'danger', vers: routeActionConsultation(id, 'annuler') },
      ]}
      onglets={!c ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <Informations groupes={[
              { titre: 'Consultation', champs: [['Numéro', c.numero], ['Objet', c.objet], ['Dépôt de livraison', c.warehouse_id ? depot ?? 'Dépôt non visible' : 'À préciser'],
                ['Date limite de réponse', c.date_limite], ['Créée le', new Date(c.cree_le).toLocaleString('fr-FR')], ['Note', c.note]] },
              { titre: 'Décision', champs: [['Statut', statut?.texte], ['Motif de la sélection', c.motif_selection], ['Motif de l\'annulation', c.motif_annulation],
                ['Bon de commande', c.purchase_order_id ? <a href={routeDetail('purchases', c.purchase_order_id)} className="font-semibold text-orange-800 hover:underline">{bon ?? 'Bon préparé'}</a> : null]] },
            ]} />
            <Relation titre="Lignes demandées" lignes={lignes.lignes} erreur={lignes.erreur} cle={(l) => l.id} vide="Aucune ligne"
              colonnes={[
                { libelle: 'Désignation', valeur: (l) => l.designation },
                { libelle: 'Quantité', valeur: (l) => l.quantite },
                { libelle: 'Article du magasin', valeur: (l) => (l.stock_item_id ? 'Oui' : 'Hors stock') },
              ]} />
          </div>
        ) },
        { id: 'offres', libelle: 'Offres et comparaison', compte: actives.length, contenu: (
          <section aria-label="Offres" className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
            <h2 className="font-bold text-stone-900">Comparaison des offres</h2>
            {offres.erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{offres.erreur}</p>
              : !comparaison || actives.length === 0 ? <SansDonnees message="Aucune offre reçue" />
                : (
                  <div className="overflow-x-auto">
                    <table aria-label="Comparaison des offres" className="w-full text-sm">
                      <thead><tr className="border-b text-left text-stone-500">
                        <th className="py-2 pr-3">Ligne</th><th className="py-2 pr-3">Quantité</th>
                        {actives.map((o) => <th key={o.id} className="py-2 pr-3">{nomDe(o.supplier_id)}{o.reference_offre && <span className="block text-xs font-normal">{o.reference_offre}</span>}</th>)}
                      </tr></thead>
                      <tbody>
                        {(lignes.lignes ?? []).map((l) => (
                          <tr key={l.id} className="border-b border-stone-100"><td className="py-2 pr-3">{l.designation}</td><td className="py-2 pr-3">{l.quantite}</td>
                            {actives.map((o) => {
                              const p = prix.find((x) => x.offre_id === o.id && x.consultation_ligne_id === l.id);
                              const meilleur = comparaison.meilleurPrixParLigne[l.id]?.includes(o.id);
                              return <td key={o.id} className={`py-2 pr-3 ${meilleur ? 'font-bold text-green-800' : ''}`}>{p ? `${GNF.format(p.prix_unitaire)} GNF` : <span className="text-stone-400">Non chiffré</span>}</td>;
                            })}
                          </tr>
                        ))}
                        {([['Montant', (r) => `${GNF.format(r.total)} GNF`], ['Lignes chiffrées', (r) => `${r.lignesChiffrees} / ${(lignes.lignes ?? []).length}`],
                          ['Rang', (r) => (r.rang === null ? 'Non classée (incomplète)' : `${r.rang}${r.ecartPourcent ? ` (+${r.ecartPourcent} %)` : ''}`)]] as [string, (r: ReturnType<typeof comparerOffres>['offres'][number]) => string][])
                          .map(([titre, fn]) => (
                            <tr key={titre} className="border-b border-stone-100 bg-stone-50"><td className="py-2 pr-3 font-semibold" colSpan={2}>{titre}</td>
                              {actives.map((o) => { const r = comparaison.offres.find((x) => x.id === o.id); return <td key={o.id} className="py-2 pr-3">{r ? fn(r) : ''}</td>; })}</tr>
                          ))}
                        <tr className="border-b border-stone-100 bg-stone-50"><td className="py-2 pr-3 font-semibold" colSpan={2}>Délai, réception</td>
                          {actives.map((o) => {
                            const r = comparaison.offres.find((x) => x.id === o.id);
                            return <td key={o.id} className="py-2 pr-3">{o.delai_livraison_jours} j{r?.plusRapide && ' (le plus court)'}<span className="block text-xs text-stone-500">reçue le {o.recue_le}{r?.horsDelai && ', après la date limite'}</span>
                              {o.conditions && <span className="block text-xs text-stone-500">{o.conditions}</span>}</td>;
                          })}</tr>
                        <tr><td className="py-2 pr-3" colSpan={2} />
                          {actives.map((o) => (
                            <td key={o.id} className="py-2 pr-3"><Puce teinte={STATUTS_OFFRE[o.statut].teinte}>{STATUTS_OFFRE[o.statut].texte}</Puce>
                              {possible('retenir') && o.statut === 'recue' && (
                                <span className="mt-1 flex gap-1">
                                  <a href={routeActionConsultation(id, 'retenir', { offre: o.id })} aria-label={`Retenir l'offre de ${nomDe(o.supplier_id)}`} className="rounded bg-green-700 px-2 py-1 text-xs font-bold text-white">Retenir</a>
                                  <a href={routeActionConsultation(id, 'retirer-offre', { offre: o.id })} aria-label={`Retirer l'offre de ${nomDe(o.supplier_id)}`} className={LIEN_LIGNE}>Retirer</a>
                                </span>
                              )}
                            </td>
                          ))}</tr>
                      </tbody>
                    </table>
                    <p className="mt-1 text-xs text-stone-500">Classement sur les offres complètes, par montant puis délai ; en gras, le meilleur prix de chaque ligne. Le système compare, l'acheteur décide et motive.</p>
                  </div>
                )}
            {lesOffres.some((o) => o.statut === 'retiree') && (
              <p className="text-xs text-stone-500">Offres retirées : {lesOffres.filter((o) => o.statut === 'retiree').map((o) => `${nomDe(o.supplier_id)} (${o.motif_retrait})`).join(' ; ')}</p>
            )}
          </section>
        ) },
        { id: 'relations', libelle: 'Fournisseurs consultés', compte: invites.lignes?.length ?? null, contenu: (
          <Relation titre="Fournisseurs consultés" lignes={invites.lignes} erreur={invites.erreur} cle={(i) => i.supplier_id} vide="Aucun fournisseur consulté"
            lien={(i) => routeDetail(VUE_FOURNISSEURS, i.supplier_id)}
            colonnes={[
              { libelle: 'Fournisseur', valeur: (i) => nomDe(i.supplier_id) },
              { libelle: 'Offre', valeur: (i) => {
                const o = lesOffres.filter((x) => x.supplier_id === i.supplier_id).find((x) => x.statut !== 'retiree');
                return o ? <Puce teinte={STATUTS_OFFRE[o.statut].teinte}>{STATUTS_OFFRE[o.statut].texte}</Puce> : <span className="text-stone-400">Sans offre</span>;
              } },
            ]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={historique} erreur={journal.erreur} source="consultations_journal (création, invitations, offres, sélection, bon de commande, annulation)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={idRouteConsultation(id)} peutDeposer={false} libelleObjet="une consultation de fournisseurs" /> },
      ]}
    />
  );
};
