// Rechargement unique apres l'echec du chargement d'un module (fichier d'une
// version precedente apres un deploiement). Un second echec dans la minute
// n'entraine pas de nouveau rechargement : l'erreur s'affiche alors, pour ne
// jamais boucler.
const CLE = 'sigtb.rechargement_module';
const DELAI_MS = 60_000;

interface Stockage {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

export function rechargerApresEchecModule(stockage: Stockage, maintenant: number, recharger: () => void): boolean {
  let dernier: number | null = null;
  try {
    const valeur = stockage.getItem(CLE);
    dernier = valeur === null ? null : Number(valeur);
  } catch {
    return false;
  }
  if (dernier !== null && Number.isFinite(dernier) && maintenant - dernier < DELAI_MS) {
    return false;
  }
  try {
    stockage.setItem(CLE, String(maintenant));
  } catch {
    return false;
  }
  recharger();
  return true;
}
