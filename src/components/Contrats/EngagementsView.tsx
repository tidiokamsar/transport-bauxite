import { useCallback, useEffect, useState } from 'react';
import { Calculator, FileText, Printer, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { naviguer, routeAction, routeDetail, useRoute } from '../ui/routeur';
import { ClausesCalculees } from './ClausesCalculees';
import { TableEngagements } from './DocumentRapport';
import { DetailRapportPerformance } from './DetailRapportPerformance';
import { ActionRapportPerformance } from './ActionRapportPerformance';
import {
  VUE_ENGAGEMENTS, bornesMoisRapport, jourRapport, libelleMois, moisOuDefaut, moisPrecedent, remiseInterdite, routeListeEngagements,
  type ContratRapport, type LigneEngagement, type RapportPerformance,
} from './rapportsPerformance';

// Engagements de l'avenant compares au realise, et rapport de performance
// mensuel (phase 4, D-031). Les mesures viennent du terrain (voyages,
// immobilisations, pleins, pointages) ; une mesure absente est « non
// mesurable », jamais estimee. Le rapport est fige puis remis.
// Pages standard (D-090) : contrat et mois dans l'adresse, fiche du rapport
// (#/engagements/<id>), apercu imprimable et remise en pleine page.

export const EngagementsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_ENGAGEMENTS || route.mode === 'liste') return <Engagements requete={route.vue === VUE_ENGAGEMENTS ? route.requete : {}} />;
  if (route.mode === 'action' && route.action) return <ActionRapportPerformance id={route.id ?? ''} action={route.action} />;
  return <DetailRapportPerformance id={route.id ?? ''} />;
};

