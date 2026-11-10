import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Download, PenLine, Plus, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';
import {
  CAUSES, IMPUTATIONS, bornesMois, disponibilite, formatDuree, heuresDansPeriode, totalParImputation,
  type Immobilisation, type Imputation,
} from './immobilisations';
import {
  AnnulerImmobilisation, CloturerImmobilisation, CorrigerImmobilisation, DeclarerImmobilisation, type EnginResume,
} from './FenetresImmobilisation';

// Immobilisations des engins loues (D-022, D-025) : qui est arrete, depuis
// quand, pourquoi, a la charge de qui. Base du rapprochement des heures
// avec le loueur et de la disponibilite vue par la planification et le
// dispatch.

const moisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const horodatage = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Fenetre =
  | { type: 'declarer' }
  | { type: 'cloturer' | 'corriger' | 'annuler'; immobilisation: Immobilisation };

export const ImmobilisationsView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [mois, setMois] = useState(moisCourant);
  const [engins, setEngins] = useState<EnginResume[]>([]);
  const [liste, setListe] = useState<Immobilisation[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);

  const { du, au } = useMemo(() => bornesMois(mois), [mois]);

  const charger = useCallback(async () => {
    const [rE, rI] = await Promise.all([
      supabase.from('vehicles').select('id, registration, vehicle_type, status').order('registration'),
      supabase.from('immobilisations')
        .select('id, vehicle_id, debut, fin, cause, imputation, description, reference_loueur, statut')
        .neq('statut', 'annulee')
        .lt('debut', au.toISOString())
        .or(`fin.is.null,fin.gt.${du.toISOString()}`)
        .order('debut', { ascending: false }),
    ]);
    setEngins((rE.data ?? []) as EnginResume[]);
    if (rI.error) {
      setErreur('Immobilisations indisponibles : ' + rI.error.message);
      setListe([]);
    } else {
      setErreur('');
      setListe((rI.data ?? []) as Immobilisation[]);
    }
    setHeure(new Date());
  }, [du, au]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  const maintenant = useMemo(() => heure ?? new Date(), [heure]);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const flotte = engins.filter((e) => e.status !== 'sold');
  const ouvertes = (liste ?? []).filter((i) => i.statut === 'ouverte');
  const totaux = totalParImputation(liste ?? [], du, au, maintenant);
  const totalHeures = totaux.loueur + totaux.exploitant + totaux.a_determiner;
  const dispo = disponibilite(totalHeures, flotte.length, du, au, maintenant);
  const sansOuverte = flotte.filter((e) => !ouvertes.some((i) => i.vehicle_id === e.id));

  const parEngin = useMemo(() => {
    const lignes = new Map<string, Record<Imputation, number> & { episodes: number }>();
    for (const i of liste ?? []) {
      const l = lignes.get(i.vehicle_id) ?? { loueur: 0, exploitant: 0, a_determiner: 0, episodes: 0 };
      l[i.imputation] += heuresDansPeriode(i, du, au, maintenant);
      l.episodes += 1;
      lignes.set(i.vehicle_id, l);
    }
    return [...lignes.entries()].sort((a, b) => (immat.get(a[0]) ?? '').localeCompare(immat.get(b[0]) ?? ''));
  }, [liste, du, au, maintenant, immat]);

  const libelle = (i: Immobilisation) => `${immat.get(i.vehicle_id) ?? 'Engin'} · ${CAUSES[i.cause]} depuis le ${horodatage(i.debut)}`;

  const exporter = () => {
    const lignes = (liste ?? []).map((i) => ({
      Engin: immat.get(i.vehicle_id) ?? i.vehicle_id,
      Debut: new Date(i.debut).toLocaleString('fr-FR'),
      Fin: i.fin ? new Date(i.fin).toLocaleString('fr-FR') : 'en cours',
      Heures_dans_le_mois: heuresDansPeriode(i, du, au, maintenant).toFixed(2),
      Cause: CAUSES[i.cause],
      Imputation: IMPUTATIONS[i.imputation].libelle,
      Reference_loueur: i.reference_loueur ?? '',
      Description: i.description,
    }));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + buildCSV(lignes)], { type: 'text/csv;charset=utf-8' }));
    lien.download = `immobilisations-${mois}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const fermer = () => setFenetre(null);
  const fait = () => { setFenetre(null); charger(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Immobilisations</h2>
          <p className="text-stone-500">Engins loués à Nimba Mining : arrêts, durée et imputation (loueur ou exploitant)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <button onClick={exporter} disabled={!liste || liste.length === 0} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Exporter
          </button>
          {peutEcrire && (
            <button onClick={() => setFenetre({ type: 'declarer' })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Déclarer une immobilisation
            </button>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Synthèse du mois">
        {[
          ['Engins arrêtés maintenant', liste ? `${ouvertes.length} / ${flotte.length}` : '—'],
          ['Disponibilité du mois', dispo === null ? '—' : `${formatNombre(dispo, 1)} %`],
          ['Heures à la charge du loueur', liste ? `${formatNombre(totaux.loueur, 1)} h` : '—'],
          ['Heures à la charge de l\'exploitant', liste ? `${formatNombre(totaux.exploitant, 1)} h` : '—'],
          ['Heures à imputer', liste ? `${formatNombre(totaux.a_determiner, 1)} h` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="text-sm text-stone-500">{l}</p>
            <p className="text-2xl font-black text-stone-900">{v}</p>
          </div>
        ))}
      </section>
      {totaux.a_determiner > 0 && (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
          {formatNombre(totaux.a_determiner, 1)} h restent à imputer : à trancher avant le rapprochement des heures avec le loueur.
        </p>
      )}
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      <Panneau titre={`Arrêts en cours (${ouvertes.length})`}>
        {liste === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : ouvertes.length === 0 ? (
          <SansDonnees message="Aucun engin arrêté" detail="Tous les engins sont en service." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {ouvertes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-stone-900">
                    {immat.get(i.vehicle_id) ?? 'Engin'} <span className="ml-2 font-normal text-stone-500">{CAUSES[i.cause]}</span>
                    <span className="ml-2"><Puce teinte={IMPUTATIONS[i.imputation].teinte}>{IMPUTATIONS[i.imputation].libelle}</Puce></span>
                  </p>
                  <p className="text-stone-600">{i.description}{i.reference_loueur ? ` · réf. ${i.reference_loueur}` : ''}</p>
                  <p className="text-xs text-stone-500">Depuis le {horodatage(i.debut)} · <b className="text-red-700">{formatDuree(heuresDansPeriode(i, new Date(0), new Date(8.64e15), maintenant))}</b></p>
                </div>
                {peutEcrire && (
                  <div className="flex gap-1">
                    <button onClick={() => setFenetre({ type: 'cloturer', immobilisation: i })} className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100">
                      <Wrench className="inline h-3.5 w-3.5" /> Remettre en service
                    </button>
                    <button onClick={() => setFenetre({ type: 'corriger', immobilisation: i })} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label={`Corriger ${immat.get(i.vehicle_id)}`}>
                      <PenLine className="h-4 w-4" />
                    </button>
                    <button onClick={() => setFenetre({ type: 'annuler', immobilisation: i })} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Annuler ${immat.get(i.vehicle_id)}`}>
                      <Ban className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panneau titre="Arrêts du mois" className="xl:col-span-8">
          {!liste || liste.length === 0 ? (
            <SansDonnees message="Aucun arrêt ce mois-ci" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2 pr-3 font-medium">Engin</th>
                    <th className="py-2 pr-3 font-medium">Début</th>
                    <th className="py-2 pr-3 font-medium">Fin</th>
                    <th className="py-2 pr-3 text-right font-medium">Durée (mois)</th>
                    <th className="py-2 pr-3 font-medium">Cause</th>
                    <th className="py-2 pr-3 font-medium">Imputation</th>
                    {peutEcrire && <th className="py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((i) => (
                    <tr key={i.id} className="border-b border-stone-100 last:border-0" title={i.description}>
                      <td className="py-2 pr-3 font-semibold text-stone-900">{immat.get(i.vehicle_id) ?? '—'}</td>
                      <td className="py-2 pr-3 text-stone-700">{horodatage(i.debut)}</td>
                      <td className="py-2 pr-3 text-stone-700">{i.fin ? horodatage(i.fin) : <span className="font-medium text-red-700">en cours</span>}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-stone-900">{formatDuree(heuresDansPeriode(i, du, au, maintenant))}</td>
                      <td className="py-2 pr-3 text-stone-700">{CAUSES[i.cause]}</td>
                      <td className="py-2 pr-3"><Puce teinte={IMPUTATIONS[i.imputation].teinte}>{IMPUTATIONS[i.imputation].libelle}</Puce></td>
                      {peutEcrire && (
                        <td className="py-2 text-right">
                          <button onClick={() => setFenetre({ type: 'corriger', immobilisation: i })} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label={`Corriger l'arrêt de ${immat.get(i.vehicle_id)} du ${horodatage(i.debut)}`}>
                            <PenLine className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>

        <Panneau titre="Heures par engin" className="xl:col-span-4">
          {parEngin.length === 0 ? (
            <SansDonnees message="Sans données" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-2 font-medium">Engin</th>
                  <th className="py-2 pr-2 text-right font-medium">Loueur</th>
                  <th className="py-2 pr-2 text-right font-medium">Exploitant</th>
                  <th className="py-2 text-right font-medium">À imputer</th>
                </tr>
              </thead>
              <tbody>
                {parEngin.map(([id, l]) => (
                  <tr key={id} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-stone-900">{immat.get(id) ?? '—'}</td>
                    <td className="py-2 pr-2 text-right">{formatNombre(l.loueur, 1)} h</td>
                    <td className="py-2 pr-2 text-right">{formatNombre(l.exploitant, 1)} h</td>
                    <td className="py-2 text-right">{formatNombre(l.a_determiner, 1)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panneau>
      </div>
      <Provenance source="immobilisations déclarées (heures réelles de début et de fin), bornées au mois ; disponibilité = 1 - heures d'arrêt / (engins x heures écoulées)" heure={heure} />

      {fenetre?.type === 'declarer' && <DeclarerImmobilisation engins={sansOuverte} onFermer={fermer} onFait={fait} />}
      {fenetre?.type === 'cloturer' && <CloturerImmobilisation immobilisation={fenetre.immobilisation} libelle={libelle(fenetre.immobilisation)} onFermer={fermer} onFait={fait} />}
      {fenetre?.type === 'corriger' && <CorrigerImmobilisation immobilisation={fenetre.immobilisation} libelle={libelle(fenetre.immobilisation)} onFermer={fermer} onFait={fait} />}
      {fenetre?.type === 'annuler' && <AnnulerImmobilisation immobilisation={fenetre.immobilisation} libelle={libelle(fenetre.immobilisation)} onFermer={fermer} onFait={fait} />}
    </div>
  );
};
