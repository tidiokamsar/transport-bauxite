import { useRoute } from '../ui/routeur';
import { contexteDepuisRequete } from './journal';

// Filtre de contexte camion et chauffeur (D-088 suite) : lu dans l'adresse,
// annonce a l'ecran avec le moyen de le retirer ; jamais applique en silence.

export const BandeauContexte = ({ nomCamion, nomChauffeur }: { nomCamion: (id: string) => string | null; nomChauffeur: (id: string) => string | null }) => {
  const route = useRoute();
  const ctx = contexteDepuisRequete(route.requete);
  if (!ctx.camion && !ctx.chauffeur) return null;
  const sans = () => {
    const p = new URLSearchParams(route.requete);
    p.delete('camion'); p.delete('chauffeur');
    const qs = p.toString();
    const base = window.location.hash.split('?')[0];
    return `${base}${qs ? `?${qs}` : ''}`;
  };
  return (
    <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
      Filtré par le contexte :
      {ctx.camion && <b>camion {nomCamion(ctx.camion) ?? 'hors référentiel'}</b>}
      {ctx.chauffeur && <b>chauffeur {nomChauffeur(ctx.chauffeur) ?? 'hors référentiel'}</b>}
      <a href={sans()} className="font-semibold underline">Retirer ce filtre</a>
    </p>
  );
};
