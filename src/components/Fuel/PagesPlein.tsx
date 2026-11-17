import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { Puce, ReferentielVide } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  LIBELLE_STATUT_DECISION, MODULE_PLEINS, VUE_PLEINS, VUE_STOCKS, erreursPlein, idRoute, lireNombre, type StatutDecision,
} from './carburant';
import { LIBELLE_MOUVEMENT } from './stocks';

// Fiche et saisie d'un plein (D-062, D-090).

export interface Plein {
  id: string; transaction_date: string; reference: string; vehicle_id: string | null; driver_id: string | null;
  volume_liters: number; unit_price: number | null; total_cost: number | null; transaction_type: 'refuel' | 'tank_fill';
  supplier: string | null; site_id: string | null; odometer_reading: number | null; notes: string | null;
  created_at: string | null; created_by: string | null;
}
export const COLONNES_PLEIN = 'id, transaction_date, reference, vehicle_id, driver_id, volume_liters, unit_price, total_cost, transaction_type, supplier, site_id, odometer_reading, notes, created_at, created_by';

interface MouvementLie {
  id: string; numero: number; stockage_id: string; type: keyof typeof LIBELLE_MOUVEMENT; variation: number; statut: StatutDecision;
  fuel_transaction_id: string | null; motif_decision: string | null; saisi_par: string | null; saisi_le: string; decide_par: string | null; decide_le: string | null;
}

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');

export const FichePlein = ({ id }: { id: string }) => {
  const { sites } = useSite();
  const [plein, setPlein] = useState<Lecture<Plein>>(attente);
  const [mouvements, setMouvements] = useState<Lecture<MouvementLie>>(attente);
  const [noms, setNoms] = useState({ engin: '', chauffeur: '', stockages: new Map<string, string>() });

  useEffect(() => {
    lire<Plein>(supabase.from('fuel_transactions').select(COLONNES_PLEIN).eq('id', id), 'plein').then(async (r) => {
      setPlein(r);
      const p = trouver(r.lignes, id);
      if (!p) return;
      const [v, d] = await Promise.all([
        p.vehicle_id ? supabase.from('vehicles').select('id, registration').eq('id', p.vehicle_id) : Promise.resolve({ data: [] }),
        p.driver_id ? supabase.from('drivers').select('id, name').eq('id', p.driver_id) : Promise.resolve({ data: [] }),
      ]);
      setNoms((n) => ({
        ...n,
        engin: ((v.data ?? []) as { id: string; registration: string }[]).find((x) => x.id === p.vehicle_id)?.registration ?? '',
        chauffeur: ((d.data ?? []) as { id: string; name: string }[]).find((x) => x.id === p.driver_id)?.name ?? '',
      }));
    });
    lire<MouvementLie>(supabase.from('mouvements_carburant')
      .select('id, numero, stockage_id, type, variation, statut, fuel_transaction_id, motif_decision, saisi_par, saisi_le, decide_par, decide_le')
      .eq('fuel_transaction_id', id), 'mouvement de cuve').then(async (r) => {
      const lignes = (r.lignes ?? []).filter((m) => m.fuel_transaction_id === id);
      setMouvements({ ...r, lignes: r.lignes && lignes });
      const ids = [...new Set(lignes.map((m) => m.stockage_id))];
      if (ids.length === 0) return;
      const { data } = await supabase.from('stockages_carburant').select('id, code').in('id', ids);
      setNoms((n) => ({ ...n, stockages: new Map(((data ?? []) as { id: string; code: string }[]).map((s) => [s.id, s.code])) }));
    });
  }, [id]);

  const p = trouver(plein.lignes, id);
  const nomSite = p?.site_id ? sites.find((s) => s.id === p.site_id)?.name ?? null : null;

  const historique: EvenementHistorique[] | null = p && mouvements.lignes ? fusionnerHistoriques(
    p.created_at ? [{ id: 'fuel_transactions-cree', le: p.created_at, libelle: p.transaction_type === 'refuel' ? 'Plein enregistré' : 'Remplissage de cuve enregistré', detail: p.notes, auteur: p.created_by, source: 'fuel_transactions.created_at' }] : [],
    mouvements.lignes.flatMap((m) => [
      { id: `mouvements_carburant-${m.id}-saisi`, le: m.saisi_le, libelle: `Distribution n° ${m.numero} soumise à validation`, auteur: m.saisi_par, source: 'mouvements_carburant.saisi_le' },
      ...(m.decide_le ? [{ id: `mouvements_carburant-${m.id}-decide`, le: m.decide_le, libelle: `Distribution n° ${m.numero} ${m.statut === 'valide' ? 'validée' : 'rejetée'}`, motif: m.motif_decision, auteur: m.decide_par, source: 'mouvements_carburant.decide_le' }] : []),
    ]),
  ) : null;

  return (
    <PageDetail
      vue={VUE_PLEINS}
      module={MODULE_PLEINS}
      reference={p?.reference ?? 'Plein'}
      statut={p ? { libelle: p.transaction_type === 'refuel' ? 'Plein' : 'Remplissage cuve', teinte: 'bleu' } : null}
      resume={p && <>{jour(p.transaction_date)} · {formatNombre(Number(p.volume_liters))} L{noms.engin ? ` · ${noms.engin}` : ''}</>}
      chargement={plein.lignes === null && !plein.erreur}
      erreur={plein.erreur}
      introuvable={plein.lignes !== null && !p}
      onglets={!p ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Plein', champs: [['Référence', <span className="font-mono">{p.reference}</span>], ['Date', jour(p.transaction_date)],
              ['Type', p.transaction_type === 'refuel' ? 'Plein' : 'Remplissage cuve'], ['Engin', noms.engin || null], ['Chauffeur', noms.chauffeur || null],
              ['Site', nomSite], ['Compteur km ou horamètre', p.odometer_reading === null ? null : formatNombre(Number(p.odometer_reading))]] },
            { titre: 'Quantité et coût', champs: [['Litres', `${formatNombre(Number(p.volume_liters))} L`],
              ['Prix au litre', p.unit_price === null ? 'Porté par les livraisons CBG' : formatNombre(Number(p.unit_price))],
              ['Montant', p.total_cost === null ? null : formatNombre(Number(p.total_cost))], ['Fournisseur', p.supplier], ['Note', p.notes]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Cuve', compte: mouvements.lignes?.length ?? null, contenu: (
          <Relation titre="Prélèvement en cuve" lignes={mouvements.lignes} erreur={mouvements.erreur} cle={(m) => m.id}
            vide="Plein hors stockage suivi (station, autre) : aucun mouvement de cuve"
            lien={(m) => routeDetail(VUE_STOCKS, idRoute('mouvement', m.id))}
            colonnes={[
              { libelle: 'Mouvement', valeur: (m) => `n° ${m.numero}` },
              { libelle: 'Stockage', valeur: (m) => noms.stockages.get(m.stockage_id) ?? '—' },
              { libelle: 'Type', valeur: (m) => LIBELLE_MOUVEMENT[m.type] ?? m.type },
              { libelle: 'Variation', valeur: (m) => `${formatNombre(Number(m.variation))} L` },
              { libelle: 'État', valeur: (m) => <Puce teinte={LIBELLE_STATUT_DECISION[m.statut]?.teinte ?? 'gris'}>{LIBELLE_STATUT_DECISION[m.statut]?.libelle ?? m.statut}</Puce> },
            ]}
            note="Une distribution validée se corrige par annulation (contre-mouvement motivé) depuis sa fiche dans le registre." />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={mouvements.erreur} source="fuel_transactions (enregistrement), mouvements_carburant (distribution en cuve et sa décision)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un plein" /> },
      ]}
    />
  );
};

