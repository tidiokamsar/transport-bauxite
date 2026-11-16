import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Save, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { donneesReleveKogon, enregistrerBrouillon, lireBrouillons, supprimerBrouillon, type BrouillonKogon } from './pesee';
import { CHAMP, dateHeure, nombre, type ContextePesee } from './peseeContexte';

// Espace B : fiches terrain KOGON (source B). L'agent KOGON ne pese pas : il
// releve ce qu'il observe de la pesee CBG. Brouillon enregistre dans le
// navigateur (cle par fiche), envoi explicite ; l'identifiant de saisie rend
// le renvoi sans doublon. Correction = nouvelle fiche motivee qui remplace la
// precedente (conservee). Pas de mode hors ligne complet (D-081).

interface ReleveKogon {
  id: string; client_id: string; origine: 'fiche_terrain' | 'rotation'; site_id: string | null; trip_id: string | null; agent: string | null;
  ticket: string | null; heure_pesee_observee: string | null; immatriculation_observee: string | null; chauffeur_observe: string | null;
  brut: number | null; tare: number | null; net: number | null; observations: string | null; anomalie_signalee: boolean; anomalie_texte: string | null;
  remplace_id: string | null; motif_remplacement: string | null; saisi_le: string;
}
interface SansTicket { id: string; reference: string; planned_date: string; vehicle_id: string | null }

const CHAMPS_TEXTE: [string, string, string?][] = [
  ['agent', 'Agent KOGON'], ['ticket', 'N° du ticket CBG observé'], ['heure_pesee_observee', 'Heure de pesée observée', 'datetime-local'],
  ['immatriculation_observee', 'Camion observé'], ['chauffeur_observe', 'Chauffeur observé'],
  ['brut', 'Brut observé (t)'], ['tare', 'Tare observée (t)'], ['net', 'Net observé (t)'],
  ['latitude', 'Latitude (facultatif)'], ['longitude', 'Longitude (facultatif)'],
];

const nouveau = (site: string): BrouillonKogon => ({
  client_id: crypto.randomUUID(), site_id: site, trip_id: '', champs: {}, anomalie: false, modifie_le: new Date().toISOString(),
});

