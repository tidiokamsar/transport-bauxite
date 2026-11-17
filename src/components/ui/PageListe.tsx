import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns, RefreshCw, Search, Table } from 'lucide-react';
import { exportToCSV } from '../../lib/exports';
import { Panneau, SansDonnees } from './Panneau';
import {
  TAILLES_PAGE, appliquerListe, etatDepuisRequete, lignesExport, paginer, requeteDepuisEtat, triSuivant,
  type ColonneListe, type EtatListe, type FiltreListe,
} from './liste';
import { memoriserRequeteListe, naviguer, routeDetail, useRoute } from './routeur';

// Liste standard d'un module (D-090, bibliotheque D-077 « DataTable ») :
// recherche, filtres, tri, pagination, choix des colonnes, export CSV, etats
// vide, chargement et erreur ; l'etat est porte par l'adresse (lien
// partageable, retour avec filtres conserves). Un clic sur une ligne ouvre
// sa page detail. Aucune ecriture ici : les actions passent par les pages.

export interface ActionGroupee<T> {
  id: string;
  libelle: string;
  /** Recoit les lignes selectionnees ; l'ecriture reste une fonction serveur. */
  executer: (lignes: T[]) => void;
}

export interface PageListeProps<T> {
  vue: string;
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** null = chargement en cours. */
  lignes: T[] | null;
  erreur?: string;
  colonnes: ColonneListe<T>[];
  filtres?: FiltreListe<T>[];
  /** Recherche propre au module ; a defaut, dans toutes les colonnes. */
  recherche?: (ligne: T, texte: string) => boolean;
  placeholderRecherche?: string;
  cle: (ligne: T) => string;
  /** Nom accessible du lien d'ouverture de la ligne (ex. « Fiche CAM-01 »). */
  libelleOuverture: (ligne: T) => string;
  /** Destination du clic ; par defaut la page detail #/<vue>/<cle>. */
  ouvrir?: (ligne: T) => void;
  /** Boutons de l'en-tete (creation...), deja filtres par les droits. */
  actions?: ReactNode;
  actionsGroupees?: ActionGroupee<T>[];
  /** Bloc affiche entre l'en-tete et la liste (synthese chiffree). */
  synthese?: ReactNode;
  nomExport: string;
  vide: { message: string; detail?: string };
  provenance?: ReactNode;
  onActualiser?: () => void;
}

const ETROIT = '(max-width: 639px)';
/** Vrai sous 640 px (telephone) : la liste passe en cartes. */
const useEcranEtroit = () => {
  const [etroit, setEtroit] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(ETROIT).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(ETROIT);
    const suivre = () => setEtroit(m.matches);
    m.addEventListener('change', suivre);
    return () => m.removeEventListener('change', suivre);
  }, []);
  return etroit;
};

const BOUTON_OUTIL = 'flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50 disabled:opacity-50';
const INTERACTIF = 'button, a, input, select, textarea, label, summary';

