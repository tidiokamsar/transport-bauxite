import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { LIBELLES_STATUT_AFFECTATION, perimetreCompte, type AffectationSite, type PerimetreServeur } from './organisation';

// Affectations multisites (D-064) : l'administrateur affecte un compte a
// plusieurs sites, chacun pour une periode datee. site_permis applique le
// perimetre cote serveur ; l'ecran ne fait qu'afficher le perimetre calcule
// par perimetres_comptes et appeler les fonctions affecter_site,
// cloturer_affectation_site, annuler_affectation_site et
// retablir_perimetre_global.

interface Compte { id: string; full_name: string; site_id: string | null; status: string }
interface Site { id: string; name: string }
interface Ligne extends AffectationSite { utilisateur_nom: string | null; motif: string | null; motif_annulation: string | null }

const TEINTES: Record<AffectationSite['statut'], TeintePuce> = { en_cours: 'vert', a_venir: 'bleu', terminee: 'gris', annulee: 'rouge' };
const CHAMP = 'rounded border border-stone-300 px-3 py-2 text-sm';

export const AffectationsSites = () => {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [f, setF] = useState({ utilisateur: '', site: '', debut: '', fin: '', motif: '' });
  const [perimetres, setPerimetres] = useState<Map<string, PerimetreServeur>>(new Map());
  const [action, setAction] = useState<{ id: string; mode: 'cloture' | 'annulation'; date: string; motif: string } | null>(null);
  const [retour, setRetour] = useState<{ utilisateur: string; motif: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [c, s, a, p] = await Promise.all([
      supabase.from('profiles').select('id, full_name, site_id, status').order('full_name'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('v_affectations_sites').select('*').order('debut', { ascending: false }),
      supabase.rpc('perimetres_comptes'),
    ]);
    const e = c.error ?? s.error ?? a.error ?? p.error;
    if (e) setErreur(e.message);
    setComptes((c.data as Compte[] | null) ?? []);
    setSites((s.data as Site[] | null) ?? []);
    setLignes((a.data as Ligne[] | null) ?? []);
    setPerimetres(new Map(((p.data as PerimetreServeur[] | null) ?? []).map((x) => [x.utilisateur, x])));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const appeler = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setErreur(''); setMessage(''); setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(ok);
    await charger();
    return true;
  };

  const affecter = async () => {
    if (!f.utilisateur || !f.site || !f.debut) { setErreur('Compte, site et date de début sont obligatoires.'); return; }
    if (f.fin && f.fin < f.debut) { setErreur('La fin précède le début.'); return; }
    const fait = await appeler('affecter_site', {
      p_utilisateur: f.utilisateur, p_site: f.site, p_debut: f.debut, p_fin: f.fin || null, p_motif: f.motif || null,
    }, 'Affectation enregistrée.');
    if (fait) setF({ utilisateur: '', site: '', debut: '', fin: '', motif: '' });
  };

  const valider = async () => {
    if (!action) return;
    if (action.mode === 'cloture') {
      if (!action.date) { setErreur('Date de fin obligatoire.'); return; }
      if (await appeler('cloturer_affectation_site', { p_id: action.id, p_fin: action.date, p_motif: action.motif || null }, 'Affectation close.')) setAction(null);
    } else {
      if (!action.motif.trim()) { setErreur('Le motif d\'annulation est obligatoire.'); return; }
      if (await appeler('annuler_affectation_site', { p_id: action.id, p_motif: action.motif }, 'Affectation annulée.')) setAction(null);
    }
  };

  const retablir = async () => {
    if (!retour) return;
    if (!retour.motif.trim()) { setErreur('Le motif du retour au périmètre global est obligatoire.'); return; }
    if (await appeler('retablir_perimetre_global', { p_utilisateur: retour.utilisateur, p_motif: retour.motif }, 'Périmètre global rétabli.')) setRetour(null);
  };

  const actifs = comptes.filter((c) => c.status === 'active');
  const libellePerimetre = (c: Compte) => {
    const serveur = perimetres.get(c.id);
    if (!serveur) return 'Sans donnée';
    const p = perimetreCompte(serveur);
    if (p.type === 'global') return 'Tous les sites';
    if (p.type === 'aucun') return 'Aucun site en vigueur';
    return p.sites.map((s) => nomSite.get(s) ?? s).join(', ');
  };

  return (
    <div className="space-y-6">
      <Panneau titre="Affecter un compte à un site">
        <p className="mb-4 text-sm text-stone-500">
          Un compte sans site au profil ni affectation voit tous les sites. Dès qu'il a une affectation, il ne voit que le site de son profil et ses affectations en cours.
          Ni l'expiration ni l'annulation de toutes ses affectations ne le rendent global : il n'a alors accès à aucun site, jusqu'à un retour explicite et motivé au périmètre global.
        </p>
        {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {message && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-sm">Compte
            <select aria-label="Compte à affecter" value={f.utilisateur} onChange={(e) => setF({ ...f, utilisateur: e.target.value })} className={`mt-1 w-full ${CHAMP}`}>
              <option value="">Choisir</option>
              {actifs.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Site
            <select aria-label="Site d'affectation" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className={`mt-1 w-full ${CHAMP}`}>
              <option value="">Choisir</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Début
            <input aria-label="Début de l'affectation" type="date" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
          <label className="text-sm">Fin (incluse, facultative)
            <input aria-label="Fin de l'affectation" type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
          <label className="text-sm">Motif
            <input aria-label="Motif de l'affectation" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
        </div>
        <button disabled={busy} onClick={affecter} className="mt-3 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Affecter</button>
      </Panneau>

      <Panneau titre="Périmètre des comptes actifs">
        {actifs.length === 0 ? <SansDonnees message="Aucun compte actif" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Compte</th><th className="py-2 pr-3">Site du profil</th><th className="py-2 pr-3">Sites permis aujourd'hui</th><th className="py-2">Actions</th></tr></thead>
            <tbody>
              {actifs.map((c) => (
                <tr key={c.id} className="border-b border-stone-100">
                  <td className="py-2 pr-3 font-medium">{c.full_name}</td>
                  <td className="py-2 pr-3">{c.site_id ? nomSite.get(c.site_id) ?? c.site_id : '-'}</td>
                  <td className="py-2 pr-3">{libellePerimetre(c)}</td>
                  <td className="py-2">
                    {perimetres.get(c.id)?.retour_possible && (retour?.utilisateur === c.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <input aria-label="Motif du retour au périmètre global" placeholder="Motif" value={retour.motif}
                          onChange={(e) => setRetour({ ...retour, motif: e.target.value })} className={CHAMP} />
                        <button disabled={busy} onClick={retablir} className="rounded-lg bg-orange-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Valider</button>
                        <button onClick={() => setRetour(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs">Retour</button>
                      </div>
                    ) : (
                      <button onClick={() => setRetour({ utilisateur: c.id, motif: '' })} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Rétablir le périmètre global</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panneau>

      <Panneau titre="Affectations">
        {lignes === null ? <p className="text-sm">Chargement…</p> : lignes.length === 0 ? <SansDonnees message="Aucune affectation" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-stone-500">
                <th className="py-2 pr-3">Compte</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Du</th><th className="py-2 pr-3">Au</th>
                <th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Motif</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-stone-100 align-top">
                    <td className="py-2 pr-3">{l.utilisateur_nom ?? l.utilisateur}</td>
                    <td className="py-2 pr-3">{l.site_nom ?? l.site_id}</td>
                    <td className="py-2 pr-3">{new Date(`${l.debut}T00:00:00`).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 pr-3">{l.fin ? new Date(`${l.fin}T00:00:00`).toLocaleDateString('fr-FR') : 'Sans terme'}</td>
                    <td className="py-2 pr-3"><Puce teinte={TEINTES[l.statut]}>{LIBELLES_STATUT_AFFECTATION[l.statut]}</Puce></td>
                    <td className="py-2 pr-3">{l.statut === 'annulee' ? l.motif_annulation : l.motif ?? '-'}</td>
                    <td className="py-2">
                      {l.statut !== 'annulee' && (action?.id === l.id ? (
                        <div className="flex flex-wrap items-end gap-2">
                          {action.mode === 'cloture' && (
                            <input aria-label="Nouvelle date de fin" type="date" value={action.date} onChange={(e) => setAction({ ...action, date: e.target.value })} className={CHAMP} />
                          )}
                          <input aria-label={action.mode === 'cloture' ? 'Motif de la clôture' : 'Motif de l\'annulation'} placeholder="Motif" value={action.motif}
                            onChange={(e) => setAction({ ...action, motif: e.target.value })} className={CHAMP} />
                          <button disabled={busy} onClick={valider} className="rounded-lg bg-orange-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Valider</button>
                          <button onClick={() => setAction(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs">Retour</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => setAction({ id: l.id, mode: 'cloture', date: l.fin ?? '', motif: '' })} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Clore</button>
                          <button onClick={() => setAction({ id: l.id, mode: 'annulation', date: '', motif: '' })} className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700">Annuler</button>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>
    </div>
  );
};
