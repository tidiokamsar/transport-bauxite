import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { FIABILITE, type Fiabilite } from './pilotage';

// Chaine integree (D-121 a D-126) : vues consolidees du Command Center et
// tracabilite. Toutes les valeurs viennent de fonctions serveur ; aucune
// n'est calculee ni estimee ici. Une absence reste « sans donnees » avec sa
// raison.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const valeur = (v: number | null, unite: string | null) => (v === null || v === undefined ? 'Sans données' : `${nombre.format(Number(v))}${unite ? ` ${unite}` : ''}`);

type Onglet = 'situation' | 'production' | 'maintenance' | 'creances' | 'clotures';

interface LigneSituation {
  section: string; code: string; libelle: string; valeur: number | null; texte: string | null;
  unite: string | null; source: string; fiabilite: Fiabilite; periode_debut: string; periode_fin: string;
  calcule_le: string; detail: string | null; nature: string;
}
interface LigneConsolidation {
  dimension: string; cle: string; libelle: string; tonnes_provisoires: number | null;
  tonnes_validees: number | null; tonnes_livrees: number | null; voyages: number;
  voyages_valides: number; voyages_sans_poids: number; source: string; fiabilite: Fiabilite;
  periode_debut: string; periode_fin: string; detail: string | null;
}
interface LigneMaintenance {
  vehicle_id: string; immatriculation: string; site_id: string | null; site_nom: string | null;
  immobilisations_ouvertes: number; heures_immobilisation: number | null;
  interventions: number; interventions_en_retard: number; remises_validees: number;
  incidents: number; immobilisations_panne: number; km_parcourus: number | null;
  source_km: string; litres_carburant: number | null; tonnes_validees: number | null;
  couts: Record<string, number> | null; litres_par_km: number | null; litres_par_tonne: number | null;
  fiabilite: Fiabilite; detail: string | null;
}
interface LigneCreance {
  facture_id: string; numero: string; contrat_reference: string | null; contrepartie: string | null;
  devise: string | null; date_emission: string | null; date_echeance: string | null;
  montant_ttc: number | null; encaisse: number | null; avoirs: number | null; solde: number | null;
  jours_retard: number | null; statut_recouvrement: string; nb_relances: number;
  source: string; fiabilite: Fiabilite;
}

interface LigneCloture {
  type_cloture: string; reference: string; objet_id: string;
  periode_debut: string; periode_fin: string; statut: string;
  cloture_le: string | null; cloture_par: string | null; valide_le: string | null;
  lignes: number | null; detail: string | null; source: string; fiabilite: Fiabilite;
}

const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'situation', libelle: 'Situation' },
  { id: 'production', libelle: 'Consolidation production' },
  { id: 'maintenance', libelle: 'Maintenance et carburant' },
  { id: 'creances', libelle: 'Créances clients' },
  { id: 'clotures', libelle: 'Clôtures' },
];

const RECOUVREMENT: Record<string, { texte: string; teinte: 'vert' | 'orange' | 'rouge' | 'gris' }> = {
  soldee: { texte: 'Soldée', teinte: 'vert' },
  en_cours: { texte: 'En cours', teinte: 'orange' },
  en_retard: { texte: 'En retard', teinte: 'rouge' },
  sans_donnees: { texte: 'Sans données', teinte: 'gris' },
};

