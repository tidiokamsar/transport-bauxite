import { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';

// Tableau de bord du charge de contrats et facturation (phase 4, D-031) :
// les six indicateurs de sa fiche de poste (12 derniers mois) et la
// liste de cloture du mois ecoule. Un indicateur sans donnees l'indique.

interface Indicateurs {
  delai_emission_jours: number | null; factures_emises: number; ecart_tonnage_pct: number | null; reconciliations_closes: number;
  delai_rapport_jours: number | null; rapports_remis: number; delai_recouvrement_jours: number | null; factures_soldees: number;
  creances_en_retard: number; montant_en_retard: number; factures_a_signer: number;
}

const moisPrecedent = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

export const MonPosteView = () => {
  const [ind, setInd] = useState<Indicateurs | null>(null);
  const [cloture, setCloture] = useState<{ libelle: string; fait: boolean | null; detail: string }[]>([]);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    const mois = moisPrecedent();
    Promise.all([
      supabase.rpc('indicateurs_charge_contrats'),
      supabase.from('reconciliations').select('statut').eq('periode_debut', `${mois}-01`),
      supabase.from('factures').select('statut, type').eq('periode_debut', `${mois}-01`).eq('type', 'facture'),
      supabase.from('rapports_performance').select('statut').eq('periode_debut', `${mois}-01`),
      supabase.from('fiches_terrain').select('statut').gte('date_fiche', `${mois}-01`).lt('date_fiche', `${new Date().toISOString().slice(0, 7)}-01`),
    ]).then(([i, r, f, p, fi]) => {
      setInd(((i.data ?? []) as Indicateurs[])[0] ?? null);
      const recs = (r.data ?? []) as { statut: string }[];
      const facs = (f.data ?? []) as { statut: string }[];
      const raps = (p.data ?? []) as { statut: string }[];
      const fiches = (fi.data ?? []) as { statut: string }[];
      const enAttente = fiches.filter((x) => ['preparee', 'remise', 'retournee'].includes(x.statut)).length;
      setCloture([
        { libelle: 'Fiches terrain du mois saisies', fait: fiches.length ? enAttente === 0 : null, detail: fiches.length ? `${enAttente} fiche(s) non saisie(s) sur ${fiches.length}` : 'aucune fiche' },
        { libelle: 'Réconciliation du mois clôturée', fait: recs.length ? recs.every((x) => x.statut === 'cloturee') : false, detail: recs.length ? `${recs.length} réconciliation(s)` : 'non ouverte' },
        { libelle: 'Facture du mois émise', fait: facs.length ? facs.some((x) => x.statut === 'emise') : false, detail: facs.length ? facs.map((x) => x.statut).join(', ') : 'non générée' },
        { libelle: 'Rapport de performance remis', fait: raps.length ? raps.every((x) => x.statut === 'remis') : false, detail: raps.length ? raps.map((x) => x.statut).join(', ') : 'non figé' },
      ]);
      setHeure(new Date());
    });
  }, []);

  const j = (v: number | null, n: number, unite: string) => (v === null || n === 0 ? 'Sans données' : `${formatNombre(Number(v), 1)} ${unite}`);
  const tuiles: [string, string, string][] = ind ? [
    ['Délai d\'émission des factures', j(ind.delai_emission_jours, ind.factures_emises, 'j'), `après la fin de période · ${ind.factures_emises} facture(s)`],
    ['Écart tonnage relevé / facturé', ind.ecart_tonnage_pct === null ? 'Sans données' : `${formatNombre(Number(ind.ecart_tonnage_pct), 2)} %`, `${ind.reconciliations_closes} réconciliation(s) clôturée(s)`],
    ['Écarts Neemba détectés et recouvrés', 'Phase 5', 'contrôle des factures Neemba à venir'],
    ['Délai du rapport de performance', j(ind.delai_rapport_jours, ind.rapports_remis, 'j'), `après la fin du mois · ${ind.rapports_remis} rapport(s)`],
    ['Délai moyen de recouvrement CBG', j(ind.delai_recouvrement_jours, ind.factures_soldees, 'j'), `de l'émission au solde · ${ind.factures_soldees} facture(s) soldée(s)`],
    ['Délai de l\'état d\'écarts sur paiements', 'Phase 6', 'contrôle des paiements à venir'],
  ] : [];

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-stone-900">Mon tableau de bord</h2><p className="text-stone-500">Indicateurs de la fiche de poste « Chargé de contrats et facturation » (12 derniers mois)</p></div>
      {ind && (ind.factures_a_signer > 0 || ind.creances_en_retard > 0) && (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
          {ind.factures_a_signer > 0 && `${ind.factures_a_signer} facture(s) attendent la signature du DG. `}
          {ind.creances_en_retard > 0 && `${ind.creances_en_retard} créance(s) en retard à relancer.`}
        </p>
      )}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Indicateurs de la fiche de poste">
        {tuiles.map(([l, v, d]) => (
          <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{v}</p><p className="text-xs text-stone-400">{d}</p></div>
        ))}
      </section>
      <Panneau titre={`Clôture de ${new Date(moisPrecedent() + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`}>
        <ul className="space-y-2 text-sm">{cloture.map((c) => (
          <li key={c.libelle} className="flex items-center gap-2">
            {c.fait ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-stone-300" />}
            <span className={c.fait ? 'text-stone-900' : 'font-semibold text-stone-700'}>{c.libelle}</span><span className="text-stone-500">· {c.detail}</span>
          </li>
        ))}</ul>
        <Provenance source="factures, réconciliations, rapports de performance, encaissements, fiches terrain" heure={heure} />
      </Panneau>
    </div>
  );
};
