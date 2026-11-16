import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, FileText, Loader2, MapPin, Search, Truck, User, Wrench, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SOURCES_RECHERCHE, filtreOu, motifRecherche, presenter, type TypeResultat } from './recherche';

// Recherche globale (D-061) : une requete par type de resultat, colonnes
// reelles, limitee aux ecrans accessibles ; la RLS et le perimetre site
// s'appliquent. Un type en erreur est signale, jamais remplace par du vide
// silencieux.

interface Resultat { type: TypeResultat; id: string; titre: string; detail: string; vue: string; libelle: string }

const ICONES: Record<TypeResultat, typeof Truck> = { vehicule: Truck, chauffeur: User, voyage: MapPin, ordre: Wrench, facture: FileText, site: Building2 };

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllerA?: (vue: string) => void;
}

export const GlobalSearchModal = ({ isOpen, onClose, onAllerA }: GlobalSearchModalProps) => {
  const { canAccessModule } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Resultat[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sources = SOURCES_RECHERCHE.filter((s) => canAccessModule(s.vue));
  const fermer = useRef(onClose);
  fermer.current = onClose;

  // Fenetre ouverte : Echap ferme meme hors du champ, page dessous figee,
  // focus rendu a l'element d'origine a la fermeture.
  useEffect(() => {
    if (!isOpen) return;
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const clavier = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer.current(); };
    document.addEventListener('keydown', clavier);
    return () => {
      document.removeEventListener('keydown', clavier);
      document.body.style.overflow = debordement;
      if (origine && document.contains(origine)) origine.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); setErreurs([]); setSelectedIndex(0); }
  }, [isOpen]);

  useEffect(() => {
    const motif = motifRecherche(query);
    if (!motif) { setResults([]); setErreurs([]); return; }
    let annule = false;
    const minuterie = setTimeout(async () => {
      setLoading(true);
      const reponses = await Promise.all(sources.map((s) =>
        supabase.from(s.table).select(s.colonnes).or(filtreOu(s, motif)).limit(5).then((r) => ({ s, r }))));
      if (annule) return;
      const trouves: Resultat[] = [];
      const enErreur: string[] = [];
      for (const { s, r } of reponses) {
        if (r.error) { enErreur.push(s.libelle); continue; }
        for (const l of (r.data ?? []) as unknown as Record<string, unknown>[]) {
          trouves.push({ type: s.type, id: String(l.id), vue: s.vue, libelle: s.libelle, ...presenter(s.type, l) });
        }
      }
      setResults(trouves);
      setErreurs(enErreur);
      setSelectedIndex(0);
      setLoading(false);
    }, 300);
    return () => { annule = true; clearTimeout(minuterie); };
    // sources derive de canAccessModule, stable pour la session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const ouvrir = (r: Resultat) => { onAllerA?.(r.vue); onClose(); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIndex]) ouvrir(results[selectedIndex]);
  };

  if (!isOpen) return null;
  const motif = motifRecherche(query);

  return (
    <div
      className="fixed inset-0 z-[900] flex items-start justify-center bg-black/50 p-4 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white text-stone-900 shadow-2xl sm:max-h-[calc(100dvh-7rem)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-stone-200 p-4">
          <Search className="h-5 w-5 text-stone-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            aria-label="Rechercher" placeholder="Engin, chauffeur, voyage, ordre de travail, facture, site…" className="min-w-0 flex-1 text-lg outline-none" autoFocus />
          {loading && <Loader2 className="h-5 w-5 animate-spin text-orange-600" />}
          <button onClick={onClose} aria-label="Fermer la recherche" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5 text-stone-400" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!motif && (
            <div className="p-8 text-center text-stone-500">
              <p>Tapez au moins 2 caractères.</p>
              <p className="mt-3 text-xs">Recherche dans : {sources.map((s) => s.libelle).join(', ') || 'aucun écran accessible'}</p>
            </div>
          )}
          {erreurs.length > 0 && <p role="alert" className="m-3 rounded bg-amber-50 p-2 text-xs text-amber-800">Recherche indisponible pour : {erreurs.join(', ')}.</p>}
          {motif && !loading && results.length === 0 && erreurs.length === 0 && (
            <p className="p-8 text-center text-stone-500">Aucun résultat pour « {query} »</p>
          )}
          {results.length > 0 && (
            <ul className="py-2">
              {results.map((r, i) => {
                const Icone = ICONES[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button onClick={() => ouvrir(r)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 ${i === selectedIndex ? 'bg-orange-50' : ''}`}>
                      <span className="rounded-lg bg-stone-100 p-2 text-stone-600"><Icone className="h-5 w-5" /></span>
                      <span className="flex-1">
                        <span className="flex items-center gap-2"><span className="font-medium">{r.titre}</span>
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{r.libelle}</span></span>
                        {r.detail && <span className="block text-sm text-stone-600">{r.detail}</span>}
                      </span>
                      <ArrowRight className="h-5 w-5 text-stone-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="hidden shrink-0 border-t border-stone-200 bg-stone-50 p-3 text-xs text-stone-500 sm:block">↑ ↓ pour naviguer · Entrée pour ouvrir l'écran · Échap pour fermer</p>
      </div>
    </div>
  );
};
