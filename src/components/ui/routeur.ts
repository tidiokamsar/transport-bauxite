import { useEffect, useState } from 'react';

// Navigation par adresse (D-090), sans dependance : le fragment de l'URL
// porte l'ecran et la page ouverte, ce qui donne le bouton retour du
// navigateur et un lien partageable.
//   #/<vue>                      liste (filtres dans la requete : ?q=...&f.statut=...)
//   #/<vue>/nouveau              creation en pleine page
//   #/<vue>/<id>                 page detail (?onglet=historique)
//   #/<vue>/<id>/modifier        modification en pleine page
//   #/<vue>/<id>/<action>        action metier (desactiver, suspendre...)
// `vue` reprend les identifiants du menu (src/components/Layout/menu.ts),
// donc `currentView` d'App.tsx se deduit de la route.

export type ModeRoute = 'liste' | 'nouveau' | 'detail' | 'modifier' | 'action';

export interface RouteApp {
  vue: string;
  mode: ModeRoute;
  id?: string;
  action?: string;
  requete: Record<string, string>;
}

export type CibleRoute = Omit<RouteApp, 'requete'> & { requete?: Record<string, string> };

const decoder = (s: string) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/** Lit un fragment (#/vue/id/action?cle=valeur) ; un fragment vide donne la vue ''. */
export const lireRoute = (hash: string): RouteApp => {
  const brut = hash.replace(/^#\/?/, '');
  const i = brut.indexOf('?');
  const chemin = i < 0 ? brut : brut.slice(0, i);
  const qs = i < 0 ? '' : brut.slice(i + 1);
  const requete: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => { requete[k] = v; });
  const [vue = '', a, b] = chemin.split('/').filter(Boolean).map(decoder);
  if (!a) return { vue, mode: 'liste', requete };
  if (a === 'nouveau' && !b) return { vue, mode: 'nouveau', requete };
  if (!b) return { vue, mode: 'detail', id: a, requete };
  if (b === 'modifier') return { vue, mode: 'modifier', id: a, requete };
  return { vue, mode: 'action', id: a, action: b, requete };
};

/** Ecrit le fragment d'une route ; les valeurs vides de la requete sont omises. */
export const ecrireRoute = (r: CibleRoute): string => {
  const seg = [r.vue];
  if (r.mode === 'nouveau') seg.push('nouveau');
  else if (r.mode !== 'liste') {
    if (!r.id) throw new Error(`Route ${r.mode} sans identifiant`);
    seg.push(r.id);
    if (r.mode === 'modifier') seg.push('modifier');
    if (r.mode === 'action') {
      if (!r.action) throw new Error('Route action sans action');
      seg.push(r.action);
    }
  }
  const params = new URLSearchParams();
  Object.entries(r.requete ?? {}).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) params.set(k, v); });
  const qs = params.toString();
  return `#/${seg.map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`;
};

/**
 * Ouvre une route. `remplacer` remplace l'entree courante de l'historique
 * (filtres d'une liste, retour apres enregistrement) au lieu d'en ajouter une.
 */
export const naviguer = (cible: string | CibleRoute, { remplacer = false }: { remplacer?: boolean } = {}) => {
  const hash = typeof cible === 'string' ? cible : ecrireRoute(cible);
  if (window.location.hash === hash) return;
  if (remplacer) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
};

/** Route courante, mise a jour a chaque changement du fragment (retour du navigateur compris). */
export const useRoute = (): RouteApp => {
  const [route, setRoute] = useState(() => lireRoute(window.location.hash));
  useEffect(() => {
    const suivre = () => setRoute(lireRoute(window.location.hash));
    window.addEventListener('hashchange', suivre);
    suivre();
    return () => window.removeEventListener('hashchange', suivre);
  }, []);
  return route;
};

// Derniers filtres de chaque liste pendant la session : « retour a la liste »
// et le menu rouvrent la liste telle qu'elle a ete laissee.
const requetesListes = new Map<string, Record<string, string>>();

export const memoriserRequeteListe = (vue: string, requete: Record<string, string>) => {
  requetesListes.set(vue, { ...requete });
};

export const routeListe = (vue: string): string =>
  ecrireRoute({ vue, mode: 'liste', requete: requetesListes.get(vue) ?? {} });

export const routeDetail = (vue: string, id: string, onglet?: string): string =>
  ecrireRoute({ vue, mode: 'detail', id, requete: onglet ? { onglet } : {} });

export const routeModifier = (vue: string, id: string): string => ecrireRoute({ vue, mode: 'modifier', id });

export const routeNouveau = (vue: string): string => ecrireRoute({ vue, mode: 'nouveau' });

export const routeAction = (vue: string, id: string, action: string): string => ecrireRoute({ vue, mode: 'action', id, action });

// Message de confirmation affiche par la page suivante (apres creation,
// modification ou action), une seule fois.
let annonce = '';
export const poserAnnonce = (message: string) => { annonce = message; };
/** Lecture sans effacement (rendus repetes du mode strict) ; effacerAnnonce apres l'affichage. */
export const lireAnnonce = (): string => annonce;
export const effacerAnnonce = () => { annonce = ''; };
export const prendreAnnonce = (): string => { const m = annonce; effacerAnnonce(); return m; };
