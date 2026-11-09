import { Construction } from 'lucide-react';
import { Panneau } from '../ui/Panneau';

// Rubrique prevue au CDC mais pas encore developpee : on le dit, sans
// ecran factice.
export const PageAttente = ({ titre, lot, description }: { titre: string; lot: string; description: string }) => (
  <Panneau>
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
        <Construction className="h-8 w-8" />
      </span>
      <h2 className="text-2xl font-bold text-stone-900">{titre}</h2>
      <p className="mt-2 max-w-xl text-stone-600">{description}</p>
      <p className="mt-4 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">Prévu au {lot}</p>
    </div>
  </Panneau>
);
