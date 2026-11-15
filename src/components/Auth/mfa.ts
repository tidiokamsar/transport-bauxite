// Double authentification TOTP (D-045, socle serveur D-040).

export interface NiveauAssurance { currentLevel: 'aal1' | 'aal2' | null; nextLevel: 'aal1' | 'aal2' | null }

// La session doit passer en aal2 quand un facteur verifie existe et que la
// session courante n'est qu'en aal1.
export const verificationRequise = (n: NiveauAssurance | null) =>
  n !== null && n.currentLevel === 'aal1' && n.nextLevel === 'aal2';

// Un code TOTP compte 6 chiffres ; espaces tolerees a la saisie.
export const nettoyerCode = (saisie: string) => saisie.replace(/\s/g, '');
export const codeValide = (saisie: string) => /^\d{6}$/.test(nettoyerCode(saisie));

// Le QR code renvoye par le serveur est un SVG a afficher en image.
export const urlQrCode = (svg: string) => `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
