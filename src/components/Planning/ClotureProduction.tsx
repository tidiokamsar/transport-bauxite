import { useCallback, useEffect, useState } from 'react';
import { Download, Lock, Plus, Printer, Trash2, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV, printDocument } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { CHAMP, Fenetre } from './FenetresObjectif';
import { CATEGORIES_CAUSE, causesServeur, erreurCauses, type CauseSaisie } from './planAvance';

// Cloture de planification d'une journee et d'un site (D-063) : bilan fige
// planifie contre realise et causes d'ecart saisies, par
// cloturer_planification ; annulation motivee. Rapport de production :
// bilans figes, journees non closes calculees a la lecture.

interface Production {
  tonnes_cible: number | null;
  tonnes_livrees: number | null;
  voyages_livres: number;
  voyages_sans_poids: number;
  tonnes_livrees_site: number | null;
  voyages_non_termines: number;
  perimetre: string;
}
interface Cloture {
  id: string;
  tonnes_cible: number | null;
  tonnes_livrees: number | null;
  ecart: number | null;
  bilan: { perimetre?: string; voyages_livres?: number; voyages_sans_poids?: number; tonnes_livrees_site?: number; voyages_non_termines?: number };
  commentaire: string | null;
  cloture_le: string;
}
interface Cause { id: string; categorie: string; description: string; tonnes_impact: number | null }
interface LigneRapport {
  date_plan: string; site_id: string; site: string | null; statut: 'close' | 'non_close';
  tonnes_cible: number | null; tonnes_livrees: number | null; ecart: number | null; realisation_pct: number | null;
  voyages_livres: number | null; voyages_sans_poids: number | null; causes: string | null; cloture_le: string | null; source: string;
}

