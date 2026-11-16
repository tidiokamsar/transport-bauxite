import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { EVENEMENTS_CONNEXION, libelleEvenement } from './organisation';

// Journal de connexion (D-064) : lecture de ce que GoTrue a ecrit dans
// auth.audit_log_entries, par la vue v_journal_connexions reservee a
// l'administrateur (ni jeton ni payload brut). Les tentatives echouees n'y
// figurent pas : GoTrue ne les journalise pas. Sessions : sessions_ouvertes().

interface Evenement {
  id: string; survenu_le: string; utilisateur: string | null; compte: string | null; nom: string | null;
  evenement: string | null; categorie: string | null; methode: string | null; adresse_ip: string | null;
}
interface Session {
  id: string; utilisateur: string; nom: string | null; compte: string | null; ouverte_le: string;
  renouvelee_le: string | null; expire_le: string | null; niveau: string | null; navigateur: string | null; adresse_ip: string | null;
}

const LIMITE = 200;
const CHAMP = 'rounded border border-stone-300 px-3 py-2 text-sm';
const dateHeure = (x: string | null) => x ? new Date(x).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) : '-';

export const JournalConnexions = () => {
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [tous, setTous] = useState(false);
  const [compte, setCompte] = useState('');
  const [lignes, setLignes] = useState<Evenement[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    let q = supabase.from('v_journal_connexions').select('*').order('survenu_le', { ascending: false }).limit(LIMITE);
    if (!tous) q = q.in('evenement', EVENEMENTS_CONNEXION);
    if (du) q = q.gte('survenu_le', new Date(`${du}T00:00:00`).toISOString());
    if (au) q = q.lt('survenu_le', new Date(new Date(`${au}T00:00:00`).getTime() + 86400000).toISOString());
    if (compte.trim()) q = q.ilike('compte', `%${compte.trim()}%`);
    const [j, s] = await Promise.all([q, supabase.rpc('sessions_ouvertes')]);
    if (j.error || s.error) setErreur((j.error ?? s.error)?.message ?? '');
    setLignes((j.data as Evenement[] | null) ?? []);
    setSessions((s.data as Session[] | null) ?? []);
    setHeure(new Date());
  }, [du, au, tous, compte]);
  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="space-y-6">
      <Panneau titre="Journal de connexion">
        {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">Du<input aria-label="Journal du" type="date" value={du} onChange={(e) => setDu(e.target.value)} className={`ml-2 ${CHAMP}`} /></label>
          <label className="text-sm">Au<input aria-label="Journal au" type="date" value={au} onChange={(e) => setAu(e.target.value)} className={`ml-2 ${CHAMP}`} /></label>
          <label className="text-sm">Compte<input aria-label="Filtrer par compte" value={compte} onChange={(e) => setCompte(e.target.value)} className={`ml-2 ${CHAMP}`} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} /> Tous les événements (renouvellements, MFA, mots de passe)
          </label>
        </div>
        {lignes === null ? <p className="text-sm">Chargement…</p> : lignes.length === 0 ? (
          <SansDonnees message="Sans données" detail="Aucun événement enregistré par le service d'authentification pour ces critères." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-stone-500">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Compte</th><th className="py-2 pr-3">Événement</th>
                <th className="py-2 pr-3">Méthode</th><th className="py-2">Adresse IP</th>
              </tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-stone-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{dateHeure(l.survenu_le)}</td>
                    <td className="py-2 pr-3">{l.nom ?? '-'}<span className="block text-xs text-stone-500">{l.compte ?? 'Compte non renseigné'}</span></td>
                    <td className="py-2 pr-3">{libelleEvenement(l.evenement)}</td>
                    <td className="py-2 pr-3">{l.methode ?? '-'}</td>
                    <td className="py-2 font-mono text-xs">{l.adresse_ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lignes.length === LIMITE && <p className="mt-2 text-xs text-stone-500">Les {LIMITE} événements les plus récents sont affichés : restreignez la période.</p>}
          </div>
        )}
        <Provenance source="auth.audit_log_entries (service d'authentification GoTrue), vue v_journal_connexions" heure={heure} />
      </Panneau>

      <Panneau titre="Sessions ouvertes">
        {sessions === null ? <p className="text-sm">Chargement…</p> : sessions.length === 0 ? (
          <SansDonnees message="Sans données" detail="Aucune session ouverte enregistrée." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-stone-500">
                <th className="py-2 pr-3">Compte</th><th className="py-2 pr-3">Ouverte le</th><th className="py-2 pr-3">Dernier renouvellement</th>
                <th className="py-2 pr-3">Niveau</th><th className="py-2 pr-3">Navigateur</th><th className="py-2">Adresse IP</th>
              </tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 align-top">
                    <td className="py-2 pr-3">{s.nom ?? '-'}<span className="block text-xs text-stone-500">{s.compte ?? '-'}</span></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{dateHeure(s.ouverte_le)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{dateHeure(s.renouvelee_le)}</td>
                    <td className="py-2 pr-3">{s.niveau === 'aal2' ? 'MFA' : s.niveau === 'aal1' ? 'Mot de passe' : s.niveau ?? '-'}</td>
                    <td className="py-2 pr-3 max-w-xs truncate" title={s.navigateur ?? ''}>{s.navigateur ?? '-'}</td>
                    <td className="py-2 font-mono text-xs">{s.adresse_ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance source="auth.sessions (GoTrue), fonction sessions_ouvertes" heure={heure} />
      </Panneau>
    </div>
  );
};
