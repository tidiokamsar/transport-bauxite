import { allerA } from '../ui/navigation';

// Rappel du parcours d'un litre de carburant (demande du proprietaire du
// 2026-11-16) : affiche en tete de chaque ecran du menu Carburant, chaque
// etape ouvre l'ecran ou elle se fait.

const ETAPES_CARBURANT = [
  { numero: 1, titre: 'Livraison CBG', detail: 'quantité et prix au litre du bon', vue: 'livraisons-cbg' },
  { numero: 2, titre: 'Réception en cuve', detail: 'volume mesuré, motif si écart', vue: 'fuel-stocks' },
  { numero: 3, titre: 'Validation', detail: 'par une autre personne', vue: 'fuel-stocks' },
  { numero: 4, titre: 'Distribution aux engins', detail: 'plein ou fiche carburant FC', vue: 'fuel' },
  { numero: 5, titre: 'Inventaire', detail: 'volume compté, écart validé', vue: 'fuel-stocks' },
  { numero: 6, titre: 'Contrôle facture CBG', detail: 'facture contre livraisons', vue: 'livraisons-cbg' },
] as const;

export const ParcoursCarburant = ({ vue }: { vue: string }) => (
  <nav aria-label="Parcours du carburant" className="rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
    <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-orange-800">Parcours d'un litre de carburant</p>
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ETAPES_CARBURANT.map((e) => {
        const ici = e.vue === vue;
        return (
          <li key={e.numero}>
            <button
              type="button"
              onClick={() => allerA(e.vue)}
              aria-current={ici ? 'step' : undefined}
              className={`flex h-full w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${ici ? 'border-orange-500 bg-white shadow-sm' : 'border-transparent hover:border-orange-300 hover:bg-white/70'}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${ici ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'}`}>{e.numero}</span>
              <span><span className="block font-semibold text-stone-900">{e.titre}</span><span className="block text-xs text-stone-500">{e.detail}</span></span>
            </button>
          </li>
        );
      })}
    </ol>
    <p className="mt-2 px-1 text-xs text-stone-500">Une erreur ne s'efface pas : elle s'annule par un contre-mouvement motivé, lui aussi validé. Le stock est la somme des mouvements validés, à partir d'un inventaire d'ouverture.</p>
  </nav>
);