const t = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${formatNombre(Number(v))} t`);
const jourFr = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');
const CAUSE_VIDE: CauseSaisie = { categorie: '', description: '', tonnes: '' };

export const ClotureProduction = ({ date, siteId, sites, peutEcrire }: {
  date: string;
  siteId: string | null;
  sites: { id: string; name: string }[];
  peutEcrire: boolean;
}) => {
  const [site, setSite] = useState(siteId ?? '');
  const [production, setProduction] = useState<Production | null>(null);
  const [cloture, setCloture] = useState<Cloture | null | undefined>(undefined);
  const [causesFigees, setCausesFigees] = useState<Cause[]>([]);
  const [causes, setCauses] = useState<CauseSaisie[]>([]);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [periode, setPeriode] = useState({ debut: `${date.slice(0, 8)}01`, fin: date });
  const [rapport, setRapport] = useState<LigneRapport[] | null>(null);

  useEffect(() => { if (siteId) setSite(siteId); }, [siteId]);

  const charger = useCallback(async () => {
    if (!site) return;
    const [c, p] = await Promise.all([
      supabase.from('clotures_planification').select('id, tonnes_cible, tonnes_livrees, ecart, bilan, commentaire, cloture_le')
        .eq('date_plan', date).eq('site_id', site).eq('statut', 'close').maybeSingle(),
      supabase.rpc('production_journee', { p_date: date, p_site_id: site }),
    ]);
    if (c.error) setErreur(c.error.message);
    const cl = (c.data ?? null) as Cloture | null;
    setCloture(cl);
    if (cl) {
      const { data } = await supabase.from('clotures_planification_causes').select('id, categorie, description, tonnes_impact')
        .eq('cloture_id', cl.id).order('saisi_le');
      setCausesFigees((data ?? []) as Cause[]);
    } else setCausesFigees([]);
    setProduction(!p.error && Array.isArray(p.data) ? ((p.data[0] as Production | undefined) ?? null) : null);
    setHeure(new Date());
  }, [date, site]);
  useEffect(() => { setCloture(undefined); charger(); }, [charger]);

  const chargerRapport = useCallback(async () => {
    const { data, error } = await supabase.rpc('rapport_production', { p_debut: periode.debut, p_fin: periode.fin, p_site: siteId });
    if (error) setErreur('Rapport indisponible : ' + error.message);
    setRapport(error ? [] : ((data ?? []) as LigneRapport[]));
  }, [periode, siteId]);
  useEffect(() => { chargerRapport(); }, [chargerRapport]);

  const cloturer = async () => {
    const e = erreurCauses(causes, production?.tonnes_cible ?? null, production?.tonnes_livrees ?? null);
    if (e) { setErreur(e); return; }
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('cloturer_planification', {
      p_date: date, p_site_id: site, p_causes: causesServeur(causes), p_commentaire: commentaire || null,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setCauses([]);
    setCommentaire('');
    charger();
    chargerRapport();
  };

  const annuler = async () => {
    if (!cloture) return;
    setEnCours(true);
    const { error } = await supabase.rpc('annuler_cloture_planification', { p_id: cloture.id, p_motif: motif });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setAnnulation(false);
    setMotif('');
    charger();
    chargerRapport();
  };

  const majCause = (i: number, champ: keyof CauseSaisie, v: string) => setCauses(causes.map((c, j) => (j === i ? { ...c, [champ]: v } : c)));
  const ecartLive = production && production.tonnes_cible !== null && production.tonnes_livrees !== null
    ? Number(production.tonnes_livrees) - Number(production.tonnes_cible) : null;

  return (
    <div className="space-y-4">
      <Panneau
        titre={<span className="flex items-center gap-2"><Lock className="h-5 w-5 text-orange-600" /> Clôture de la planification du {jourFr(date)}</span>}
        action={!siteId && (
          <select value={site} onChange={(e) => setSite(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" aria-label="Site à clôturer">
            <option value="">Choisir un site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      >
        {erreur && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {!site ? (
          <SansDonnees message="Choisissez un site" detail="La clôture porte sur une journée et un site." />
        ) : cloture === undefined ? (
          <p className="text-sm text-stone-400">Chargement...</p>
        ) : cloture ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2"><Puce teinte="vert">Close</Puce> le {new Date(cloture.cloture_le).toLocaleString('fr-FR')}</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><dt className="text-xs text-stone-500">Planifié</dt><dd className="font-bold">{t(cloture.tonnes_cible)}</dd></div>
              <div><dt className="text-xs text-stone-500">Réalisé</dt><dd className="font-bold">{t(cloture.tonnes_livrees)}</dd></div>
              <div><dt className="text-xs text-stone-500">Écart</dt><dd className="font-bold">{cloture.ecart === null ? '—' : `${Number(cloture.ecart) > 0 ? '+' : ''}${t(cloture.ecart)}`}</dd></div>
              <div><dt className="text-xs text-stone-500">Voyages livrés</dt><dd className="font-bold">{cloture.bilan.voyages_livres ?? '—'}</dd></div>
            </dl>
            <p className="text-xs text-stone-500">Périmètre : {cloture.bilan.perimetre ?? '—'} · tout le site : {t(cloture.bilan.tonnes_livrees_site)}</p>
            {causesFigees.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {causesFigees.map((c) => (
                  <li key={c.id}>{CATEGORIES_CAUSE[c.categorie] ?? c.categorie}{c.tonnes_impact !== null ? ` (${t(c.tonnes_impact)})` : ''} : {c.description}</li>
                ))}
              </ul>
            )}
            {cloture.commentaire && <p className="text-stone-600">{cloture.commentaire}</p>}
            {peutEcrire && (
              <button onClick={() => setAnnulation(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                <Unlock className="h-4 w-4" /> Annuler la clôture
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><dt className="text-xs text-stone-500">Planifié</dt><dd className="font-bold">{production ? t(production.tonnes_cible) : '—'}</dd></div>
              <div><dt className="text-xs text-stone-500">Réalisé</dt><dd className="font-bold">{production ? t(production.tonnes_livrees) : '—'}</dd></div>
              <div><dt className="text-xs text-stone-500">Écart</dt><dd className="font-bold">{ecartLive === null ? '—' : `${ecartLive > 0 ? '+' : ''}${formatNombre(ecartLive)} t`}</dd></div>
              <div><dt className="text-xs text-stone-500">Voyages non terminés</dt><dd className="font-bold">{production?.voyages_non_termines ?? '—'}</dd></div>
            </dl>
            {production && <p className="text-xs text-stone-500">Périmètre : {production.perimetre}{production.voyages_sans_poids ? ` · ${production.voyages_sans_poids} voyage(s) livré(s) sans poids, non comptés` : ''}</p>}
            {peutEcrire && (
              <>
                <h3 className="font-semibold text-stone-700">Causes d'écart</h3>
                {causes.map((c, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-[12rem_1fr_7rem_auto]">
                    <select value={c.categorie} onChange={(e) => majCause(i, 'categorie', e.target.value)} className={CHAMP} aria-label={`Catégorie de la cause ${i + 1}`}>
                      <option value="">Catégorie</option>
                      {Object.entries(CATEGORIES_CAUSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input value={c.description} onChange={(e) => majCause(i, 'description', e.target.value)} placeholder="Description" className={CHAMP} aria-label={`Description de la cause ${i + 1}`} />
                    <input value={c.tonnes} onChange={(e) => majCause(i, 'tonnes', e.target.value)} inputMode="decimal" placeholder="t perdues" className={CHAMP} aria-label={`Tonnes perdues ${i + 1}`} />
                    <button type="button" onClick={() => setCauses(causes.filter((_, j) => j !== i))} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label={`Retirer la cause ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setCauses([...causes, { ...CAUSE_VIDE }])} className="flex items-center gap-1 font-semibold text-orange-700">
                  <Plus className="h-4 w-4" /> Ajouter une cause
                </button>
                <label className="block">
                  <span className="mb-1 block font-medium text-stone-700">Commentaire</span>
                  <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className={CHAMP} />
                </label>
                <button onClick={cloturer} disabled={enCours} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 font-bold text-white disabled:opacity-60">
                  <Lock className="h-4 w-4" /> {enCours ? 'Clôture...' : 'Clôturer la journée'}
                </button>
                <p className="text-xs text-stone-500">La journée doit être terminée. La clôture fige le bilan et les objectifs du site pour cette date ; elle s'annule avec un motif.</p>
              </>
            )}
          </div>
        )}
        <Provenance source="production_journee et clotures_planification ; réalisé = voyages livrés, tonnage accepté sinon reçu sinon chargé" heure={heure} />
      </Panneau>

      <Panneau
        titre="Rapport de production"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={periode.debut} onChange={(e) => setPeriode({ ...periode, debut: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1 text-sm" aria-label="Début du rapport" />
            <input type="date" value={periode.fin} onChange={(e) => setPeriode({ ...periode, fin: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1 text-sm" aria-label="Fin du rapport" />
            <button onClick={() => exportToCSV((rapport ?? []).map((l) => ({
              date: l.date_plan, site: l.site, statut: l.statut === 'close' ? 'clos' : 'non clos', planifie_t: l.tonnes_cible, realise_t: l.tonnes_livrees,
              ecart_t: l.ecart, realisation_pct: l.realisation_pct, voyages_livres: l.voyages_livres, causes: l.causes, source: l.source,
            })), 'rapport_production')} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Exporter le rapport">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={() => printDocument('rapport-production', 'Rapport de production')} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Imprimer le rapport">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div id="rapport-production" className="overflow-x-auto">
          {rapport === null ? <p className="text-sm text-stone-400">Chargement...</p> : rapport.length === 0 ? (
            <SansDonnees message="Aucune production" detail="Ni objectif, ni voyage livré, ni clôture sur la période." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3 text-right">Planifié</th><th className="py-2 pr-3 text-right">Réalisé</th><th className="py-2 pr-3 text-right">Écart</th>
                  <th className="py-2 pr-3 text-right">%</th><th className="py-2">Causes</th>
                </tr>
              </thead>
              <tbody>
                {rapport.map((l) => (
                  <tr key={`${l.date_plan}-${l.site_id}`} className="border-t border-stone-100 align-top">
                    <td className="py-2 pr-3">{jourFr(l.date_plan)}</td>
                    <td className="py-2 pr-3">{l.site ?? '—'}</td>
                    <td className="py-2 pr-3">{l.statut === 'close' ? <Puce teinte="vert">Clos</Puce> : <Puce teinte="gris">Non clos</Puce>}</td>
                    <td className="py-2 pr-3 text-right">{t(l.tonnes_cible)}</td>
                    <td className="py-2 pr-3 text-right">{t(l.tonnes_livrees)}</td>
                    <td className="py-2 pr-3 text-right">{l.ecart === null ? '—' : t(l.ecart)}</td>
                    <td className="py-2 pr-3 text-right">{l.realisation_pct === null ? '—' : `${formatNombre(Number(l.realisation_pct), 1)} %`}</td>
                    <td className="py-2 text-xs text-stone-600">{l.causes ?? (l.statut === 'close' ? 'Aucune cause saisie' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Provenance source="rapport_production : journées closes = bilan figé ; non closes = calculées à la lecture (objectif de journée, sinon somme des shifts)" />
      </Panneau>

      {annulation && (
        <Fenetre
          titre="Annuler la clôture"
          onFermer={() => setAnnulation(false)}
          largeur="max-w-lg"
          pied={<>
            <button onClick={() => setAnnulation(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Retour</button>
            <button onClick={annuler} disabled={enCours || !motif.trim()} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Annuler la clôture</button>
          </>}
        >
          <div className="space-y-3 px-6 py-5 text-sm">
            <p className="text-stone-600">La clôture reste dans l'historique avec son motif ; les objectifs redeviennent modifiables.</p>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">Motif (obligatoire)</span>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} />
            </label>
          </div>
        </Fenetre>
      )}
    </div>
  );
};