interface Engin { id: string; registration: string; site_id: string | null }
interface Cuve { id: string; code: string; libelle: string; site_id: string }
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const FormulairePlein = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [engins, setEngins] = useState<Engin[] | null>(null);
  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [chauffeurs, setChauffeurs] = useState<{ id: string; name: string }[]>([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ date: aujourdhui(), engin: '', chauffeur: '', litres: '', compteur: '', cuve: '', note: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, registration, site_id').neq('status', 'sold').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('stockages_carburant').select('id, code, libelle, site_id').eq('actif', true).order('code'),
    ]).then(([v, d, c]) => {
      setErreurChargement(v.error ? `Engins indisponibles : ${v.error.message}` : '');
      setEngins((v.data ?? []) as Engin[]);
      setChauffeurs((d.data ?? []) as { id: string; name: string }[]);
      setCuves((c.data ?? []) as Cuve[]);
    });
  }, []);

  const siteEngin = engins?.find((x) => x.id === f.engin)?.site_id ?? null;
  const cuvesPossibles = useMemo(() => cuves.filter((c) => !siteEngin || c.site_id === siteEngin), [cuves, siteEngin]);
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursPlein(f)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('saisir_plein', {
      p_vehicle: f.engin, p_date: f.date, p_litres: lireNombre(f.litres), p_driver: f.chauffeur || null,
      p_compteur: lireNombre(f.compteur), p_stockage: f.cuve || null, p_note: f.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce(f.cuve ? 'Plein enregistré : la distribution en cuve attend sa validation dans le registre.' : 'Plein enregistré.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_PLEINS, data) : routeListe(VUE_PLEINS) };
  };

  return (
    <PageFormulaire
      vue={VUE_PLEINS}
      module={MODULE_PLEINS}
      titre="Saisir un plein"
      description="La référence est attribuée par le serveur ; le prix n'est jamais saisi sur un plein (il vient des livraisons CBG)."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={engins === null}
      erreurChargement={erreurChargement}
    >
      {engins?.length === 0 && <ReferentielVide>Aucun engin enregistré : créez d'abord les engins (Flotte → Véhicules et engins).</ReferentielVide>}
      <SectionFormulaire titre="Plein">
        <ChampPage libelle="Date *">
          <input type="date" value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Engin *">
          <select value={f.engin} onChange={(e) => { poser('engin', e.target.value); poser('cuve', ''); }} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(engins ?? []).map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Chauffeur">
          <select value={f.chauffeur} onChange={(e) => poser('chauffeur', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseigné</option>
            {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Litres *">
          <input inputMode="decimal" value={f.litres} onChange={(e) => poser('litres', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Compteur km ou horamètre">
          <input inputMode="decimal" value={f.compteur} onChange={(e) => poser('compteur', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Cuve ou citerne de prélèvement" aide="Un prélèvement en cuve crée une distribution à valider dans le registre des stocks.">
          <select value={f.cuve} onChange={(e) => poser('cuve', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Hors stockage suivi (station, autre)</option>
            {cuvesPossibles.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Note" className="sm:col-span-2">
          <input value={f.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
