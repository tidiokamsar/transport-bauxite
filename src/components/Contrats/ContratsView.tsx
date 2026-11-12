import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilePlus2, History, PenLine, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import {
  INDICATEURS, NATURES, PERIODICITES, STATUTS, UNITES_TARIF, libelleVersion, versionEnVigueur,
  type Contrat, type Engagement, type EntreeJournal, type Tarif, type Version,
} from './types';
import { FormulaireContrat, FormulaireEngagement, FormulaireTarif, FormulaireVersion } from './Formulaires';

// Dossier contractuel (phase 1 du poste « Charge de contrats et
// facturation », D-026) : contrats CBG et Neemba, contrat initial et
// avenants, tarifs et engagements de chaque version, journal.

const date = (iso: string | null) => (iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR') : '—');
const aujourdhui = () => new Date().toISOString().slice(0, 10);

type Fenetre =
  | { type: 'contrat'; contrat?: Contrat }
  | { type: 'version'; version?: Version }
  | { type: 'tarif'; versionId: string; tarif?: Tarif }
  | { type: 'engagement'; versionId: string; engagement?: Engagement };

const TABLES: Record<string, string> = {
  contrats: 'Contrat', contrat_versions: 'Version', contrat_tarifs: 'Tarif', contrat_engagements: 'Engagement',
};
const ACTIONS: Record<string, string> = { INSERT: 'création', UPDATE: 'modification', DELETE: 'suppression' };

export const ContratsView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<Contrat[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [voirJournal, setVoirJournal] = useState(false);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);

  const chargerListe = useCallback(async () => {
    const { data, error } = await supabase.from('contrats')
      .select('id, reference, intitule, nature, contrepartie, devise, date_debut, date_fin, statut, delai_paiement_jours, description')
      .order('reference');
    if (error) setErreur('Contrats indisponibles : ' + error.message);
    const liste = (data ?? []) as Contrat[];
    setContrats(liste);
    setChoisi((c) => c ?? liste[0]?.id ?? null);
    setHeure(new Date());
  }, []);

  const chargerDetail = useCallback(async () => {
    if (!choisi) return;
    const { data: v } = await supabase.from('contrat_versions')
      .select('id, contrat_id, numero, intitule, date_effet, date_signature, resume, document_ref')
      .eq('contrat_id', choisi).order('numero');
    const liste = (v ?? []) as Version[];
    setVersions(liste);
    const { data: veh } = await supabase.from('vehicles').select('id, registration').order('registration');
    setEngins((veh as { id: string; registration: string }[] | null) ?? []);
    const ids = liste.map((x) => x.id);
    if (ids.length > 0) {
      const [t, e] = await Promise.all([
        supabase.from('contrat_tarifs').select('*').in('version_id', ids).order('ordre'),
        supabase.from('contrat_engagements').select('*').in('version_id', ids).order('ordre'),
      ]);
      setTarifs((t.data ?? []) as Tarif[]);
      setEngagements((e.data ?? []) as Engagement[]);
    } else {
      setTarifs([]);
      setEngagements([]);
    }
    const { data: j } = await supabase.from('journal_contrats')
      .select('id, table_cible, action, avant, apres, le').eq('contrat_id', choisi).order('le', { ascending: false }).limit(100);
    setJournal((j ?? []) as EntreeJournal[]);
  }, [choisi]);

  useEffect(() => { chargerListe(); }, [chargerListe]);
  useEffect(() => { chargerDetail(); }, [chargerDetail]);

  const contrat = contrats?.find((c) => c.id === choisi) ?? null;
  const enVigueur = useMemo(() => versionEnVigueur(versions, aujourdhui()), [versions]);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);

  const supprimer = async (table: string, id: string, quoi: string) => {
    if (!window.confirm(`Supprimer ${quoi} ? La suppression reste tracée au journal du contrat.`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setErreur(error.message);
    if (table === 'contrats') { setChoisi(null); chargerListe(); } else chargerDetail();
  };

  const fait = () => { setFenetre(null); chargerListe(); chargerDetail(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Dossier contractuel</h2>
          <p className="text-stone-500">Contrats, avenants, tarifs et engagements ; chaque modification est tracée</p>
        </div>
        {peutEcrire && (
          <button onClick={() => setFenetre({ type: 'contrat' })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
            <Plus className="h-4 w-4" /> Nouveau contrat
          </button>
        )}
      </div>
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {contrats === null ? (
        <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
      ) : contrats.length === 0 ? (
        <Panneau><SansDonnees message="Aucun contrat" detail="Saisissez les contrats CBG et Neemba, puis leurs avenants, tarifs et engagements." /></Panneau>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <nav className="space-y-2 xl:col-span-4" aria-label="Contrats">
            {contrats.map((c) => (
              <button
                key={c.id}
                onClick={() => { setChoisi(c.id); setVoirJournal(false); }}
                className={`w-full rounded-2xl border p-4 text-left shadow-carte transition ${choisi === c.id ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white hover:border-orange-200'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-stone-900">{c.reference}</p>
                  <Puce teinte={STATUTS[c.statut].teinte}>{STATUTS[c.statut].libelle}</Puce>
                </div>
                <p className="text-sm text-stone-700">{c.contrepartie} · {c.intitule}</p>
                <p className="text-xs text-stone-500">{NATURES[c.nature]} · {c.devise} · depuis le {date(c.date_debut)}</p>
              </button>
            ))}
          </nav>

          {contrat && (
            <div className="space-y-6 xl:col-span-8">
              <Panneau
                titre={`${contrat.reference} · ${contrat.contrepartie}`}
                action={
                  <div className="flex gap-1">
                    <button onClick={() => setVoirJournal((x) => !x)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Journal du contrat" title="Journal">
                      <History className="h-4 w-4" />
                    </button>
                    {peutEcrire && (
                      <button onClick={() => setFenetre({ type: 'contrat', contrat })} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Modifier le contrat" title="Modifier">
                        <PenLine className="h-4 w-4" />
                      </button>
                    )}
                    {peutEcrire && contrat.statut === 'brouillon' && (
                      <button onClick={() => supprimer('contrats', contrat.id, `le contrat ${contrat.reference}`)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="Supprimer le contrat" title="Supprimer (brouillon)">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                }
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-stone-500">Intitulé</dt><dd className="font-semibold text-stone-900">{contrat.intitule}</dd></div>
                  <div><dt className="text-stone-500">Nature</dt><dd className="font-semibold text-stone-900">{NATURES[contrat.nature]}</dd></div>
                  <div><dt className="text-stone-500">Période</dt><dd className="font-semibold text-stone-900">{date(contrat.date_debut)} – {contrat.date_fin ? date(contrat.date_fin) : 'en cours'}</dd></div>
                  <div><dt className="text-stone-500">Délai de paiement</dt><dd className="font-semibold text-stone-900">{contrat.delai_paiement_jours !== null ? `${contrat.delai_paiement_jours} jours` : 'Non saisi'}</dd></div>
                </dl>
                {contrat.description && <p className="mt-3 text-sm text-stone-600">{contrat.description}</p>}
                <p className="mt-3 text-sm text-stone-600">
                  Version en vigueur : <b>{enVigueur ? libelleVersion(enVigueur) : 'aucune (saisir le contrat initial)'}</b>
                </p>
              </Panneau>

              {voirJournal && (
                <Panneau titre="Journal du contrat">
                  {journal.length === 0 ? <SansDonnees message="Aucune entrée" /> : (
                    <ul className="divide-y divide-stone-100 text-sm">
                      {journal.map((j) => (
                        <li key={j.id} className="py-2">
                          <span className="text-stone-500">{new Date(j.le).toLocaleString('fr-FR')}</span>
                          <span className="ml-2 font-semibold text-stone-900">{TABLES[j.table_cible] ?? j.table_cible} : {ACTIONS[j.action] ?? j.action}</span>
                          {j.action === 'UPDATE' && j.avant && j.apres && (
                            <span className="ml-2 text-stone-600">
                              {Object.keys(j.apres).filter((k) => JSON.stringify(j.apres?.[k]) !== JSON.stringify(j.avant?.[k]))
                                .map((k) => `${k} : ${String(j.avant?.[k] ?? '—')} → ${String(j.apres?.[k] ?? '—')}`).join(' ; ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panneau>
              )}

              <Panneau
                titre="Contrat initial et avenants"
                action={peutEcrire && (
                  <button onClick={() => setFenetre({ type: 'version' })} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                    <FilePlus2 className="h-4 w-4" /> {versions.length === 0 ? 'Contrat initial' : 'Nouvel avenant'}
                  </button>
                )}
              >
                {versions.length === 0 ? <SansDonnees message="Aucune version" detail="Saisissez le contrat initial (version 0), puis les avenants." /> : (
                  <div className="space-y-4">
                    {[...versions].reverse().map((v) => {
                      const tv = tarifs.filter((t) => t.version_id === v.id);
                      const ev = engagements.filter((e) => e.version_id === v.id);
                      return (
                        <section key={v.id} className={`rounded-xl border p-4 ${enVigueur?.id === v.id ? 'border-green-300 bg-green-50/40' : 'border-stone-200'}`} aria-label={libelleVersion(v)}>
                          <header className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-stone-900">{libelleVersion(v)}</p>
                              <p className="text-xs text-stone-500">
                                Effet le {date(v.date_effet)}{v.date_signature ? ` · signé le ${date(v.date_signature)}` : ''}{v.document_ref ? ` · document : ${v.document_ref}` : ''}
                                {enVigueur?.id === v.id && <b className="ml-1 text-green-700">· en vigueur</b>}
                              </p>
                              {v.resume && <p className="mt-1 text-sm text-stone-600">{v.resume}</p>}
                            </div>
                            {peutEcrire && (
                              <div className="flex gap-1">
                                <button onClick={() => setFenetre({ type: 'version', version: v })} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label={`Modifier ${libelleVersion(v)}`}><PenLine className="h-4 w-4" /></button>
                                <button onClick={() => supprimer('contrat_versions', v.id, libelleVersion(v))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label={`Supprimer ${libelleVersion(v)}`}><Trash2 className="h-4 w-4" /></button>
                              </div>
                            )}
                          </header>

                          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-stone-700">Tarifs</h4>
                                {peutEcrire && <button onClick={() => setFenetre({ type: 'tarif', versionId: v.id })} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter un tarif</button>}
                              </div>
                              {tv.length === 0 ? <p className="text-xs text-stone-400">Aucun tarif dans cette version.</p> : (
                                <ul className="space-y-1 text-sm">
                                  {tv.map((t) => (
                                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1">
                                      <span>{t.libelle}{t.engin ? ` · ${immat.get(t.engin) ?? 'engin retiré'}` : t.categorie_materiel ? ` (${t.categorie_materiel})` : ''}</span>
                                      <span className="flex items-center gap-1 font-semibold text-stone-900">
                                        {formatNombre(Number(t.prix), 2)} {contrat.devise} {UNITES_TARIF[t.unite] ?? t.unite}
                                        {peutEcrire && <button onClick={() => setFenetre({ type: 'tarif', versionId: v.id, tarif: t })} className="rounded p-1 text-stone-400 hover:text-stone-700" aria-label={`Modifier le tarif ${t.libelle}`}><PenLine className="h-3.5 w-3.5" /></button>}
                                        {peutEcrire && <button onClick={() => supprimer('contrat_tarifs', t.id, `le tarif ${t.libelle}`)} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Supprimer le tarif ${t.libelle}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-stone-700">Engagements</h4>
                                {peutEcrire && <button onClick={() => setFenetre({ type: 'engagement', versionId: v.id })} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter un engagement</button>}
                              </div>
                              {ev.length === 0 ? <p className="text-xs text-stone-400">Aucun engagement dans cette version.</p> : (
                                <ul className="space-y-1 text-sm">
                                  {ev.map((e) => (
                                    <li key={e.id} className="rounded-lg bg-stone-50 px-2 py-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span title={INDICATEURS[e.indicateur]}>{e.libelle}</span>
                                        <span className="flex items-center gap-1 font-semibold text-stone-900">
                                          {e.sens === 'minimum' ? '≥' : '≤'} {formatNombre(Number(e.seuil), 2)} {e.unite} {PERIODICITES[e.periodicite] ?? ''}
                                          {peutEcrire && <button onClick={() => setFenetre({ type: 'engagement', versionId: v.id, engagement: e })} className="rounded p-1 text-stone-400 hover:text-stone-700" aria-label={`Modifier l'engagement ${e.libelle}`}><PenLine className="h-3.5 w-3.5" /></button>}
                                          {peutEcrire && <button onClick={() => supprimer('contrat_engagements', e.id, `l'engagement ${e.libelle}`)} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Supprimer l'engagement ${e.libelle}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                                        </span>
                                      </div>
                                      {e.consequence && <p className="text-xs text-stone-500">{e.consequence}</p>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </Panneau>
            </div>
          )}
        </div>
      )}
      <Provenance source="dossier contractuel saisi ; journal des modifications tenu par le serveur" heure={heure} />

      {fenetre?.type === 'contrat' && <FormulaireContrat contrat={fenetre.contrat} onFermer={() => setFenetre(null)} onFait={fait} />}
      {fenetre?.type === 'version' && contrat && (
        <FormulaireVersion
          contratId={contrat.id}
          version={fenetre.version}
          numeroSuivant={versions.length === 0 ? 0 : Math.max(...versions.map((v) => v.numero)) + 1}
          onFermer={() => setFenetre(null)}
          onFait={fait}
        />
      )}
      {fenetre?.type === 'tarif' && <FormulaireTarif versionId={fenetre.versionId} tarif={fenetre.tarif} onFermer={() => setFenetre(null)} onFait={fait} />}
      {fenetre?.type === 'engagement' && <FormulaireEngagement versionId={fenetre.versionId} engagement={fenetre.engagement} onFermer={() => setFenetre(null)} onFait={fait} />}
    </div>
  );
};
