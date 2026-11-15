import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Edit, Plus, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { TYPES_DOCUMENT, etatEcheance } from '../Vehicles/flotte';
import { VehicleDocumentModal, type DocumentVehicule } from './VehicleDocumentModal';

// Documents des vehicules (D-062) : assurances, cartes grises, visites
// techniques. Les alertes d'expiration (expires ou sous 30 jours) viennent
// du serveur (v_documents_vehicule_a_renouveler), dates du registre
// comprises ; un document remplace par un plus recent n'alerte plus.
// Metadonnees seulement : pas de fichier joint (stockage indisponible).

interface Ligne extends DocumentVehicule { vehicle: { registration: string; brand_model: string } | null }
interface Alerte { cle: string; vehicle_id: string; registration: string; type: string; libelle: string; reference: string | null; expire_le: string; jours_restants: number; origine: string }

export const VehicleDocumentsView = () => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = hasPermission('vehicles', 'create') || hasPermission('vehicles', 'edit') || profile?.role === 'admin';
  const [documents, setDocuments] = useState<Ligne[] | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [archives, setArchives] = useState(false);
  const [modal, setModal] = useState<{ document?: DocumentVehicule } | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [d, a] = await Promise.all([
      supabase.from('vehicle_documents')
        .select('id, vehicle_id, document_type, document_name, reference_number, issue_date, expiry_date, status, provider, cost, notes, vehicle:vehicles(registration, brand_model)')
        .order('expiry_date', { ascending: true, nullsFirst: false }),
      supabase.from('v_documents_vehicule_a_renouveler').select('cle, vehicle_id, registration, type, libelle, reference, expire_le, jours_restants, origine').order('expire_le'),
    ]);
    setErreur(d.error?.message ?? a.error?.message ?? '');
    setDocuments((d.data ?? []) as unknown as Ligne[]);
    setAlertes((a.data ?? []) as Alerte[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const aujourdhui = useMemo(() => new Date(), []);
  const liste = useMemo(() => (documents ?? []).filter((d) => {
    const t = recherche.trim().toLowerCase();
    return (archives || d.status !== 'archived') && (!filtreType || d.document_type === filtreType)
      && (!t || d.document_name.toLowerCase().includes(t) || (d.reference_number ?? '').toLowerCase().includes(t)
        || (d.vehicle?.registration ?? '').toLowerCase().includes(t));
  }), [documents, recherche, filtreType, archives]);
  const expires = alertes.filter((a) => a.jours_restants < 0).length;

  const archiver = async (d: Ligne) => {
    if (!window.confirm(`Archiver « ${d.document_name} » ? Il ne comptera plus dans les alertes.`)) return;
    const { error } = await supabase.from('vehicle_documents').update({ status: 'archived' }).eq('id', d.id);
    if (error) { setErreur(error.message); return; }
    charger();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Documents des véhicules</h2>
          <p className="text-stone-500">Assurances, cartes grises, visites techniques et autorisations ; alertes d'expiration à 30 jours</p>
        </div>
        <div className="flex gap-2">
          <button onClick={charger} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
          {peutEcrire && <button onClick={() => setModal({})} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow"><Plus className="h-4 w-4" /> Nouveau document</button>}
        </div>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      <Panneau titre={`À renouveler (${alertes.length}${expires ? `, dont ${expires} expiré${expires > 1 ? 's' : ''}` : ''})`}>
        {alertes.length === 0 ? <SansDonnees message="Aucun document expiré ou expirant sous 30 jours" /> :
          <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => <li key={a.cle} className="flex flex-wrap items-center gap-2 py-2">
            <b>{a.registration}</b> · {TYPES_DOCUMENT[a.type] ?? a.type} « {a.libelle} »{a.reference ? ` (${a.reference})` : ''} ·
            {a.jours_restants < 0 ? <Puce teinte="rouge">Expiré depuis {-a.jours_restants} j</Puce> : a.jours_restants === 0 ? <Puce teinte="rouge">Expire aujourd'hui</Puce> : <Puce teinte="orange">Expire dans {a.jours_restants} j</Puce>}
            {a.origine === 'registre' && <span className="text-xs text-stone-500">date saisie au registre, sans document enregistré</span>}
          </li>)}</ul>}
        <Provenance source="documents des véhicules et dates du registre (calcul serveur à la date du jour)" heure={heure} />
      </Panneau>

      <Panneau titre={`Registre des documents (${liste.length})`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, référence ou immatriculation" aria-label="Rechercher un document" className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} aria-label="Filtrer par type" className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="">Tous les types</option>{Object.entries(TYPES_DOCUMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} /> Afficher les archivés</label>
        </div>
        {documents === null ? <p className="text-sm text-stone-500">Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun document" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Véhicule</th><th className="py-2 pr-3 font-medium">Type</th><th className="py-2 pr-3 font-medium">Document</th>
                <th className="py-2 pr-3 font-medium">Échéance</th><th className="py-2 pr-3 font-medium">État</th><th className="py-2 pr-3 text-right font-medium">Coût</th><th />
              </tr></thead>
              <tbody>{liste.map((d) => { const e = etatEcheance(d.expiry_date, aujourdhui, d.status === 'archived'); return (
                <tr key={d.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{d.vehicle?.registration ?? '—'}</td>
                  <td className="py-2 pr-3">{TYPES_DOCUMENT[d.document_type] ?? d.document_type}</td>
                  <td className="py-2 pr-3">{d.document_name}{(d.reference_number || d.provider) && <span className="block text-xs text-stone-500">{[d.reference_number, d.provider].filter(Boolean).join(' · ')}</span>}</td>
                  <td className="py-2 pr-3">{d.expiry_date ? new Date(`${d.expiry_date}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="py-2 pr-3"><Puce teinte={e.teinte}>{e.texte}</Puce></td>
                  <td className="py-2 pr-3 text-right">{d.cost === null ? '—' : formatNombre(Number(d.cost))}</td>
                  <td className="py-2 text-right">{peutEcrire && d.status !== 'archived' && <span className="inline-flex gap-1">
                    <button onClick={() => setModal({ document: d })} aria-label={`Modifier ${d.document_name}`} className="rounded p-1 text-stone-500 hover:bg-stone-100"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => archiver(d)} aria-label={`Archiver ${d.document_name}`} className="rounded p-1 text-stone-500 hover:bg-stone-100"><Archive className="h-4 w-4" /></button>
                  </span>}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
      </Panneau>

      <VehicleDocumentModal isOpen={modal !== null} document={modal?.document} onClose={() => setModal(null)} onSuccess={() => { setModal(null); charger(); }} />
    </div>
  );
};
