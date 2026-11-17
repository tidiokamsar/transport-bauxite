// Pieces justificatives (D-083) : regles cote navigateur, alignees sur la
// migration 20261121200000 (le serveur reste seul juge : ces controles
// evitent seulement un aller-retour inutile et donnent un message clair).

export type ObjetPiece = 'voyage' | 'ticket_pesee_cbg' | 'releve_compteur' | 'releve_cbg' | 'livraison_carburant_cbg';

/** Taille maximale d'un fichier, comme public.pieces_taille_max(). */
export const TAILLE_MAX = 10 * 1024 * 1024;

const TYPES: { type: string; extensions: string[]; releveSeulement: boolean }[] = [
  { type: 'application/pdf', extensions: ['pdf'], releveSeulement: false },
  { type: 'image/jpeg', extensions: ['jpg', 'jpeg'], releveSeulement: false },
  { type: 'image/png', extensions: ['png'], releveSeulement: false },
  { type: 'image/webp', extensions: ['webp'], releveSeulement: false },
  { type: 'text/csv', extensions: ['csv'], releveSeulement: true },
  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'], releveSeulement: true },
];

export const typesAutorises = (objet: ObjetPiece) =>
  TYPES.filter((t) => !t.releveSeulement || objet === 'releve_cbg');

/** Valeur de l'attribut accept du champ fichier. */
export const accepte = (objet: ObjetPiece) =>
  typesAutorises(objet).flatMap((t) => [t.type, ...t.extensions.map((e) => `.${e}`)]).join(',');

export const extension = (nom: string): string | null => {
  const m = /\.([A-Za-z0-9]+)$/.exec(nom.trim());
  return m ? m[1].toLowerCase() : null;
};

/**
 * Type MIME retenu pour le fichier : deduit de l'extension (le type fourni
 * par le navigateur varie : un CSV est souvent annonce
 * application/vnd.ms-excel sous Windows). null si l'extension n'est pas
 * admise pour cet objet.
 */
export const typeDuFichier = (objet: ObjetPiece, nom: string): string | null => {
  const ext = extension(nom);
  if (!ext) return null;
  return typesAutorises(objet).find((t) => t.extensions.includes(ext))?.type ?? null;
};

/** Message d'erreur, ou null si le fichier peut etre propose au serveur. */
export const controlerFichier = (objet: ObjetPiece, nom: string, taille: number): string | null => {
  const n = nom.trim();
  if (n.length === 0 || n.length > 200) return 'Nom de fichier vide ou trop long (200 caractères au plus).';
  if (/[/\\]/.test(n) || /\p{Cc}/u.test(n)) return 'Nom de fichier invalide (barre oblique ou caractère de contrôle).';
  if (!typeDuFichier(objet, n)) {
    const admis = typesAutorises(objet).flatMap((t) => t.extensions).join(', ');
    return `Type de fichier non admis pour cette pièce (admis : ${admis}).`;
  }
  if (taille <= 0) return 'Fichier vide.';
  if (taille > TAILLE_MAX) return `Fichier trop volumineux (${formaterTaille(taille)} ; 10 Mo au plus).`;
  return null;
};

export const formaterTaille = (octets: number): string => {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
};

/** Empreinte sha256 en hexadecimal minuscule (null si l'API est absente). */
export const empreinteSha256 = async (donnees: ArrayBuffer): Promise<string | null> => {
  const sujet = globalThis.crypto?.subtle;
  if (!sujet) return null;
  const h = await sujet.digest('SHA-256', donnees);
  return Array.from(new Uint8Array(h)).map((o) => o.toString(16).padStart(2, '0')).join('');
};

export interface PieceJointe {
  id: string;
  objet_type: ObjetPiece;
  objet_id: string;
  chemin: string;
  nom: string;
  type_mime: string;
  taille: number;
  sha256: string | null;
  statut: 'en_attente' | 'deposee';
  depose_par: string;
  depose_le: string;
  annule_le: string | null;
  motif_annulation: string | null;
}

export type EtatPiece = 'deposee' | 'inachevee' | 'annulee';

/** Etat affiche : annulee prime ; une piece en attente est un depot inacheve. */
export const etatPiece = (p: Pick<PieceJointe, 'statut' | 'annule_le'>): EtatPiece =>
  p.annule_le ? 'annulee' : p.statut === 'deposee' ? 'deposee' : 'inachevee';

export const MOTIF_MIN = 5;