export const PeseeFichesKogon = ({ ctx }: { ctx: ContextePesee }) => {
  const [releves, setReleves] = useState<ReleveKogon[] | null>(null);
  const [sansTicket, setSansTicket] = useState<SansTicket[]>([]);
  const [brouillons, setBrouillons] = useState<BrouillonKogon[]>(() => lireBrouillons());
  const [b, setB] = useState<BrouillonKogon>(() => nouveau(ctx.sites.length === 1 ? ctx.sites[0].id : ''));
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.from('v_releves_terrain_kogon_effectifs').select('id, client_id, origine, site_id, trip_id, agent, ticket, heure_pesee_observee, immatriculation_observee, chauffeur_observe, brut, tare, net, observations, anomalie_signalee, anomalie_texte, remplace_id, motif_remplacement, saisi_le')
        .order('saisi_le', { ascending: false }).limit(200),
      supabase.from('v_voyages_livres_sans_ticket').select('id, reference, planned_date, vehicle_id').order('planned_date', { ascending: false }).limit(200),
    ]);
    setErreur(r.error?.message ?? s.error?.message ?? '');
    setReleves((r.data ?? []) as ReleveKogon[]);
    setSansTicket((s.data ?? []) as SansTicket[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(ctx.sites.map((s) => [s.id, s.libelle])), [ctx.sites]);
  const refVoyage = useMemo(() => new Map(ctx.voyages.map((v) => [v.id, v.reference])), [ctx.voyages]);
  const voyagesDuSite = ctx.voyages.filter((v) => b.site_id && (v.departure_site_id === b.site_id || v.arrival_site_id === b.site_id));
  const c = (k: string) => b.champs[k] ?? '';
  const poser = (k: string, v: string) => setB({ ...b, champs: { ...b.champs, [k]: v }, modifie_le: new Date().toISOString() });

  const garderBrouillon = () => {
    if (enregistrerBrouillon(b)) { setBrouillons(lireBrouillons()); setMessage('Brouillon enregistré sur ce poste (non envoyé).'); }
    else setErreur('Stockage local indisponible : le brouillon n\'a pas pu être enregistré.');
  };
  const envoyer = async (x: BrouillonKogon) => {
    setBusy(true); setErreur(''); setMessage('');
    const { data, error } = await supabase.rpc('saisir_releve_terrain_kogon', {
      p_client_id: x.client_id, p_site_id: x.site_id, p_trip_id: x.trip_id || null, p_donnees: donneesReleveKogon(x.champs, x.anomalie),
    });
    setBusy(false);
    if (error) { enregistrerBrouillon(x); setBrouillons(lireBrouillons()); setErreur(`${error.message} (brouillon conservé sur ce poste)`); return; }
    supprimerBrouillon(x.client_id); setBrouillons(lireBrouillons());
    setMessage((data as { deja_enregistre?: boolean } | null)?.deja_enregistre ? 'Fiche déjà reçue par le serveur : aucun doublon créé.' : 'Fiche terrain enregistrée.');
    if (x.client_id === b.client_id) setB(nouveau(b.site_id));
    await charger();
  };
  const corriger = (r: ReleveKogon) => setB({
    client_id: crypto.randomUUID(), site_id: r.site_id ?? '', trip_id: r.trip_id ?? '', anomalie: r.anomalie_signalee, modifie_le: new Date().toISOString(),
    champs: Object.fromEntries(Object.entries({
      agent: r.agent, ticket: r.ticket, immatriculation_observee: r.immatriculation_observee, chauffeur_observe: r.chauffeur_observe,
      brut: r.brut, tare: r.tare, net: r.brut !== null && r.tare !== null ? null : r.net, observations: r.observations, anomalie_texte: r.anomalie_texte,
      heure_pesee_observee: r.heure_pesee_observee ? r.heure_pesee_observee.slice(0, 16) : null, remplace_id: r.id,
    }).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)])),
  });
  const exporter = () => exportToCSV((releves ?? []).map((r) => ({
    Saisi_le: r.saisi_le, Origine: r.origine === 'rotation' ? 'Saisi avec la rotation' : 'Fiche terrain', Site: r.site_id ? nomSite.get(r.site_id) ?? '' : '',
    Voyage: r.trip_id ? refVoyage.get(r.trip_id) ?? '' : '', Agent: r.agent ?? '', Ticket_observe: r.ticket ?? '', Heure_observee: r.heure_pesee_observee ?? '',
    Camion_observe: r.immatriculation_observee ?? '', Chauffeur_observe: r.chauffeur_observe ?? '', Brut_t: r.brut ?? '', Tare_t: r.tare ?? '', Net_t: r.net ?? '',
    Anomalie_agent: r.anomalie_signalee ? r.anomalie_texte ?? '' : '', Observations: r.observations ?? '', Correction_de: r.motif_remplacement ?? '',
  })), 'releves-terrain-kogon');

  const pret = !!b.site_id && (!!c('ticket').trim() || !!c('net').trim() || (!!c('brut').trim() && !!c('tare').trim()))
    && (!b.anomalie || !!c('anomalie_texte').trim()) && (!c('remplace_id') || !!c('motif_remplacement').trim());

  return <div className="space-y-5">
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {ctx.peutEcrire && <Panneau titre={c('remplace_id') ? 'Corriger une fiche terrain KOGON' : 'Fiche terrain KOGON : ce que l\'agent observe de la pesée CBG'}>
      <p className="mb-2 text-xs text-stone-500">L'agent ne pèse pas : il recopie le ticket CBG qu'il voit. Cette fiche ne remplace jamais le relevé officiel CBG. Tout est en tonnes.</p>
      {ctx.sites.length === 0 ? <ReferentielVide>{SANS_SITE}</ReferentielVide> : <div role="form" aria-label="Fiche terrain KOGON" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Site *<select value={b.site_id} onChange={(e) => setB({ ...b, site_id: e.target.value, trip_id: '' })} className={CHAMP}><option value="">Choisir</option>{ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
          <label className="text-sm">Rotation (si connue)<select value={b.trip_id} onChange={(e) => setB({ ...b, trip_id: e.target.value })} disabled={!b.site_id} className={CHAMP}>
            <option value="">Non identifiée</option>{voyagesDuSite.map((v) => <option key={v.id} value={v.id}>{v.reference} · {v.planned_date} · {ctx.engins.get(v.vehicle_id ?? '') ?? 'sans camion'}</option>)}</select></label>
          {CHAMPS_TEXTE.map(([k, l, type]) => <label key={k} className="text-sm">{l}<input type={type ?? 'text'} inputMode={['brut', 'tare', 'net', 'latitude', 'longitude'].includes(k) ? 'decimal' : undefined}
            value={c(k)} onChange={(e) => poser(k, e.target.value)} className={CHAMP} /></label>)}
        </div>
        <label className="block text-sm">Observations<textarea value={c('observations')} onChange={(e) => poser('observations', e.target.value)} rows={2} className={CHAMP} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.anomalie} onChange={(e) => setB({ ...b, anomalie: e.target.checked })} /> L'agent signale une anomalie</label>
        {b.anomalie && <label className="block text-sm">Anomalie constatée *<input value={c('anomalie_texte')} onChange={(e) => poser('anomalie_texte', e.target.value)} className={CHAMP} /></label>}
        {c('remplace_id') && <label className="block text-sm">Motif de la correction *<input value={c('motif_remplacement')} onChange={(e) => poser('motif_remplacement', e.target.value)} className={CHAMP} /></label>}
        <div className="flex flex-wrap gap-2">
          <button onClick={garderBrouillon} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm"><Save className="h-4 w-4" /> Enregistrer le brouillon</button>
          <button disabled={busy || !pret} onClick={() => envoyer(b)} className="flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Envoyer la fiche</button>
          {c('remplace_id') && <button onClick={() => setB(nouveau(b.site_id))} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Abandonner la correction</button>}
        </div>
      </div>}
    </Panneau>}

    {brouillons.length > 0 && <Panneau titre={`Brouillons sur ce poste (${brouillons.length})`}>
      <ul className="divide-y divide-stone-100 text-sm">{brouillons.map((x) => <li key={x.client_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span>{x.champs.ticket ? <span className="font-mono">{x.champs.ticket}</span> : 'Sans ticket'} · {nomSite.get(x.site_id) ?? 'site à choisir'} · modifié {dateHeure(x.modifie_le)}</span>
        <span className="flex gap-1">
          <button onClick={() => setB(x)} className="rounded border border-stone-300 px-2 py-1 text-xs">Reprendre</button>
          {ctx.peutEcrire && <button disabled={busy || !x.site_id} onClick={() => envoyer(x)} aria-label={`Envoyer le brouillon ${x.champs.ticket ?? ''}`} className="rounded bg-stone-800 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Envoyer</button>}
          <button onClick={() => { supprimerBrouillon(x.client_id); setBrouillons(lireBrouillons()); }} aria-label="Supprimer le brouillon" className="rounded border border-stone-300 px-2 py-1 text-xs"><Trash2 className="h-3 w-3" /></button>
        </span></li>)}</ul>
    </Panneau>}

    <Panneau titre="Relevés terrain KOGON en vigueur" action={<button onClick={exporter} disabled={!releves?.length} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Exporter CSV</button>}>
      {releves === null ? <p className="text-sm text-stone-500">Chargement des relevés…</p> : releves.length === 0 ? <SansDonnees message="Aucun relevé terrain KOGON" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Ticket observé</th><th className="py-2 pr-3">Pesée observée</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Rotation</th><th className="py-2 pr-3">Camion</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2 pr-3">Origine</th><th className="py-2" /></tr></thead>
          <tbody>{releves.map((r) => <tr key={r.id} className="border-b border-stone-100">
            <td className="py-2 pr-3 font-mono">{r.ticket ?? '-'}</td><td className="py-2 pr-3">{dateHeure(r.heure_pesee_observee)}</td>
            <td className="py-2 pr-3">{r.site_id ? nomSite.get(r.site_id) ?? '-' : '-'}</td><td className="py-2 pr-3">{r.trip_id ? refVoyage.get(r.trip_id) ?? 'hors liste' : <Puce teinte="orange">Non identifiée</Puce>}</td>
            <td className="py-2 pr-3">{r.immatriculation_observee ?? '-'}</td><td className="py-2 pr-3 text-right">{nombre(r.net)}</td>
            <td className="py-2 pr-3">{r.origine === 'rotation' ? <Puce teinte="gris">Saisi avec la rotation</Puce> : <Puce teinte="bleu">Fiche terrain</Puce>}
              {r.anomalie_signalee && <Puce teinte="rouge">Anomalie : {r.anomalie_texte}</Puce>}{r.remplace_id && <span className="ml-1 text-xs text-stone-500">corrige ({r.motif_remplacement})</span>}</td>
            <td className="py-2">{ctx.peutEcrire && r.origine === 'fiche_terrain' && <button onClick={() => corriger(r)} className="rounded border border-stone-300 px-2 py-1 text-xs">Corriger</button>}</td>
          </tr>)}</tbody></table></div>}
    </Panneau>

    <Panneau titre={`Voyages livrés sans ticket CBG (${sansTicket.length})`}>
      {sansTicket.length === 0 ? <SansDonnees message="Tous les voyages livrés ont un ticket" /> :
        <ul className="divide-y divide-stone-100 text-sm">{sansTicket.map((v) => <li key={v.id} className="py-1.5"><span className="font-mono">{v.reference}</span> · {v.planned_date} · {ctx.engins.get(v.vehicle_id ?? '') ?? '-'}</li>)}</ul>}
    </Panneau>
  </div>;
};
