import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { ObjetPiece } from '../../lib/piecesJointes';
import { ListePieces } from './PiecesJointes';
import { Puce, SansDonnees, type TeintePuce } from './Panneau';
import { effacerAnnonce, lireAnnonce, naviguer, routeListe, useRoute } from './routeur';
import { arianeModule, type ElementAriane } from './pages';

// Page detail standard (D-090, remplace la fiche en fenetre modale) :
// fil d'Ariane, en-tete avec reference, statut et actions autorisees (droits
// et etat calcules par le module), onglets Informations, Relations,
// Historique et Pieces jointes. L'onglet ouvert est dans l'adresse.

export const FilAriane = ({ elements }: { elements: ElementAriane[] }) => (
  <nav aria-label="Fil d'Ariane" className="text-sm text-stone-500">
    <ol className="flex flex-wrap items-center gap-1">
      {elements.map((e, i) => (
        <li key={`${e.libelle}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          {e.vers ? <a href={e.vers} className="hover:text-stone-900 hover:underline">{e.libelle}</a>
            : <span aria-current="page" className="font-semibold text-stone-800">{e.libelle}</span>}
        </li>
      ))}
    </ol>
  </nav>
);

export interface ActionPage {
  id: string;
  libelle: string;
  icone?: ReactNode;
  /** Calcule par le module : droit (hasPermission) et etat de l'objet. */
  visible: boolean;
  ton?: 'principal' | 'secondaire' | 'danger';
  /** Route ouverte par l'action (page de formulaire ou d'action). */
  vers: string;
}

export interface OngletPage {
  id: string;
  libelle: string;
  compte?: number | null;
  contenu: ReactNode;
}

const TONS = {
  principal: 'bg-gradient-to-r from-orange-500 to-orange-700 text-white shadow',
  secondaire: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
} as const;

export const PageDetail = ({
  vue, module, reference, titre, statut, resume, actions = [], onglets, chargement, erreur, introuvable,
}: {
  vue: string;
  /** Libelle du module dans le fil d'Ariane. */
  module: string;
  reference: string;
  titre?: ReactNode;
  statut?: { libelle: string; teinte: TeintePuce } | null;
  resume?: ReactNode;
  actions?: ActionPage[];
  onglets: OngletPage[];
  chargement: boolean;
  erreur?: string;
  introuvable?: boolean;
}) => {
  const route = useRoute();
  const [annonce] = useState(lireAnnonce);
  useEffect(() => { effacerAnnonce(); }, []);
  const actif = onglets.find((o) => o.id === route.requete.onglet) ?? onglets[0];
  const choisir = (id: string) => naviguer({ vue, mode: 'detail', id: route.id ?? '', requete: id === onglets[0]?.id ? {} : { onglet: id } }, { remplacer: true });

  const retour = (
    <button type="button" onClick={() => naviguer(routeListe(vue))} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900">
      <ArrowLeft className="h-4 w-4" /> Retour à la liste
    </button>
  );

  if (chargement || erreur || introuvable) {
    return (
      <div className="space-y-4">
        <FilAriane elements={arianeModule(vue, module, { libelle: reference })} />
        {retour}
        {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
          : introuvable ? <SansDonnees message="Fiche introuvable" detail="Cet élément n'existe pas ou n'est pas visible avec vos droits (périmètre de site)." />
            : <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const visibles = actions.filter((a) => a.visible);
  return (
    <article aria-label={`Fiche ${reference}`} className="space-y-5">
      <FilAriane elements={arianeModule(vue, module, { libelle: reference })} />
      {retour}
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-carte sm:p-5">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 break-words text-xl font-black text-stone-900 sm:text-2xl">
            {titre ?? reference}
            {statut && <Puce teinte={statut.teinte}>{statut.libelle}</Puce>}
          </h1>
          {resume && <div className="mt-1 text-sm text-stone-500">{resume}</div>}
        </div>
        {visibles.length > 0 && (
          <div role="group" aria-label="Actions" className="flex flex-wrap gap-2">
            {visibles.map((a) => (
              <a key={a.id} href={a.vers} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${TONS[a.ton ?? 'secondaire']}`}>
                {a.icone}{a.libelle}
              </a>
            ))}
          </div>
        )}
      </header>
      {annonce && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{annonce}</p>}

      <div role="tablist" aria-label="Sections de la fiche" className="-mx-4 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {onglets.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={o.id === actif?.id} aria-controls={`onglet-${o.id}`} id={`tab-${o.id}`}
            onClick={() => choisir(o.id)}
            className={`-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${o.id === actif?.id ? 'border-orange-600 text-orange-800' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
            {o.libelle}{o.compte != null && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-xs text-stone-600">{o.compte}</span>}
          </button>
        ))}
      </div>
      {actif && <div role="tabpanel" id={`onglet-${actif.id}`} aria-labelledby={`tab-${actif.id}`}>{actif.contenu}</div>}
    </article>
  );
};

/** Liste de definitions de l'onglet Informations ; valeur absente = « Non renseigné ». */
export const Informations = ({ groupes }: { groupes: { titre: string; champs: [string, ReactNode][] }[] }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    {groupes.map((g) => (
      <section key={g.titre} aria-label={g.titre} className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-carte sm:p-5">
        <h2 className="mb-3 font-bold text-stone-900">{g.titre}</h2>
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
          {g.champs.map(([libelle, valeur]) => (
            <div key={libelle} className="contents">
              <dt className="text-stone-500">{libelle}</dt>
              <dd className="break-words font-medium text-stone-900">{valeur === null || valeur === undefined || valeur === '' ? <span className="font-normal text-stone-400">Non renseigné</span> : valeur}</dd>
            </div>
          ))}
        </dl>
      </section>
    ))}
  </div>
);

export interface ColonneRelation<T> { libelle: string; valeur: (l: T) => ReactNode }

/** Bloc de l'onglet Relations : lignes liees lues en base, lien vers leur page detail quand elle existe. */
export const Relation = <T,>({ titre, lignes, erreur, colonnes, vide, lien, cle, note }: {
  titre: string;
  /** null = chargement. */
  lignes: T[] | null;
  erreur?: string;
  colonnes: ColonneRelation<T>[];
  vide: string;
  cle: (l: T) => string;
  lien?: (l: T) => string;
  note?: ReactNode;
}) => (
  <section aria-label={titre} className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-carte sm:p-5">
    <h2 className="mb-3 font-bold text-stone-900">{titre}{lignes && lignes.length > 0 && <span className="ml-2 text-sm font-normal text-stone-500">({lignes.length})</span>}</h2>
    {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      : lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
        : lignes.length === 0 ? <SansDonnees message={vide} />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-200 text-left text-stone-500">{colonnes.map((c) => <th key={c.libelle} className="py-2 pr-3 font-medium">{c.libelle}</th>)}</tr></thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={cle(l)} className="border-b border-stone-100 last:border-0">
                      {colonnes.map((c, i) => (
                        <td key={c.libelle} className="py-2 pr-3">
                          {i === 0 && lien ? <a href={lien(l)} className="font-semibold text-orange-800 hover:underline">{c.valeur(l)}</a> : c.valeur(l)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    {note && <p className="mt-3 text-xs text-stone-500">{note}</p>}
  </section>
);

/** Onglet Pieces jointes : composant D-083 quand l'objet est pris en charge, sinon l'ecart est dit. */
export const OngletPieces = ({ objetType, objetId, peutDeposer, libelleObjet }: {
  objetType: ObjetPiece | null;
  objetId: string;
  peutDeposer: boolean;
  libelleObjet: string;
}) => objetType
  ? <ListePieces objetType={objetType} objetId={objetId} peutDeposer={peutDeposer} />
  : (
    <SansDonnees
      message={`Pièces jointes non prises en charge pour ${libelleObjet}`}
      detail="Le stockage des pièces (D-083) couvre les voyages, tickets CBG, relevés de compteur, relevés CBG et livraisons carburant. L'étendre à cet objet demande une évolution serveur (lot suivant)."
    />
  );
