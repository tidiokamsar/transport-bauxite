import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Table } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { FilAriane } from '../ui/PageDetail';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { appliquerListe, lignesExport, paginer, type ColonneListe, type FiltreListe } from '../ui/liste';
import { arianeModule } from '../ui/pages';
import { naviguer, useRoute } from '../ui/routeur';
import { STATUTS_CONSULTATION } from './fournisseurs';
import { COLONNES_CONSULTATION, LIENS_RUBRIQUES, type Consultation } from './donnees';
import { MODULE_FOURNISSEURS, VUE_FOURNISSEURS, routeConsultation, routeConsultations, routeNouvelleConsultation, routeReferentiels } from './routes';

// Liste des consultations de prix (D-059, D-090). La vue du menu est
// celle des fournisseurs : la liste vit a l'adresse #/suppliers/consultations
// et garde recherche, statut et page dans sa requete (?q=, ?statut=, ?page=).

const TAILLE = 25;

export const ListeConsultations = () => {
  const route = useRoute();
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [lignes, setLignes] = useState<Consultation[] | null>(null);
  const [depots, setDepots] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const q = route.requete.q ?? '';
  const statut = route.requete.statut ?? '';
  const pageDemandee = Number(route.requete.page) || 1;

  const charger = useCallback(async () => {
    const [c, d] = await Promise.all([
      supabase.from('consultations_fournisseurs').select(COLONNES_CONSULTATION).order('cree_le', { ascending: false }),
      supabase.from('warehouses').select('id, name, code').order('name'),
    ]);
    setHeure(new Date());
    setErreur(c.error ? `Consultations indisponibles : ${c.error.message}` : '');
    setLignes(c.error ? null : ((c.data ?? []) as Consultation[]));
    setDepots(new Map(((d.data ?? []) as { id: string; name: string; code: string }[]).map((x) => [x.id, `${x.name} (${x.code})`])));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const changer = (modif: Record<string, string>) => naviguer(routeConsultations({ q, statut, ...modif }), { remplacer: true });

  const colonnes = useMemo<ColonneListe<Consultation>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (c) => c.numero },
    { id: 'objet', libelle: 'Objet', valeur: (c) => c.objet },
    { id: 'depot', libelle: 'Dépôt de livraison', valeur: (c) => (c.warehouse_id ? depots.get(c.warehouse_id) ?? null : 'À préciser') },
    { id: 'limite', libelle: 'Date limite', valeur: (c) => c.date_limite },
    { id: 'creee', libelle: 'Créée le', valeur: (c) => c.cree_le.slice(0, 10) },
    { id: 'statut', libelle: 'Statut', valeur: (c) => STATUTS_CONSULTATION[c.statut]?.texte ?? c.statut },
  ], [depots]);
  const filtres = useMemo<FiltreListe<Consultation>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_CONSULTATION).map(([valeur, s]) => ({ valeur, libelle: s.texte })), correspond: (c, v) => c.statut === v },
  ], []);
  const resultat = useMemo(() => (lignes ? appliquerListe(lignes, { recherche: q, filtres: { statut }, tri: null, sens: 'asc' }, { colonnes, filtres }) : []), [lignes, q, statut, colonnes, filtres]);
  const page = paginer(resultat, pageDemandee, TAILLE);

  return (
    <div className="space-y-5">
      <FilAriane elements={arianeModule(VUE_FOURNISSEURS, MODULE_FOURNISSEURS, { libelle: 'Consultations' })} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Consultations de prix</h1>
          <p className="text-stone-500">Demandes de cotation, offres, comparaison et sélection motivée qui prépare le bon de commande</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportToCSV(lignesExport(resultat, colonnes), 'consultations-fournisseurs')} disabled={!resultat.length} className={LIENS_RUBRIQUES}>
            <Table className="h-4 w-4" /> Exporter CSV
          </button>
          <button type="button" onClick={charger} className={LIENS_RUBRIQUES}><RefreshCw className="h-4 w-4" /> Actualiser</button>
          <a href={routeReferentiels()} className={LIENS_RUBRIQUES}>Référentiels</a>
          {peutEcrire && (
            <a href={routeNouvelleConsultation()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Nouvelle consultation
            </a>
          )}
        </div>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <Panneau titre={lignes ? `${resultat.length} consultation${resultat.length > 1 ? 's' : ''}${q || statut ? ` sur ${lignes.length}` : ''}` : undefined}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input type="search" value={q} onChange={(e) => changer({ q: e.target.value, page: '' })} placeholder="Numéro, objet" aria-label="Rechercher"
              className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <select value={statut} aria-label="Filtrer : Statut" onChange={(e) => changer({ statut: e.target.value, page: '' })} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="">Statut : tous</option>
            {Object.entries(STATUTS_CONSULTATION).map(([k, s]) => <option key={k} value={k}>{s.texte}</option>)}
          </select>
        </div>
        {lignes === null && !erreur ? <p role="status" className="py-6 text-center text-sm text-stone-500">Chargement…</p>
          : resultat.length === 0 ? <SansDonnees message={q || statut ? 'Aucune consultation ne correspond' : 'Aucune consultation'} detail={q || statut ? undefined : 'Une consultation demande une cotation à plusieurs fournisseurs actifs.'} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-stone-500">{colonnes.map((c) => <th key={c.id} className="py-2 pr-3 font-medium">{c.libelle}</th>)}</tr></thead>
                  <tbody>{page.lignes.map((c) => (
                    <tr key={c.id} className="border-b border-stone-100">
                      <td className="py-2 pr-3"><a href={routeConsultation(c.id)} aria-label={`Fiche ${c.numero}`} className="font-semibold text-orange-800 hover:underline">{c.numero}</a></td>
                      <td className="py-2 pr-3">{c.objet}</td>
                      <td className="py-2 pr-3">{c.warehouse_id ? depots.get(c.warehouse_id) ?? 'Dépôt non visible' : 'À préciser'}</td>
                      <td className="py-2 pr-3">{c.date_limite ?? <span className="text-stone-400">Non renseignée</span>}</td>
                      <td className="py-2 pr-3">{new Date(c.cree_le).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-3"><Puce teinte={STATUTS_CONSULTATION[c.statut]?.teinte ?? 'gris'}>{STATUTS_CONSULTATION[c.statut]?.texte ?? c.statut}</Puce></td>
                    </tr>
                  ))}</tbody>
                </table>
                {page.pages > 1 && (
                  <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                    <button type="button" disabled={page.page <= 1} onClick={() => changer({ page: String(page.page - 1) })} className="rounded border border-stone-300 px-2 py-1 disabled:opacity-50">Précédente</button>
                    <span>Page {page.page} / {page.pages}</span>
                    <button type="button" disabled={page.page >= page.pages} onClick={() => changer({ page: String(page.page + 1) })} className="rounded border border-stone-300 px-2 py-1 disabled:opacity-50">Suivante</button>
                  </div>
                )}
              </div>
            )}
        <Provenance source="consultations_fournisseurs" heure={heure} />
      </Panneau>
    </div>
  );
};
