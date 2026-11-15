import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, FileText, Plus, RefreshCw, Search, Table } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { exportToCSV, exportToPDF } from '../../lib/exports';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import type { Vehicle } from '../../types/vehicle';
import { VehicleModal } from './VehicleModal';
import { FicheVehicule } from './FicheVehicule';
import { PROPRIETES, STATUTS_OPERATIONNELS, TYPES_VEHICULE, libellePropriete, libelleStatut, type StatutOperationnel } from './flotte';

// Registre de la flotte (D-062) : statut operationnel derive par le serveur
// (v_vehicules), propriete (Kogon, loue, sous-traitant) et contrat, fiche
// detaillee avec historique. Aucune propriete n'est supposee : un engin non
// renseigne est affiche comme tel.

const COLONNES = 'id, registration, brand_model, year, vehicle_type, capacity_tonnes, chassis_number, site_id, status, insurance_expiry, technical_inspection_expiry, propriete, proprietaire, exploitant, transporteur, contrat_id, contrat_reference, statut_admin, statut_admin_depuis, statut_admin_motif, voyage_en_cours, statut_operationnel';

export const VehiclesView = () => {
  const { hasPermission, profile } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('vehicles', 'create') || hasPermission('vehicles', 'edit') || profile?.role === 'admin';
  const [vehicules, setVehicules] = useState<Vehicle[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtrePropriete, setFiltrePropriete] = useState('');
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [edition, setEdition] = useState<Vehicle | 'nouveau' | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    let q = supabase.from('v_vehicules').select(COLONNES).order('registration');
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    setErreur(error ? 'Registre indisponible : ' + error.message : '');
    setVehicules((data ?? []) as Vehicle[]);
    setHeure(new Date());
  }, [siteId]);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const liste = useMemo(() => (vehicules ?? []).filter((v) => {
    const t = recherche.trim().toLowerCase();
    return (!t || v.registration.toLowerCase().includes(t) || v.brand_model.toLowerCase().includes(t))
      && (!filtreStatut || v.statut_operationnel === filtreStatut)
      && (!filtrePropriete || (filtrePropriete === 'non_renseignee' ? v.propriete === null : v.propriete === filtrePropriete));
  }), [vehicules, recherche, filtreStatut, filtrePropriete]);
  const compte = (s: StatutOperationnel) => (vehicules ?? []).filter((v) => v.statut_operationnel === s).length;
  const fiche = ficheId ? (vehicules ?? []).find((v) => v.id === ficheId) ?? null : null;

  const lignesExport = () => liste.map((v) => ({
    Immatriculation: v.registration, Modele: v.brand_model, Type: TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type,
    Capacite_t: v.capacity_tonnes, Site: v.site_id ? nomSite.get(v.site_id) ?? '' : '', Propriete: libellePropriete(v.propriete),
    Proprietaire: v.proprietaire ?? '', Exploitant: v.exploitant ?? '', Contrat: v.contrat_reference ?? '',
    Statut: libelleStatut(v.statut_operationnel).libelle, Motif: v.statut_admin_motif ?? '',
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Véhicules et engins</h2>
          <p className="text-stone-500">Registre de la flotte : propriété, contrat, statut opérationnel et fiche détaillée</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportToCSV(lignesExport(), 'vehicules')} disabled={!liste.length} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50"><Table className="h-4 w-4" /> CSV</button>
          <button onClick={() => exportToPDF('Registre de la flotte', lignesExport(), 'vehicules')} disabled={!liste.length} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50"><FileText className="h-4 w-4" /> PDF</button>
          <button onClick={charger} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
          {peutEcrire && <button onClick={() => setEdition('nouveau')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow"><Plus className="h-4 w-4" /> Nouvel engin</button>}
        </div>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Synthèse de la flotte">
        {([
          ['Disponibles', compte('disponible')],
          ['En mission', compte('en_mission')],
          ['Immobilisés ou en maintenance', compte('immobilise') + compte('en_maintenance')],
          ['Suspendus', compte('suspendu')],
          ['Propriété non renseignée', (vehicules ?? []).filter((v) => v.propriete === null && v.statut_operationnel !== 'reforme').length],
        ] as [string, number][]).map(([l, n]) => <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{vehicules ? n : '—'}</p></div>)}
      </section>

      <Panneau titre={`Registre (${liste.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Immatriculation ou modèle" aria-label="Rechercher un engin" className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par statut" className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>{Object.entries(STATUTS_OPERATIONNELS).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
          </select>
          <select value={filtrePropriete} onChange={(e) => setFiltrePropriete(e.target.value)} aria-label="Filtrer par propriété" className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="">Toutes les propriétés</option>{Object.entries(PROPRIETES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="non_renseignee">Non renseignée</option>
          </select>
        </div>
        {vehicules === null ? <p className="text-sm text-stone-500">Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun engin" detail={vehicules.length ? 'Aucun engin ne correspond aux filtres.' : 'Créez le premier engin du registre.'} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Immatriculation</th><th className="py-2 pr-3 font-medium">Modèle</th><th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Site</th><th className="py-2 pr-3 font-medium">Propriété</th><th className="py-2 pr-3 font-medium">Statut</th><th />
              </tr></thead>
              <tbody>{liste.map((v) => { const s = libelleStatut(v.statut_operationnel); return (
                <tr key={v.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3"><button onClick={() => setFicheId(v.id)} className="font-semibold text-orange-800 hover:underline" aria-label={`Fiche ${v.registration}`}>{v.registration}</button></td>
                  <td className="py-2 pr-3">{v.brand_model}</td>
                  <td className="py-2 pr-3">{TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type} · {v.capacity_tonnes} t</td>
                  <td className="py-2 pr-3">{v.site_id ? nomSite.get(v.site_id) ?? '—' : 'Global'}</td>
                  <td className="py-2 pr-3">{v.propriete === null ? <Puce teinte="gris">Non renseignée</Puce> : <>{libellePropriete(v.propriete)}{v.proprietaire && <span className="block text-xs text-stone-500">{v.proprietaire}{v.contrat_reference ? ` · ${v.contrat_reference}` : ''}</span>}</>}</td>
                  <td className="py-2 pr-3" title={v.statut_admin_motif ?? v.voyage_en_cours ?? undefined}><Puce teinte={s.teinte}>{s.libelle}</Puce></td>
                  <td className="py-2 text-right">{peutEcrire && v.statut_operationnel !== 'reforme' && <button onClick={() => setEdition(v)} aria-label={`Modifier ${v.registration}`} className="rounded p-1 text-stone-500 hover:bg-stone-100"><Edit2 className="h-4 w-4" /></button>}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
        <Provenance source="registre des engins (v_vehicules) ; statut dérivé des immobilisations, des voyages engagés et des décisions de suspension ou de réforme" heure={heure} />
      </Panneau>

      {edition && <VehicleModal vehicle={edition === 'nouveau' ? null : edition} onClose={(modifie) => { setEdition(null); if (modifie) charger(); }} />}
      {fiche && <FicheVehicule key={fiche.id} vehicule={fiche} peutEcrire={peutEcrire} onClose={() => setFicheId(null)} onModifie={charger} />}
    </div>
  );
};