const Engagements = ({ requete }: { requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<ContratRapport[]>([]);
  const mois = moisOuDefaut(requete.mois, moisPrecedent());
  const contrat = contrats.some((c) => c.id === requete.contrat) ? requete.contrat : contrats[0]?.id ?? '';
  const choisir = (c: string, m: string) => naviguer(routeListeEngagements(c, m), { remplacer: true });
  const [lignes, setLignes] = useState<LigneEngagement[] | null>(null);
  const [rapports, setRapports] = useState<RapportPerformance[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const [versionCalculs, setVersionCalculs] = useState(0);
  const peutDecider = (peutEcrire && (hasPermission('invoices', 'create') || hasPermission('invoices', 'edit')));

  useEffect(() => {
    supabase.from('contrats').select('id, reference, contrepartie, intitule, nature').order('reference').then((c) => {
      setContrats((c.data ?? []) as ContratRapport[]);
      if (c.error) setMessage({ ok: false, texte: `Contrats indisponibles : ${c.error.message}` });
    });
  }, []);

  const charger = useCallback(async () => {
    if (!contrat) { setLignes([]); return; }
    const { du, au } = bornesMoisRapport(mois);
    const [c, r] = await Promise.all([
      supabase.rpc('comparer_engagements', { p_contrat_id: contrat, p_du: du, p_au: au }),
      supabase.from('rapports_performance').select('*').eq('contrat_id', contrat).order('periode_debut', { ascending: false }),
    ]);
    setMessage(c.error ? { ok: false, texte: c.error.message } : r.error ? { ok: false, texte: `Rapports indisponibles : ${r.error.message}` } : null);
    setLignes((c.data ?? []) as LigneEngagement[]);
    setRapports(((r.data ?? []) as RapportPerformance[]).filter((x) => x.contrat_id === contrat));
    setHeure(new Date());
  }, [contrat, mois]);
  useEffect(() => { charger(); }, [charger]);

  const generer = async () => {
    const { du, au } = bornesMoisRapport(mois);
    const { error } = await supabase.rpc('generer_rapport_performance', { p_contrat_id: contrat, p_du: du, p_au: au });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Rapport du mois figé (brouillon) : à relire puis à remettre' });
    charger();
  };

  const calculer = async (r: RapportPerformance) => {
    const { data, error } = await supabase.rpc('calculer_clauses', { p_rapport: r.id });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: `${data ?? 0} clause(s) calculée(s) : propositions à décider, rien n'est appliqué automatiquement` });
    setVersionCalculs((v) => v + 1);
  };

  const c = contrats.find((x) => x.id === contrat);
  const tenus = (lignes ?? []).filter((l) => l.conforme === true).length;
  const nonTenus = (lignes ?? []).filter((l) => l.conforme === false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-stone-900">Engagements et rapport de performance</h2><p className="text-stone-500">Engagements de l'avenant comparés au réalisé du mois, rapport mensuel figé puis remis</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={contrat} onChange={(e) => choisir(e.target.value, mois)} aria-label="Contrat" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {contrats.length === 0 && <option value="">Aucun contrat</option>}
            {contrats.map((x) => <option key={x.id} value={x.id}>{x.reference} · {x.contrepartie}</option>)}
          </select>
          <input type="month" value={mois} onChange={(e) => choisir(contrat, moisOuDefaut(e.target.value, mois))} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          {peutEcrire && contrat && <button onClick={generer} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><FileText className="h-4 w-4" /> Figer le rapport du mois</button>}
        </div>
      </div>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      <Panneau titre={`Engagements du mois${lignes && lignes.length ? ` · ${tenus} tenu(s), ${nonTenus} non tenu(s)` : ''}`}>
        {lignes === null ? <div className="h-16" /> : lignes.length === 0 ? (
          <SansDonnees message="Aucun engagement" detail="Saisissez les engagements de l'avenant dans le dossier contractuel (version en vigueur à la fin du mois)." />
        ) : <TableEngagements lignes={lignes} />}
        <Provenance source="mesures du terrain : immobilisations (disponibilité), journal des voyages (temps), pesées et capacité (remplissage), voyages livrés (rotations, km), pleins et pointages (carburant)" heure={heure} />
      </Panneau>

      <Panneau titre="Rapports de performance">
        {rapports.length === 0 ? <SansDonnees message="Aucun rapport" detail="Figez le rapport du mois une fois les données du mois complètes." /> : (
          <ul className="divide-y divide-stone-100 text-sm">{rapports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><a href={routeDetail(VUE_ENGAGEMENTS, r.id)} className="font-bold text-orange-800 hover:underline" aria-label={`Fiche du rapport ${r.periode_debut}`}>{libelleMois(r.periode_debut)}</a>
                {' '}· figé le {new Date(r.genere_le).toLocaleDateString('fr-FR')}
                {r.statut === 'remis' && ` · remis le ${jourRapport(r.remis_le)} à ${r.remis_a ?? ''}`}</span>
              <span className="flex gap-1">
                <Puce teinte={r.statut === 'remis' ? 'vert' : 'orange'}>{r.statut === 'remis' ? 'Remis' : 'Brouillon'}</Puce>
                <a href={routeAction(VUE_ENGAGEMENTS, r.id, 'apercu')} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs" aria-label={`Aperçu du rapport ${r.periode_debut}`}><Printer className="inline h-3.5 w-3.5" /> Aperçu</a>
                {peutEcrire && r.statut === 'remis' && <button onClick={() => calculer(r)} className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700" aria-label={`Calculer les clauses ${r.periode_debut}`}><Calculator className="inline h-3.5 w-3.5" /> Calculer les clauses</button>}
                {remiseInterdite(r, peutEcrire) === null && <a href={routeAction(VUE_ENGAGEMENTS, r.id, 'remettre')} className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700" aria-label={`Marquer remis ${r.periode_debut}`}><Send className="inline h-3.5 w-3.5" /> Marquer remis</a>}
              </span>
            </li>
          ))}</ul>
        )}
      </Panneau>

      {contrat && <ClausesCalculees contratId={contrat} nature={c?.nature ?? null} peutDecider={peutDecider} version={versionCalculs} />}
    </div>
  );
};
