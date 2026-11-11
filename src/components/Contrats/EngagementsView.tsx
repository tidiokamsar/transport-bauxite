import { useCallback, useEffect, useState } from 'react';
import { FileText, Printer, Send, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { INDICATEURS, PERIODICITES } from './types';

// Engagements de l'avenant compares au realise, et rapport de performance
// mensuel (phase 4, D-031). Les mesures viennent du terrain (voyages,
// immobilisations, pleins, pointages) ; une mesure absente est « non
// mesurable », jamais estimee. Le rapport est fige puis remis.

interface Ligne {
  engagement_id: string; indicateur: string; libelle: string; seuil: number; unite: string; sens: string; periodicite: string;
  consequence: string | null; realise: number | null; echantillon: number | null; conforme: boolean | null;
}
interface Rapport {
  id: string; contrat_id: string; periode_debut: string; periode_fin: string; statut: 'brouillon' | 'remis';
  genere_le: string; remis_le: string | null; remis_a: string | null;
  contenu: { engagements: Ligne[]; reconciliations: { debut: string; fin: string; statut: string; tonnage_facturable: number | null; voyages_facturables: number | null }[]; factures: { numero: string | null; type: string; statut: string; montant_ttc: number; devise: string }[] };
}
interface Contrat { id: string; reference: string; contrepartie: string; intitule: string }

const moisPrecedent = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const bornes = (mois: string) => { const [a, m] = mois.split('-').map(Number); return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` }; };
const jour = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');

const Conformite = ({ c }: { c: boolean | null }) =>
  c === null ? <Puce teinte="gris">Non mesurable</Puce> : c ? <Puce teinte="vert">Tenu</Puce> : <Puce teinte="rouge">Non tenu</Puce>;

const TableEngagements = ({ lignes }: { lignes: Ligne[] }) => (
  <table className="w-full text-sm">
    <thead><tr className="border-b border-stone-300 text-left text-stone-500">
      <th className="py-2 pr-3 font-medium">Engagement</th><th className="py-2 pr-3 text-right font-medium">Seuil</th>
      <th className="py-2 pr-3 text-right font-medium">Réalisé</th><th className="py-2 pr-3 text-right font-medium">Échantillon</th><th className="py-2 font-medium">Statut</th>
    </tr></thead>
    <tbody>{lignes.map((l) => (
      <tr key={l.engagement_id} className="border-b border-stone-100 align-top last:border-0">
        <td className="py-2 pr-3"><p className="font-semibold">{l.libelle}</p><p className="text-xs text-stone-500">{INDICATEURS[l.indicateur] ?? l.indicateur} · {PERIODICITES[l.periodicite] ?? l.periodicite}{l.consequence ? ` · ${l.consequence}` : ''}</p></td>
        <td className="py-2 pr-3 text-right">{l.sens === 'minimum' ? '≥' : '≤'} {formatNombre(Number(l.seuil), 2)} {l.unite}</td>
        <td className="py-2 pr-3 text-right font-semibold">{l.realise === null ? '—' : `${formatNombre(Number(l.realise), 2)} ${l.unite}`}</td>
        <td className="py-2 pr-3 text-right text-stone-500">{l.echantillon ?? '—'}</td>
        <td className="py-2"><Conformite c={l.conforme} /></td>
      </tr>
    ))}</tbody>
  </table>
);

export const EngagementsView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contrat, setContrat] = useState('');
  const [mois, setMois] = useState(moisPrecedent);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [societe, setSociete] = useState<{ raison_sociale: string } | null>(null);
  const [apercu, setApercu] = useState<Rapport | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie, intitule').order('reference'),
      supabase.from('societe').select('raison_sociale').eq('id', 1).maybeSingle(),
    ]).then(([c, s]) => {
      const liste = (c.data ?? []) as Contrat[];
      setContrats(liste);
      setContrat((x) => x || liste[0]?.id || '');
      setSociete(s.data as { raison_sociale: string } | null);
    });
  }, []);

  const charger = useCallback(async () => {
    if (!contrat) { setLignes([]); return; }
    const { du, au } = bornes(mois);
    const [c, r] = await Promise.all([
      supabase.rpc('comparer_engagements', { p_contrat_id: contrat, p_du: du, p_au: au }),
      supabase.from('rapports_performance').select('*').eq('contrat_id', contrat).order('periode_debut', { ascending: false }),
    ]);
    setMessage(c.error ? { ok: false, texte: c.error.message } : null);
    setLignes((c.data ?? []) as Ligne[]);
    setRapports((r.data ?? []) as Rapport[]);
    setHeure(new Date());
  }, [contrat, mois]);
  useEffect(() => { charger(); }, [charger]);

  const generer = async () => {
    const { du, au } = bornes(mois);
    const { error } = await supabase.rpc('generer_rapport_performance', { p_contrat_id: contrat, p_du: du, p_au: au });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Rapport du mois figé (brouillon) : à relire puis à remettre' });
    charger();
  };
  const remettre = async (r: Rapport) => {
    const a = window.prompt('Remis à (destinataire)');
    if (!a) return;
    const { error } = await supabase.rpc('marquer_rapport_remis', { p_id: r.id, p_date: new Date().toISOString().slice(0, 10), p_destinataire: a });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Rapport marqué remis' });
    charger();
  };

  const c = contrats.find((x) => x.id === contrat);
  const tenus = (lignes ?? []).filter((l) => l.conforme === true).length;
  const nonTenus = (lignes ?? []).filter((l) => l.conforme === false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-stone-900">Engagements et rapport de performance</h2><p className="text-stone-500">Engagements de l'avenant comparés au réalisé du mois, rapport mensuel figé puis remis</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={contrat} onChange={(e) => setContrat(e.target.value)} aria-label="Contrat" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {contrats.length === 0 && <option value="">Aucun contrat</option>}
            {contrats.map((x) => <option key={x.id} value={x.id}>{x.reference} · {x.contrepartie}</option>)}
          </select>
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          {peutEcrire && contrat && <button onClick={generer} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><FileText className="h-4 w-4" /> Figer le rapport du mois</button>}
        </div>
      </div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

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
              <span><b>{new Date(r.periode_debut + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b> · figé le {new Date(r.genere_le).toLocaleDateString('fr-FR')}
                {r.statut === 'remis' && ` · remis le ${jour(r.remis_le!)} à ${r.remis_a}`}</span>
              <span className="flex gap-1">
                <Puce teinte={r.statut === 'remis' ? 'vert' : 'orange'}>{r.statut === 'remis' ? 'Remis' : 'Brouillon'}</Puce>
                <button onClick={() => setApercu(r)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs" aria-label={`Aperçu du rapport ${r.periode_debut}`}><Printer className="inline h-3.5 w-3.5" /> Aperçu</button>
                {peutEcrire && r.statut === 'brouillon' && <button onClick={() => remettre(r)} className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"><Send className="inline h-3.5 w-3.5" /> Marquer remis</button>}
              </span>
            </li>
          ))}</ul>
        )}
      </Panneau>

      {apercu && (
        <div className="fixed inset-0 z-[950] overflow-y-auto bg-stone-200/90 p-6">
          <div className="pas-imprime mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimer</button>
            <button onClick={() => setApercu(null)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm" aria-label="Fermer l'aperçu"><X className="h-4 w-4" /> Fermer</button>
          </div>
          <div className="zone-impression">
            <article className="mx-auto max-w-[210mm] bg-white p-10 text-black shadow" aria-label="Rapport de performance">
              <header className="border-b-2 border-black pb-3">
                <p className="text-sm font-black">{societe?.raison_sociale ?? ''}</p>
                <p className="text-2xl font-black">RAPPORT DE PERFORMANCE MENSUEL</p>
                <p className="text-sm">Contrat {c?.reference} · {c?.contrepartie} · {c?.intitule}</p>
                <p className="text-sm">Période du {jour(apercu.periode_debut)} au {jour(apercu.periode_fin)} · figé le {new Date(apercu.genere_le).toLocaleDateString('fr-FR')}{apercu.statut === 'remis' ? ` · remis le ${jour(apercu.remis_le!)} à ${apercu.remis_a}` : ' · BROUILLON'}</p>
              </header>
              <h3 className="mt-6 font-bold">1. Engagements de l'avenant</h3>
              <TableEngagements lignes={apercu.contenu.engagements} />
              <h3 className="mt-6 font-bold">2. Tonnages réconciliés</h3>
              {apercu.contenu.reconciliations.length === 0 ? <p className="text-sm">Aucune réconciliation sur la période.</p> : (
                <ul className="text-sm">{apercu.contenu.reconciliations.map((x) => <li key={x.debut}>Du {jour(x.debut)} au {jour(x.fin)} ({x.statut}) : {x.tonnage_facturable === null ? 'non clôturée' : `${formatNombre(Number(x.tonnage_facturable), 2)} t sur ${x.voyages_facturables} voyages`}</li>)}</ul>
              )}
              <h3 className="mt-6 font-bold">3. Facturation</h3>
              {apercu.contenu.factures.length === 0 ? <p className="text-sm">Aucune facture sur la période.</p> : (
                <ul className="text-sm">{apercu.contenu.factures.map((x, i) => <li key={i}>{x.type === 'avoir' ? 'Avoir' : 'Facture'} {x.numero ?? '(non émise)'} · {x.statut} · {formatNombre(Number(x.montant_ttc), 2)} {x.devise}</li>)}</ul>
              )}
              <p className="mt-8 text-xs">Mesures issues des relevés de terrain enregistrés dans SIGTB ; « — » = non mesurable sur la période.</p>
            </article>
          </div>
        </div>
      )}
    </div>
  );
};
