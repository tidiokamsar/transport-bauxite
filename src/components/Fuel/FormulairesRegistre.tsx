import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  METHODES_MESURE, MODULE_STOCKS, VUE_STOCKS, erreursInventaire, erreursReception, erreursTransfert, idRoute, lireNombre,
} from './carburant';
import { litres, maintenantLocal, versIso } from './registre';
import type { Stock } from './stocks';

// Saisies du registre carburant en pleine page (D-041, D-090) :
// receptionner_livraison_cbg, transferer_carburant,
// saisir_inventaire_carburant. Chaque saisie cree un mouvement (ou un
// inventaire) a valider par une autre personne ; le retour se fait sur la
// fiche du stockage concerne.

interface Livraison { id: string; reference: string; date_livraison: string; site_id: string; volume_litres: number }
type Stockage = Pick<Stock, 'id' | 'code' | 'libelle' | 'site_id' | 'capacite_litres' | 'actif'>;

const useEcriture = () => {
  const { hasPermission } = useAuth();
  return hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
};

const useStockagesActifs = () => {
  const [stockages, setStockages] = useState<Stockage[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    supabase.from('stockages_carburant').select('id, code, libelle, site_id, capacite_litres, actif').eq('actif', true).order('code').then(({ data, error }) => {
      setErreur(error ? `Stockages indisponibles : ${error.message}` : '');
      setStockages(((data ?? []) as Stockage[]).filter((s) => s.actif));
    });
  }, []);
  return { stockages, erreur };
};

const SANS_STOCKAGE = 'Aucun stockage actif : déclarez d\'abord la cuve ou la citerne (bouton « Stockage » de la liste).';
const retour = (stockage: string) => (stockage ? routeDetail(VUE_STOCKS, stockage) : routeListe(VUE_STOCKS));

const ChoixStockage = ({ libelle, valeur, onChange, stockages, exclure }: {
  libelle: string; valeur: string; onChange: (v: string) => void; stockages: Stockage[]; exclure?: string;
}) => (
  <ChampPage libelle={libelle}>
    <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP_FENETRE}>
      <option value="">Choisir</option>
      {stockages.filter((s) => s.id !== exclure).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.libelle}</option>)}
    </select>
  </ChampPage>
);