export const ChaineIntegree = ({ debut, fin, site }: { debut: string; fin: string; site: string }) => {
  const [onglet, setOnglet] = useState<Onglet>('situation');
  const [situation, setSituation] = useState<LigneSituation[] | null>(null);
  const [consolidation, setConsolidation] = useState<LigneConsolidation[] | null>(null);
  const [maintenance, setMaintenance] = useState<LigneMaintenance[] | null>(null);
  const [creances, setCreances] = useState<LigneCreance[] | null>(null);
  const [clotures, setClotures] = useState<LigneCloture[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true); setErreur('');
    const pSite = site || null;
    if (onglet === 'situation') {
      const { data, error } = await supabase.rpc('command_center', { p_debut: debut, p_fin: fin, p_site: pSite });
      if (error) setErreur(error.message);
      setSituation(error ? [] : ((data ?? []) as LigneSituation[]));
    } else if (onglet === 'production') {
      const { data, error } = await supabase.rpc('consolidation_production', { p_debut: debut, p_fin: fin, p_site: pSite });
      if (error) setErreur(error.message);
      setConsolidation(error ? [] : ((data ?? []) as LigneConsolidation[]));
    } else if (onglet === 'maintenance') {
      const { data, error } = await supabase.rpc('situation_maintenance', { p_debut: debut, p_fin: fin, p_site: pSite });
      if (error) setErreur(error.message);
      setMaintenance(error ? [] : ((data ?? []) as LigneMaintenance[]));
    } else if (onglet === 'clotures') {
      const { data, error } = await supabase.rpc('etat_clotures', { p_debut: debut, p_fin: fin, p_site: pSite });
      if (error) setErreur(error.message);
      setClotures(error ? [] : ((data ?? []) as LigneCloture[]));
    } else {
      const { data, error } = await supabase.rpc('etat_creances', { p_debut: debut, p_fin: fin, p_site: pSite });
      if (error) setErreur(error.message);
      setCreances(error ? [] : ((data ?? []) as LigneCreance[]));
    }
    setChargement(false);
  }, [onglet, debut, fin, site]);

  useEffect(() => { charger(); }, [charger]);

  const sections = [...new Set((situation ?? []).map((l) => l.section))];

  return (
    <Panneau titre="Chaîne intégrée">
      <div role="tablist" aria-label="Vues consolidées" className="mb-4 flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${onglet === o.id ? 'bg-orange-800 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>
            {o.libelle}
          </button>
        ))}
      </div>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {chargement && <p role="status" className="text-sm text-stone-500">Chargement…</p>}

      {!chargement && onglet === 'situation' && (situation?.length === 0
        ? <SansDonnees message="Aucune situation" detail="Le serveur n'a renvoyé aucune ligne pour cette période." />
        : sections.map((s) => (
          <section key={s} className="mb-4">
            <h3 className="mb-2 text-sm font-bold text-stone-700">{s}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(situation ?? []).filter((l) => l.section === s).map((l) => (
                <div key={l.code} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-stone-700">{l.libelle}</span>
                    <Puce teinte={FIABILITE[l.fiabilite].teinte}>{FIABILITE[l.fiabilite].texte}</Puce>
                  </div>
                  <p className="mt-1 text-2xl font-black text-stone-900">{l.texte ?? valeur(l.valeur, l.unite)}</p>
                  {l.detail && <p className="text-xs text-orange-800">{l.detail}</p>}
                  <p className="mt-1 text-xs text-stone-500">Source : {l.source}{l.nature === 'instantane' ? " · valeur à l'heure du calcul" : ''}</p>
                </div>
              ))}
            </div>
          </section>
        )))}

      {!chargement && onglet === 'production' && (consolidation?.length === 0
        ? <SansDonnees message="Aucune production consolidée" detail="Aucun voyage livré sur la période pour le périmètre." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Consolidation de la production">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2">Dimension</th><th>Libellé</th><th>Provisoire (t)</th><th>Validé (t)</th>
                <th>Livré (t)</th><th>Voyages</th><th>Sans poids</th><th>Fiabilité</th>
              </tr></thead>
              <tbody>{consolidation?.map((l) => (
                <tr key={`${l.dimension}-${l.cle}`} className="border-b border-stone-100">
                  <td className="py-1.5">{l.dimension}</td><td>{l.libelle}</td>
                  <td>{valeur(l.tonnes_provisoires, null)}</td><td>{valeur(l.tonnes_validees, null)}</td>
                  <td>{valeur(l.tonnes_livrees, null)}</td><td>{l.voyages}</td><td>{l.voyages_sans_poids}</td>
                  <td><Puce teinte={FIABILITE[l.fiabilite].teinte}>{FIABILITE[l.fiabilite].texte}</Puce></td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">Provisoire = tonnage livré non encore validé par CBG ; validé = tonnage accepté sur un voyage accepté ou clôturé. Chaque voyage n'est compté qu'une fois par dimension.</p>
          </div>
        ))}

      {!chargement && onglet === 'maintenance' && (maintenance?.length === 0
        ? <SansDonnees message="Aucune situation de maintenance" detail="Aucun engin lisible ou aucun droit sur le périmètre." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Situation maintenance et carburant">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2">Engin</th><th>Immo. ouvertes</th><th>Heures immo.</th><th>Interventions</th>
                <th>En retard</th><th>Km mesurés</th><th>Litres</th><th>L/km</th><th>L/t</th><th>Coûts par devise</th><th>Fiabilité</th>
              </tr></thead>
              <tbody>{maintenance?.map((l) => (
                <tr key={l.vehicle_id} className="border-b border-stone-100 align-top">
                  <td className="py-1.5"><b>{l.immatriculation}</b><span className="block text-xs text-stone-500">{l.site_nom ?? 'Site non renseigné'}</span></td>
                  <td>{l.immobilisations_ouvertes}</td><td>{valeur(l.heures_immobilisation, 'h')}</td>
                  <td>{l.interventions}</td><td>{l.interventions_en_retard}</td>
                  <td>{valeur(l.km_parcourus, 'km')}<span className="block text-xs text-stone-500">{l.source_km}</span></td>
                  <td>{valeur(l.litres_carburant, 'L')}</td><td>{valeur(l.litres_par_km, 'L/km')}</td><td>{valeur(l.litres_par_tonne, 'L/t')}</td>
                  <td>{l.couts && Object.keys(l.couts).length > 0
                    ? Object.entries(l.couts).map(([devise, montant]) => <span key={devise} className="block">{nombre.format(montant)} {devise}</span>)
                    : 'Sans donnée'}</td>
                  <td><Puce teinte={FIABILITE[l.fiabilite].teinte}>{FIABILITE[l.fiabilite].texte}</Puce>{l.detail && <span className="block text-xs text-stone-500">{l.detail}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">Les coûts ne sont jamais additionnés entre devises. Un coût annulé n'est pas compté.</p>
          </div>
        ))}

      {!chargement && onglet === 'creances' && (creances?.length === 0
        ? <SansDonnees message="Aucune créance" detail="Aucune facture émise sur la période, ou aucun droit de lecture." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Créances clients">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2">Facture</th><th>Contrepartie</th><th>Devise</th><th>Émise le</th><th>Échéance</th>
                <th>TTC</th><th>Encaissé</th><th>Avoirs</th><th>Solde</th><th>Retard</th><th>Relances</th><th>Statut</th>
              </tr></thead>
              <tbody>{creances?.map((l) => (
                <tr key={l.facture_id} className="border-b border-stone-100">
                  <td className="py-1.5"><b>{l.numero}</b><span className="block text-xs text-stone-500">{l.contrat_reference ?? 'Contrat non renseigné'}</span></td>
                  <td>{l.contrepartie ?? '—'}</td><td>{l.devise ?? '—'}</td><td>{l.date_emission ?? '—'}</td><td>{l.date_echeance ?? '—'}</td>
                  <td>{valeur(l.montant_ttc, l.devise)}</td><td>{valeur(l.encaisse, l.devise)}</td><td>{valeur(l.avoirs, l.devise)}</td>
                  <td>{valeur(l.solde, l.devise)}</td><td>{l.jours_retard === null ? '—' : `${l.jours_retard} j`}</td><td>{l.nb_relances}</td>
                  <td><Puce teinte={RECOUVREMENT[l.statut_recouvrement]?.teinte ?? 'gris'}>{RECOUVREMENT[l.statut_recouvrement]?.texte ?? l.statut_recouvrement}</Puce></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))}

      {!chargement && onglet === 'clotures' && (clotures?.length === 0
        ? <SansDonnees message="Aucune clôture" detail="Aucune instance de shift ni réconciliation sur la période, ou aucun droit de lecture." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Clôtures enregistrées">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2">Type</th><th>Référence</th><th>Période</th><th>Statut</th>
                <th>Clôturée le</th><th>Par</th><th>Lignes</th><th>Détail</th><th>Fiabilité</th>
              </tr></thead>
              <tbody>{clotures?.map((l) => (
                <tr key={`${l.type_cloture}-${l.objet_id}`} className="border-b border-stone-100">
                  <td className="py-1.5">{l.type_cloture}</td>
                  <td>{l.reference}</td>
                  <td>{l.periode_debut} au {l.periode_fin}</td>
                  <td>{l.statut}</td>
                  <td>{l.cloture_le ? new Date(l.cloture_le).toLocaleString('fr-FR') : 'non clôturée'}</td>
                  <td>{l.cloture_par ?? '—'}</td>
                  <td>{l.lignes ?? 'sans données'}</td>
                  <td className="text-xs">{l.detail ?? '—'}</td>
                  <td><Puce teinte={FIABILITE[l.fiabilite].teinte}>{FIABILITE[l.fiabilite].texte}</Puce></td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">Une clôture est une donnée enregistrée par le serveur (postes, réconciliations) ; rien n’est clôturé automatiquement.</p>
          </div>
        ))}
    </Panneau>
  );
};

interface LigneTraceabilite {
  niveau: string; objet: string; reference: string | null; objet_id: string | null;
  date_objet: string | null; quantite: number | null; unite: string | null;
  source: string; detail: string | null;
  vehicule: string | null; chauffeur: string | null; shift: string | null; ticket: string | null;
  tare_t: number | null; pieces: number | null; validation: string | null;
}

export const TraceabiliteIndicateur = ({ code, libelle, debut, fin, site, onFermer }: {
  code: string; libelle: string; debut: string; fin: string; site: string; onFermer: () => void;
}) => {
  const [lignes, setLignes] = useState<LigneTraceabilite[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    supabase.rpc('tracabilite_indicateur', { p_code: code, p_debut: debut, p_fin: fin, p_site: site || null })
      .then(({ data, error }) => {
        if (error) { setErreur(error.message); setLignes([]); } else { setLignes((data ?? []) as LigneTraceabilite[]); }
      });
  }, [code, debut, fin, site]);

  return (
    <Panneau titre={`Détail de l'indicateur · ${libelle}`}>
      <div className="mb-3 flex justify-end">
        <button onClick={onFermer} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm">Fermer</button>
      </div>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
        : lignes.length === 0 ? <SansDonnees message="Aucune opération source" detail="Aucune ligne ne compose cet indicateur sur la période et le périmètre." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Opérations composant l'indicateur">
                <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2">Niveau</th><th>Objet</th><th>Référence</th><th>Date</th><th>Quantité</th>
                  <th>Camion</th><th>Chauffeur</th><th>Shift</th><th>Ticket</th><th>Tare</th><th>Pièces</th><th>Validation</th><th>Source</th><th>Détail</th>
                </tr></thead>
                <tbody>{lignes.map((l, i) => (
                  <tr key={`${l.objet}-${l.objet_id ?? i}`} className="border-b border-stone-100">
                    <td className="py-1.5">{l.niveau}</td><td>{l.objet}</td><td>{l.reference ?? '—'}</td>
                    <td>{l.date_objet ?? '—'}</td><td>{valeur(l.quantite, l.unite)}</td>
                    <td>{l.vehicule ?? '—'}</td><td>{l.chauffeur ?? '—'}</td><td>{l.shift ?? '—'}</td>
                    <td>{l.ticket ?? '—'}</td><td>{l.tare_t === null ? '—' : `${valeur(l.tare_t, 't')}`}</td>
                    <td>{l.pieces ?? '—'}</td><td>{l.validation ?? '—'}</td>
                    <td>{l.source}</td><td>{l.detail ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      <p className="mt-2 text-xs text-stone-500">Tracabilité descendante : depuis l'indicateur vers les opérations et pièces qui le composent.</p>
    </Panneau>
  );
};
