// Lecture d'un releve CBG au format CSV (D-050). Les valeurs sont reprises
// telles quelles : une valeur illisible reste vide (le serveur la garde NULL
// et signale la ligne), rien n'est complete ni deduit.

export interface LigneReleve { ticket: string; date: string; immatriculation: string; brut: string; tare: string; net: string }

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cle = (entete: string): keyof LigneReleve | null => {
  const e = sansAccents(entete).toLowerCase().replace(/[^a-z]/g, '');
  if (['ticket', 'numero', 'nticket', 'numeroticket', 'noticket'].includes(e)) return 'ticket';
  if (['date', 'datepesee', 'jour'].includes(e)) return 'date';
  if (['immatriculation', 'immat', 'camion', 'vehicule', 'plaque'].includes(e)) return 'immatriculation';
  if (['brut', 'poidsbrut'].includes(e)) return 'brut';
  if (['tare', 'poidstare'].includes(e)) return 'tare';
  if (['net', 'poidsnet'].includes(e)) return 'net';
  return null;
};

// Decoupe une ligne CSV en respectant les guillemets.
const decouper = (ligne: string, sep: string) => {
  const champs: string[] = []; let courant = ''; let guillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const ch = ligne[i];
    if (ch === '"') { if (guillemets && ligne[i + 1] === '"') { courant += '"'; i += 1; } else guillemets = !guillemets; }
    else if (ch === sep && !guillemets) { champs.push(courant); courant = ''; }
    else courant += ch;
  }
  champs.push(courant);
  return champs.map((c) => c.trim());
};

export const normaliserNombre = (v: string) => {
  const t = v.replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? t : '';
};

export const normaliserDate = (v: string) => {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};

// Marque d'ordre des octets (BOM, code 0xFEFF) en tete des exports Excel.
const retirerBom = (texte: string) => (texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte);

export const lireReleveCsv = (texte: string): { lignes: LigneReleve[]; colonnes: (keyof LigneReleve)[]; erreur?: string } => {
  const brutes = retirerBom(texte).split(/\r?\n/).filter((l) => l.trim() !== '');
  if (brutes.length < 2) return { lignes: [], colonnes: [], erreur: 'Fichier vide ou sans ligne de données' };
  const sep = (brutes[0].match(/;/g)?.length ?? 0) >= (brutes[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const entetes = decouper(brutes[0], sep).map(cle);
  const colonnes = entetes.filter((c): c is keyof LigneReleve => c !== null);
  if (!colonnes.includes('ticket')) return { lignes: [], colonnes, erreur: 'Colonne « ticket » introuvable dans l\'en-tête' };
  if (!colonnes.includes('net') && !(colonnes.includes('brut') && colonnes.includes('tare'))) {
    return { lignes: [], colonnes, erreur: 'Colonnes de poids introuvables (net, ou brut et tare)' };
  }
  const lignes = brutes.slice(1).map((l) => {
    const valeurs = decouper(l, sep);
    const r: LigneReleve = { ticket: '', date: '', immatriculation: '', brut: '', tare: '', net: '' };
    entetes.forEach((c, i) => {
      if (!c) return;
      const v = valeurs[i] ?? '';
      r[c] = c === 'date' ? normaliserDate(v) : ['brut', 'tare', 'net'].includes(c) ? normaliserNombre(v) : v;
    });
    return r;
  });
  return { lignes, colonnes };
};
