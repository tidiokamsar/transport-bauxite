// Lecture d'une requete pour les pages standard (D-090) : soit les lignes,
// soit l'erreur du serveur prefixee de ce qui etait lu. Une lecture refusee
// n'est jamais presentee comme une liste vide.

export interface Lecture<T> { lignes: T[] | null; erreur: string }

export const lire = async <T,>(
  requete: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  quoi: string,
): Promise<Lecture<T>> => {
  const { data, error } = await requete;
  if (error) return { lignes: null, erreur: `Lecture impossible (${quoi}) : ${error.message}` };
  return { lignes: (Array.isArray(data) ? data : data ? [data] : []) as T[], erreur: '' };
};

/** Ligne d'identifiant `id` dans un resultat (robuste a une reponse non filtree). */
export const trouver = <T extends { id: string },>(lignes: T[] | null, id: string): T | null =>
  (lignes ?? []).find((l) => l.id === id) ?? null;

/** Identifiant sans caractere de la syntaxe des filtres PostgREST (virgule, point, parenthese) : utilisable dans .or(). */
export const identifiantSur = (id: string) => /^[A-Za-z0-9-]{1,64}$/.test(id);