const ChoixMethode = ({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) => (
  <ChampPage libelle="Méthode *">
    <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP_FENETRE}>
      {METHODES_MESURE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  </ChampPage>
);

export const FormulaireReception = ({ stockage, livraison }: { stockage?: string; livraison?: string }) => {
  const peutEcrire = useEcriture();
  const { stockages, erreur: erreurStockages } = useStockagesActifs();
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [erreurLivraisons, setErreurLivraisons] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ stockage: stockage ?? '', livraison: livraison ?? '', quand: maintenantLocal(), mesure: '', accepte: '', methode: 'jauge', motif: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('livraisons_carburant_cbg').select('id, reference, date_livraison, site_id, volume_litres').order('date_livraison', { ascending: false }).limit(200),
      supabase.from('receptions_carburant').select('livraison_id'),
    ]).then(([l, r]) => {
      setErreurLivraisons(l.error ? `Livraisons indisponibles : ${l.error.message}` : r.error ? `Réceptions indisponibles : ${r.error.message}` : '');
      const recues = new Set(((r.data ?? []) as { livraison_id: string }[]).map((x) => x.livraison_id));
      setLivraisons(((l.data ?? []) as Livraison[]).filter((x) => !recues.has(x.id)));
    });
  }, []);

  const choisi = (stockages ?? []).find((s) => s.id === f.stockage);
  const possibles = (livraisons ?? []).filter((l) => !choisi || l.site_id === choisi.site_id);
  const doc = (livraisons ?? []).find((l) => l.id === f.livraison) ?? null;
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursReception(f, doc ? Number(doc.volume_litres) : null)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { error } = await supabase.rpc('receptionner_livraison_cbg', {
      p_livraison_id: f.livraison, p_stockage_id: f.stockage, p_date: versIso(f.quand),
      p_volume_mesure: lireNombre(f.mesure), p_volume_accepte: lireNombre(f.accepte), p_methode: f.methode, p_motif_ecart: f.motif.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Réception enregistrée : entrée en stock à valider par une autre personne.');
    return { vers: retour(f.stockage) };
  };

  return (
    <PageFormulaire
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      titre="Réception d'une livraison CBG"
      description="Volume mesuré et volume accepté en cuve ; un écart avec le document CBG exige un motif. L'entrée en stock attend la validation d'une autre personne."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={stockages === null || livraisons === null}
      erreurChargement={erreurStockages || erreurLivraisons}
    >
      {stockages?.length === 0 && <ReferentielVide>{SANS_STOCKAGE}</ReferentielVide>}
      <SectionFormulaire titre="Réception">
        <ChoixStockage libelle="Stockage de réception *" valeur={f.stockage} onChange={(v) => {
          poser('stockage', v);
          const s = (stockages ?? []).find((x) => x.id === v);
          if (doc && s && doc.site_id !== s.site_id) poser('livraison', '');
        }} stockages={stockages ?? []} />
        <ChampPage libelle="Livraison CBG *">
          <select value={f.livraison} onChange={(e) => poser('livraison', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">{possibles.length ? 'Choisir' : 'Aucune livraison à réceptionner sur ce site'}</option>
            {possibles.map((l) => <option key={l.id} value={l.id}>{l.reference} · {l.date_livraison} · {litres(l.volume_litres)}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Date et heure *">
          <input type="datetime-local" value={f.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChoixMethode valeur={f.methode} onChange={(v) => poser('methode', v)} />
        <ChampPage libelle="Volume mesuré (L) *">
          <input inputMode="decimal" value={f.mesure} onChange={(e) => poser('mesure', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Volume accepté (L) *">
          <input inputMode="decimal" value={f.accepte} onChange={(e) => poser('accepte', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle={`Motif d'écart (obligatoire si différent du document CBG${doc ? ` : ${litres(doc.volume_litres)}` : ''})`} className="sm:col-span-2">
          <input value={f.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const FormulaireTransfert = ({ source }: { source?: string }) => {
  const peutEcrire = useEcriture();
  const { stockages, erreur } = useStockagesActifs();
  const { valeurs: f, poser, modifie } = useSaisie({ source: source ?? '', destination: '', litres: '', quand: maintenantLocal(), reference: '', note: '' });
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursTransfert(f)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { error } = await supabase.rpc('transferer_carburant', {
      p_source_id: f.source, p_destination_id: f.destination, p_litres: lireNombre(f.litres),
      p_date: versIso(f.quand), p_reference: f.reference.trim() || null, p_note: f.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Transfert enregistré : sortie et entrée à valider ensemble.');
    return { vers: retour(f.source) };
  };

  return (
    <PageFormulaire
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      titre="Transfert entre stockages"
      description="Deux mouvements liés (sortie et entrée), validés ensemble par une autre personne."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={stockages === null}
      erreurChargement={erreur}
    >
      {stockages !== null && stockages.length < 2 && <ReferentielVide>Un transfert demande deux stockages actifs.</ReferentielVide>}
      <SectionFormulaire titre="Transfert">
        <ChoixStockage libelle="Depuis *" valeur={f.source} onChange={(v) => poser('source', v)} stockages={stockages ?? []} />
        <ChoixStockage libelle="Vers *" valeur={f.destination} onChange={(v) => poser('destination', v)} stockages={stockages ?? []} exclure={f.source} />
        <ChampPage libelle="Quantité (L) *">
          <input inputMode="decimal" value={f.litres} onChange={(e) => poser('litres', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Date et heure *">
          <input type="datetime-local" value={f.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Bon de transfert">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Note">
          <input value={f.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const FormulaireInventaire = ({ stockage }: { stockage?: string }) => {
  const peutEcrire = useEcriture();
  const { stockages, erreur } = useStockagesActifs();
  const { valeurs: f, poser, modifie } = useSaisie({ stockage: stockage ?? '', mesure: '', quand: maintenantLocal(), methode: 'jauge', note: '' });
  const choisi = (stockages ?? []).find((s) => s.id === f.stockage);
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur le carburant requis.'] : []), ...erreursInventaire(f, choisi ? Number(choisi.capacite_litres) : null)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('saisir_inventaire_carburant', {
      p_stockage_id: f.stockage, p_date: versIso(f.quand), p_volume_mesure: lireNombre(f.mesure), p_methode: f.methode, p_note: f.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Inventaire enregistré : l\'ajustement sera créé à sa validation.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_STOCKS, idRoute('inventaire', data)) : retour(f.stockage) };
  };

  return (
    <PageFormulaire
      vue={VUE_STOCKS}
      module={MODULE_STOCKS}
      titre="Inventaire (mesure physique)"
      description="Le volume mesuré est comparé au solde théorique ; sa validation par une autre personne crée un ajustement égal à l'écart. Le premier inventaire validé ouvre le stock."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={stockages === null}
      erreurChargement={erreur}
    >
      {stockages?.length === 0 && <ReferentielVide>{SANS_STOCKAGE}</ReferentielVide>}
      <SectionFormulaire titre="Inventaire">
        <ChoixStockage libelle="Stockage *" valeur={f.stockage} onChange={(v) => poser('stockage', v)} stockages={stockages ?? []} />
        <ChampPage libelle="Volume mesuré (L) *" aide={choisi ? `Capacité : ${litres(choisi.capacite_litres)}` : undefined}>
          <input inputMode="decimal" value={f.mesure} onChange={(e) => poser('mesure', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Date et heure de la mesure *">
          <input type="datetime-local" value={f.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChoixMethode valeur={f.methode} onChange={(v) => poser('methode', v)} />
        <ChampPage libelle="Note" className="sm:col-span-2">
          <input value={f.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};