export const PageListe = <T,>({
  vue, titre, sousTitre, lignes, erreur, colonnes, filtres = [], recherche, placeholderRecherche = 'Rechercher', cle,
  libelleOuverture, ouvrir, actions, actionsGroupees, synthese, nomExport, vide, provenance, onActualiser,
}: PageListeProps<T>) => {
  const route = useRoute();
  const etat = etatDepuisRequete(route.vue === vue && route.mode === 'liste' ? route.requete : {});
  const [masquees, setMasquees] = useState<Set<string>>(() => new Set(colonnes.filter((c) => c.masquee).map((c) => c.id)));
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const etroit = useEcranEtroit();

  const changer = (modif: Partial<EtatListe>, garderPage = false) => {
    const suivant = { ...etat, ...modif, page: garderPage ? modif.page ?? etat.page : 1 };
    const requete = requeteDepuisEtat(suivant);
    memoriserRequeteListe(vue, requete);
    naviguer({ vue, mode: 'liste', requete }, { remplacer: true });
  };

  const visibles = colonnes.filter((c) => !masquees.has(c.id));
  const resultat = useMemo(
    () => (lignes ? appliquerListe(lignes, etat, { colonnes, filtres, recherche }) : []),
    // etat est recalcule a chaque rendu depuis l'adresse : dependances sur ses valeurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lignes, colonnes, filtres, recherche, etat.recherche, JSON.stringify(etat.filtres), etat.tri, etat.sens],
  );
  const page = paginer(resultat, etat.page, etat.taille);
  const selectionnees = (lignes ?? []).filter((l) => selection.has(cle(l)));
  const filtresActifs = Boolean(etat.recherche.trim()) || Object.values(etat.filtres).some(Boolean);

  const ouvrirLigne = (l: T) => {
    memoriserRequeteListe(vue, requeteDepuisEtat(etat));
    if (ouvrir) ouvrir(l); else naviguer(routeDetail(vue, cle(l)));
  };
  const clicLigne = (e: MouseEvent<HTMLTableRowElement>, l: T) => {
    if ((e.target as HTMLElement).closest(INTERACTIF)) return;
    ouvrirLigne(l);
  };
  const basculer = (id: string) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tousCoches = page.lignes.length > 0 && page.lignes.every((l) => selection.has(cle(l)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900">{titre}</h1>
          {sousTitre && <p className="text-stone-500">{sousTitre}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportToCSV(lignesExport(resultat, visibles), nomExport)} disabled={!resultat.length} className={BOUTON_OUTIL}>
            <Table className="h-4 w-4" /> Exporter CSV
          </button>
          {onActualiser && <button type="button" onClick={onActualiser} className={BOUTON_OUTIL}><RefreshCw className="h-4 w-4" /> Actualiser</button>}
          {actions}
        </div>
      </div>

      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {synthese}

      <Panneau titre={lignes ? `${resultat.length} résultat${resultat.length > 1 ? 's' : ''}${filtresActifs ? ` sur ${lignes.length}` : ''}` : undefined}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search" value={etat.recherche} onChange={(e) => changer({ recherche: e.target.value })}
              placeholder={placeholderRecherche} aria-label="Rechercher"
              className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {filtres.map((f) => (
            <select key={f.id} value={etat.filtres[f.id] ?? ''} aria-label={`Filtrer : ${f.libelle}`}
              onChange={(e) => changer({ filtres: { ...etat.filtres, [f.id]: e.target.value } })}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm sm:w-auto">
              <option value="">{f.libelle} : tous</option>
              {f.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
            </select>
          ))}
          {filtresActifs && <button type="button" onClick={() => changer({ recherche: '', filtres: {} })} className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Effacer les filtres</button>}
          <details className="relative">
            <summary className={`${BOUTON_OUTIL} cursor-pointer list-none`}><Columns className="h-4 w-4" /> Colonnes</summary>
            <fieldset className="absolute right-0 z-20 mt-1 w-56 space-y-1 rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-lg">
              <legend className="sr-only">Colonnes affichées</legend>
              {colonnes.map((c, i) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={!masquees.has(c.id)} disabled={i === 0}
                    onChange={() => setMasquees((m) => { const n = new Set(m); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                  {c.libelle}
                </label>
              ))}
            </fieldset>
          </details>
        </div>

        {actionsGroupees && actionsGroupees.length > 0 && selectionnees.length > 0 && (
          <div role="toolbar" aria-label="Actions groupées" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-orange-50 p-2 text-sm">
            <span className="font-semibold text-orange-900">{selectionnees.length} sélectionné{selectionnees.length > 1 ? 's' : ''}</span>
            {actionsGroupees.map((a) => <button key={a.id} type="button" onClick={() => a.executer(selectionnees)} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 font-semibold text-orange-800">{a.libelle}</button>)}
            <button type="button" onClick={() => setSelection(new Set())} className="rounded-lg px-3 py-1.5 text-stone-600 hover:bg-white">Désélectionner</button>
          </div>
        )}

        {lignes === null ? (
          erreur ? <SansDonnees message="Liste indisponible" detail="La lecture a été refusée ou a échoué : voir le message ci-dessus." />
            : <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
        ) : resultat.length === 0 ? (
          <SansDonnees message={filtresActifs ? 'Aucun résultat' : vide.message} detail={filtresActifs ? 'Aucune ligne ne correspond à la recherche ou aux filtres.' : vide.detail} />
        ) : etroit ? (
          // Telephone : une carte par ligne (libelle : valeur), le tableau a partir de 640 px.
          <ul className="space-y-2" aria-label="Lignes">
            {page.lignes.map((l) => {
              const id = cle(l);
              const [premiere, ...autres] = visibles;
              return (
                <li key={id} className="rounded-xl border border-stone-200 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    {actionsGroupees && actionsGroupees.length > 0 && (
                      <input type="checkbox" className="mt-1 h-5 w-5" aria-label={`Sélectionner ${libelleOuverture(l)}`} checked={selection.has(id)} onChange={() => basculer(id)} />
                    )}
                    <button type="button" onClick={() => ouvrirLigne(l)} aria-label={libelleOuverture(l)} className="min-w-0 flex-1 break-words text-left font-semibold text-orange-800 hover:underline">
                      {premiere ? (premiere.rendu ? premiere.rendu(l) : (premiere.valeur(l) ?? '—')) : libelleOuverture(l)}
                    </button>
                  </div>
                  {autres.length > 0 && (
                    <dl className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1">
                      {autres.map((c) => (
                        <div key={c.id} className="contents">
                          <dt className="text-stone-500">{c.libelle}</dt>
                          <dd className="min-w-0 break-words text-stone-900">{c.rendu ? c.rendu(l) : (c.valeur(l) ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  {actionsGroupees && actionsGroupees.length > 0 && (
                    <th className="w-8 py-2 pr-2"><input type="checkbox" aria-label="Tout sélectionner sur la page" checked={tousCoches}
                      onChange={() => setSelection((s) => { const n = new Set(s); page.lignes.forEach((l) => { if (tousCoches) n.delete(cle(l)); else n.add(cle(l)); }); return n; })} /></th>
                  )}
                  {visibles.map((c) => {
                    const actif = etat.tri === c.id;
                    return (
                      <th key={c.id} className={`py-2 pr-3 font-medium ${c.alignement === 'droite' ? 'text-right' : ''}`}
                        aria-sort={actif ? (etat.sens === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {c.triable === false ? c.libelle : (
                          <button type="button" onClick={() => changer(triSuivant(etat, c.id))} className="inline-flex items-center gap-1 hover:text-stone-900">
                            {c.libelle}
                            {actif ? (etat.sens === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {page.lignes.map((l) => {
                  const id = cle(l);
                  return (
                    <tr key={id} onClick={(e) => clicLigne(e, l)} className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-orange-50/40">
                      {actionsGroupees && actionsGroupees.length > 0 && (
                        <td className="py-2 pr-2"><input type="checkbox" aria-label={`Sélectionner ${libelleOuverture(l)}`} checked={selection.has(id)} onChange={() => basculer(id)} /></td>
                      )}
                      {visibles.map((c, i) => {
                        const contenu = c.rendu ? c.rendu(l) : (c.valeur(l) ?? '—');
                        return (
                          <td key={c.id} className={`py-2 pr-3 ${c.alignement === 'droite' ? 'text-right' : ''}`}>
                            {i === 0 ? (
                              <button type="button" onClick={() => ouvrirLigne(l)} aria-label={libelleOuverture(l)} className="text-left font-semibold text-orange-800 hover:underline">
                                {contenu}
                              </button>
                            ) : contenu}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {lignes && resultat.length > 0 && (
          <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
            <span>{page.debut} à {page.fin} sur {resultat.length}</span>
            <div className="flex flex-wrap items-center gap-2">
              <select value={etat.taille} aria-label="Lignes par page" onChange={(e) => changer({ taille: Number(e.target.value) })} className="rounded-lg border border-stone-300 px-2 py-1">
                {TAILLES_PAGE.map((t) => <option key={t} value={t}>{t} par page</option>)}
              </select>
              <button type="button" disabled={page.page <= 1} onClick={() => changer({ page: page.page - 1 }, true)} className="rounded-lg border border-stone-300 px-3 py-1 disabled:opacity-40">Précédente</button>
              <span>Page {page.page} / {page.pages}</span>
              <button type="button" disabled={page.page >= page.pages} onClick={() => changer({ page: page.page + 1 }, true)} className="rounded-lg border border-stone-300 px-3 py-1 disabled:opacity-40">Suivante</button>
            </div>
          </nav>
        )}
        {provenance}
      </Panneau>
    </div>
  );
};
