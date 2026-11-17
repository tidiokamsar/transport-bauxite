import { supabase } from '../../lib/supabase';

// Engins attaches a un tarif d'un contrat de location (D-033), si le dossier
// contractuel est lisible. SIGTB ne connait pas la propriete d'un engin : ce
// rattachement est le seul signal affiche (D-061). Lecture refusee = carte vide.

export interface LocationEngin { contratId: string | null; reference: string; contrepartie: string }

export const chargerLocationsEngins = async (): Promise<Map<string, LocationEngin>> => {
  const { data, error } = await supabase.from('contrat_tarifs')
    .select('engin, version:contrat_versions(contrat:contrats(id, reference, nature, contrepartie))').not('engin', 'is', null);
  const loc = new Map<string, LocationEngin>();
  if (error) return loc;
  for (const l of (data ?? []) as unknown as { engin: string; version: { contrat: { id?: string; reference: string; nature: string; contrepartie: string } | null } | null }[]) {
    const ct = l.version?.contrat;
    if (ct?.nature === 'location') loc.set(l.engin, { contratId: ct.id ?? null, reference: ct.reference, contrepartie: ct.contrepartie });
  }
  return loc;
};
