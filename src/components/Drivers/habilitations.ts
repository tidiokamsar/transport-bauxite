import type { TeintePuce } from '../ui/Panneau';

// Habilitations des chauffeurs (D-051) : memes regles de validite que la
// fonction serveur habilitations_manquantes.

export const TYPES_HABILITATION = {
  visite_medicale: 'Visite médicale',
  formation_securite: 'Formation sécurité',
  habilitation_engin: 'Habilitation engin',
  acces_site: 'Accès site',
  autre: 'Autre',
} as const;

export interface Habilitation {
  id: string; driver_id: string; type: keyof typeof TYPES_HABILITATION; libelle: string; numero: string | null;
  delivre_le: string; expire_le: string | null; revoque_le: string | null; motif_revocation: string | null;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

export const etatHabilitation = (h: Pick<Habilitation, 'delivre_le' | 'expire_le' | 'revoque_le'>, a: Date): { teinte: TeintePuce; texte: string } => {
  const j = jour(a);
  if (h.revoque_le && jour(new Date(h.revoque_le)) <= j) return { teinte: 'gris', texte: 'Révoquée' };
  if (h.delivre_le > j) return { teinte: 'bleu', texte: 'À venir' };
  if (h.expire_le && h.expire_le < j) return { teinte: 'rouge', texte: 'Expirée' };
  if (h.expire_le) {
    const restants = Math.round((new Date(h.expire_le).getTime() - new Date(j).getTime()) / 86_400_000);
    if (restants <= 30) return { teinte: 'orange', texte: `Expire dans ${restants} j` };
  }
  return { teinte: 'vert', texte: 'Valide' };
};
