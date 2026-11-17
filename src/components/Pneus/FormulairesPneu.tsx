import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide, SansDonnees } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { SANS_SITE } from '../ui/referentiels';
import { routeDetail } from '../ui/routeur';
import type { Seuils } from './EspacesPneus';
import { CHAMPS_SEUILS, MODULE_PNEUS, VUE_PNEUS, droitsPneus, nombreInvalide, nouvelleCle, routeEspace, useLecture } from './socle';

// Saisies du module Pneus en pleine page (D-090) : creation d'une carcasse,
// correction motivee des caracteristiques, configurations de positions,
// seuils et criteres de rechapage. Aucune valeur preremplie inventee : les
// champs sont vides ou repris de l'objet enregistre.

type Valeurs = Record<string, string>;
const txt = (s: string | undefined) => (s ?? '').trim();
/** Valeur envoyee au serveur : texte nettoye, nombre avec point decimal ; vide = absent. */
const pourServeur = (v: Valeurs, cles: string[], numeriques: string[] = []) =>
  Object.fromEntries(cles.filter((k) => txt(v[k]) !== '').map((k) => [k, numeriques.includes(k) ? txt(v[k]).replace(/\s/g, '').replace(',', '.') : txt(v[k])]));
const appel = async (fonction: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fonction, Object.fromEntries(Object.entries(args).filter(([, x]) => x !== undefined)));
  return { data: data as string | null, erreur: error?.message ?? null };
};

const Texte = ({ v, k, poser, libelle, erreur, aide, type = 'text' }: { v: Valeurs; k: string; poser: (k: string, x: string) => void; libelle: string; erreur?: string | null; aide?: string; type?: string }) => (
  <ChampPage libelle={libelle} erreur={erreur} aide={aide}>
    <input type={type} value={v[k] ?? ''} onChange={(e) => poser(k, e.target.value)} className={CHAMP_FENETRE} />
  </ChampPage>
);
const Nombre = ({ v, k, poser, libelle, aide }: { v: Valeurs; k: string; poser: (k: string, x: string) => void; libelle: string; aide?: string }) => (
  <ChampPage libelle={libelle} aide={aide} erreur={nombreInvalide(v[k] ?? '') ? 'Nombre illisible' : null}>
    <input inputMode="decimal" value={v[k] ?? ''} onChange={(e) => poser(k, e.target.value)} className={CHAMP_FENETRE} />
  </ChampPage>
);
const Choix = ({ v, k, poser, libelle, options, vide = 'Non renseigné' }: { v: Valeurs; k: string; poser: (k: string, x: string) => void; libelle: string; options: [string, string][]; vide?: string }) => (
  <ChampPage libelle={libelle}>
    <select value={v[k] ?? ''} onChange={(e) => poser(k, e.target.value)} className={CHAMP_FENETRE}>
      <option value="">{vide}</option>
      {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
    </select>
  </ChampPage>
);

export const FormulairePneus = ({ objet, id, requete }: { objet: string; id?: string; requete: Record<string, string> }) => {
  if (objet === 'carcasse') return <FormulaireCarcasse />;
  if (objet === 'correction' && id) return <FormulaireCorrection id={id} />;
  if (objet === 'configuration') return <FormulaireConfiguration code={requete.code} />;
  if (objet === 'seuils') return <FormulaireSeuils remplace={requete.remplace} />;
  if (objet === 'critere') return <FormulaireCritere code={requete.code} />;
  return <SansDonnees message="Saisie inconnue" detail={`« ${objet} » n'est pas une saisie du module Pneus.`} />;
};

// ---------------------------------------------------------------- carcasse

const CARACTERISTIQUES = ['marque', 'modele', 'dimension', 'construction', 'indice_charge', 'indice_vitesse', 'application', 'date_fabrication', 'code_dot'];
const NUMERIQUES = ['prix', 'garantie_mois', 'garantie_km', 'profondeur_initiale_mm', 'rechapages_max'];
const CONSTRUCTIONS: [string, string][] = [['radiale', 'Radiale'], ['diagonale', 'Diagonale']];
const SOURCES_PRIX: [string, string][] = [['bon_commande', 'Bon de commande'], ['facture', 'Facture'], ['saisie', 'Saisie']];

const erreursAchat = (v: Valeurs) => [
  ...NUMERIQUES.filter((k) => nombreInvalide(v[k] ?? '')).map((k) => `Nombre illisible : ${k.replace(/_/g, ' ')}`),
  txt(v.prix) && !v.prix_source ? 'Prix sans pièce : indiquer la source (bon de commande, facture ou saisie).' : '',
  v.prix_source === 'facture' && !txt(v.facture) ? 'Source facture : référence de la facture requise.' : '',
  v.prix_source === 'bon_commande' && v.commande === '' ? 'Source bon de commande : choisir le bon.' : '',
].filter(Boolean);

const BlocCaracteristiques = ({ v, poser }: { v: Valeurs; poser: (k: string, x: string) => void }) => (
  <SectionFormulaire titre="Caractéristiques">
    <Texte v={v} k="marque" poser={poser} libelle="Marque *" />
    <Texte v={v} k="modele" poser={poser} libelle="Modèle *" />
    <Texte v={v} k="dimension" poser={poser} libelle="Dimension" aide="Ex. telle que marquée sur le flanc" />
    <Choix v={v} k="construction" poser={poser} libelle="Construction" options={CONSTRUCTIONS} />
    <Texte v={v} k="indice_charge" poser={poser} libelle="Indice de charge" />
    <Texte v={v} k="indice_vitesse" poser={poser} libelle="Indice de vitesse" />
    <Texte v={v} k="application" poser={poser} libelle="Application" />
    <Texte v={v} k="code_dot" poser={poser} libelle="Code DOT" />
    <Texte v={v} k="date_fabrication" poser={poser} libelle="Date de fabrication" type="date" />
    <Nombre v={v} k="garantie_mois" poser={poser} libelle="Garantie (mois)" />
    <Nombre v={v} k="garantie_km" poser={poser} libelle="Garantie (km)" />
    <Nombre v={v} k="rechapages_max" poser={poser} libelle="Rechapages admis" aide="Vide : seuil du paramétrage s'il existe" />
  </SectionFormulaire>
);

const FormulaireCarcasse = () => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const { sites, aucunSite } = useSite();
  const [cle] = useState(nouvelleCle);
  const { valeurs: v, poser, modifie } = useSaisie<Valeurs>({});
  const p = (k: string, x: string) => poser(k, x);
  const fournisseurs = useLecture<{ id: string; company_name: string }>(() => supabase.from('suppliers').select('id, company_name').order('company_name'), 'fournisseurs');
  const bons = useLecture<{ id: string; po_number: string }>(() => supabase.from('purchase_orders').select('id, po_number').order('po_number', { ascending: false }).limit(300), 'bons de commande');
  const sansNumero = v.sans_numero === 'oui';
  const erreurs = [
    !txt(v.marque) ? 'Marque requise.' : '', !txt(v.modele) ? 'Modèle requis.' : '', !v.site ? 'Site de stockage requis.' : '',
    !sansNumero && !txt(v.numero_serie) ? 'Numéro de série fabricant requis (ou création sans numéro, motivée).' : '',
    sansNumero && txt(v.motif_sans_numero).length < 5 ? 'Motif de création sans numéro : 5 caractères au moins.' : '',
    ...erreursAchat({ ...v, commande: v.prix_source === 'bon_commande' ? v.commande ?? '' : 'x' }),
  ].filter(Boolean);
  if (!droits.ecriture) return <SansDonnees message="Création impossible" detail="Droit d'écriture sur la flotte ou la maintenance requis." />;
  return (
    <PageFormulaire vue={VUE_PNEUS} module={MODULE_PNEUS} titre="Nouvelle carcasse" modifie={modifie} erreurs={erreurs} libelleSoumettre="Enregistrer"
      description="Le code SIGTB (PN-000000) est attribué par le serveur et ne change jamais. Pour un achat, préférez la réception du bon de commande (Achats)."
      chargement={fournisseurs.lignes === null || bons.lignes === null} erreurChargement={[fournisseurs.erreur, bons.erreur].filter(Boolean).join(' ') || undefined}
      onSoumettre={async () => {
        const r = await appel('creer_carcasse_pneu', {
          p_caracteristiques: { ...pourServeur(v, [...CARACTERISTIQUES, 'date_achat', 'prix_source', 'facture', 'fournisseur', 'reference', 'note'], []), ...pourServeur(v, NUMERIQUES, NUMERIQUES), ...(v.prix_source === 'bon_commande' && v.commande ? { commande: v.commande } : {}) },
          p_site: v.site, p_numero_serie: sansNumero ? undefined : txt(v.numero_serie), p_motif_sans_numero: sansNumero ? txt(v.motif_sans_numero) : undefined,
          p_date: v.date_entree ? new Date(v.date_entree).toISOString() : undefined, p_cle_client: cle,
        });
        return r.erreur ? { erreur: r.erreur } : { vers: routeDetail(VUE_PNEUS, r.data ?? '') };
      }}>
      <SectionFormulaire titre="Identification">
        <Choix v={v} k="sans_numero" poser={p} libelle="Numéro de série" options={[['oui', 'Illisible ou absent : créer sans numéro']]} vide="Numéro fabricant lisible" />
        {sansNumero ? <Texte v={v} k="motif_sans_numero" poser={p} libelle="Motif de création sans numéro *" />
          : <Texte v={v} k="numero_serie" poser={p} libelle="Numéro de série fabricant *" aide="Compatible douchette code-barres" />}
        <ChampPage libelle="Site de stockage *">
          {aucunSite ? <ReferentielVide>{SANS_SITE}</ReferentielVide> : (
            <select value={v.site ?? ''} onChange={(e) => p('site', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir le site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </ChampPage>
        <Texte v={v} k="date_entree" poser={p} libelle="Date d'entrée en stock" type="datetime-local" aide="Vide = maintenant" />
        <Nombre v={v} k="profondeur_initiale_mm" poser={p} libelle="Profondeur initiale mesurée (mm)" />
        <Texte v={v} k="reference" poser={p} libelle="Référence de la pièce d'entrée" />
      </SectionFormulaire>
      <BlocCaracteristiques v={v} poser={p} />
      <SectionFormulaire titre="Acquisition">
        <ChampPage libelle="Fournisseur">
          <select value={v.fournisseur ?? ''} onChange={(e) => p('fournisseur', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Non renseigné</option>
            {(fournisseurs.lignes ?? []).map((f) => <option key={f.id} value={f.id}>{f.company_name}</option>)}
          </select>
        </ChampPage>
        <Texte v={v} k="date_achat" poser={p} libelle="Date d'achat" type="date" />
        <Nombre v={v} k="prix" poser={p} libelle="Prix (GNF)" />
        <Choix v={v} k="prix_source" poser={p} libelle="Source du prix" options={SOURCES_PRIX} />
        {v.prix_source === 'bon_commande' && (
          <ChampPage libelle="Bon de commande *">
            <select value={v.commande ?? ''} onChange={(e) => p('commande', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir</option>
              {(bons.lignes ?? []).map((b) => <option key={b.id} value={b.id}>{b.po_number}</option>)}
            </select>
          </ChampPage>
        )}
        <Texte v={v} k="facture" poser={p} libelle={v.prix_source === 'facture' ? 'Référence de la facture *' : 'Référence de la facture'} />
        <Texte v={v} k="note" poser={p} libelle="Note" />
      </SectionFormulaire>
    </PageFormulaire>
  );
};

// ---------------------------------------------------------------- correction

interface Tire { [k: string]: unknown; code_sigtb: string; status: string }
const CORRIGEABLES: [string, string][] = [
  ['marque', 'brand'], ['modele', 'model'], ['dimension', 'dimension'], ['construction', 'construction'], ['indice_charge', 'indice_charge'],
  ['indice_vitesse', 'indice_vitesse'], ['application', 'application'], ['date_fabrication', 'date_fabrication'], ['code_dot', 'code_dot'],
  ['numero_serie', 'numero_serie'], ['garantie_mois', 'garantie_mois'], ['garantie_km', 'garantie_km'], ['rechapages_max', 'max_retreads'],
  ['facture', 'facture_reference'], ['prix', 'purchase_price'], ['prix_source', 'prix_source'],
];

const FormulaireCorrection = ({ id }: { id: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const t = useLecture<Tire>(() => supabase.from('tires').select('*').eq('id', id), 'pneu', [id]);
  const pneu = t.lignes?.[0];
  const { valeurs: v, poser, modifie, initialiser } = useSaisie<Valeurs>({});
  const [origine, setOrigine] = useState<Valeurs>({});
  useEffect(() => {
    if (!pneu) return;
    const o = Object.fromEntries(CORRIGEABLES.map(([k, col]) => [k, pneu[col] === null || pneu[col] === undefined ? '' : String(pneu[col])]));
    setOrigine(o);
    initialiser({ ...o, motif: '' });
  }, [pneu, initialiser]);
  const changes = CORRIGEABLES.map(([k]) => k).filter((k) => txt(v[k]) !== txt(origine[k]));
  const p = (k: string, x: string) => poser(k, x);
  const erreurs = [
    !droits.ecriture ? 'Droit d\'écriture sur la flotte ou la maintenance requis.' : '',
    pneu?.status === 'retired' ? 'Pneu réformé : correction impossible.' : '',
    changes.length === 0 ? 'Aucune caractéristique modifiée.' : '',
    !txt(v.motif) ? 'Motif de la correction requis.' : '',
    changes.includes('marque') && !txt(v.marque) ? 'Marque requise.' : '', changes.includes('modele') && !txt(v.modele) ? 'Modèle requis.' : '',
    changes.includes('numero_serie') && !txt(v.numero_serie) ? 'Numéro de série : valeur requise.' : '',
    ...erreursAchat({ ...v, commande: 'x' }),
  ].filter(Boolean);
  return (
    <PageFormulaire vue={VUE_PNEUS} module={MODULE_PNEUS} titre={`Corriger ${pneu?.code_sigtb ?? ''}`} reference={pneu?.code_sigtb ?? 'Pneu'} id={id}
      modifie={modifie} erreurs={erreurs} libelleSoumettre="Enregistrer la correction"
      description="Correction tracée (opération « correction », avant et après au journal). Le code SIGTB ne change jamais ; seuls les champs modifiés sont envoyés."
      chargement={t.lignes === null && !t.erreur} erreurChargement={t.erreur || (t.lignes && !pneu ? 'Pneu introuvable ou hors de votre périmètre.' : undefined)}
      onSoumettre={async () => {
        const valeurs = Object.fromEntries(changes.map((k) => [k, NUMERIQUES.includes(k) ? txt(v[k]).replace(/\s/g, '').replace(',', '.') : txt(v[k])]));
        const r = await appel('corriger_caracteristiques_pneu', { p_tire: id, p_valeurs: valeurs, p_motif: txt(v.motif) });
        return r.erreur ? { erreur: r.erreur } : { vers: routeDetail(VUE_PNEUS, id, 'chronologie') };
      }}>
      <BlocCaracteristiques v={v} poser={p} />
      <SectionFormulaire titre="Identification et prix">
        <Texte v={v} k="numero_serie" poser={p} libelle="Numéro de série fabricant" />
        <Nombre v={v} k="prix" poser={p} libelle="Prix (GNF)" />
        <Choix v={v} k="prix_source" poser={p} libelle="Source du prix" options={SOURCES_PRIX.filter(([s]) => s !== 'bon_commande' || origine.prix_source === 'bon_commande')} />
        <Texte v={v} k="facture" poser={p} libelle="Référence de la facture" />
      </SectionFormulaire>
      <SectionFormulaire titre="Motif">
        <ChampPage libelle="Motif de la correction *" className="sm:col-span-2">
          <textarea rows={3} value={v.motif ?? ''} onChange={(e) => p('motif', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

// ---------------------------------------------------------------- configuration de positions

interface LignePosition { code: string; libelle: string; essieu: string; cote: string; rang: string; secours: boolean; dimensions: string; ordre: string }
const POSITION_VIDE: LignePosition = { code: '', libelle: '', essieu: '', cote: '', rang: '', secours: false, dimensions: '', ordre: '' };
const erreurPosition = (l: LignePosition, i: number) => {
  const n = `Position ${i + 1}`;
  if (!txt(l.code)) return `${n} : code requis.`;
  if (!l.secours && (!txt(l.essieu) || !l.cote || !l.rang)) return `${n} : essieu, côté et rang requis (sauf secours).`;
  if (txt(l.essieu) && !/^\d+$/.test(txt(l.essieu))) return `${n} : essieu entier (1, 2...).`;
  if (txt(l.ordre) && !/^-?\d+$/.test(txt(l.ordre))) return `${n} : ordre entier.`;
  return '';
};

const FormulaireConfiguration = ({ code }: { code?: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const conf = useLecture<{ id: string; code: string; libelle: string; modele_engin: string; notes: string | null }>(
    () => (code ? supabase.from('pneus_configurations').select('*').eq('code', code) : Promise.resolve({ data: [], error: null })), 'configuration', [code]);
  const existante = conf.lignes?.[0];
  const pos = useLecture<{ code: string; libelle: string | null; essieu: number | null; cote: string | null; rang: string | null; secours: boolean; dimensions_admises: string[]; ordre: number | null }>(
    () => (existante ? supabase.from('pneus_configuration_positions').select('*').eq('configuration_id', existante.id).eq('actif', true).order('ordre') : Promise.resolve({ data: [], error: null })),
    'positions', [existante?.id]);
  const modeles = useLecture<{ brand_model: string | null }>(() => supabase.from('vehicles').select('brand_model'), 'modèles d\'engins');
  const { valeurs: v, poser, modifie, initialiser } = useSaisie<Valeurs>({});
  const [lignes, setLignes] = useState<LignePosition[]>([{ ...POSITION_VIDE }]);
  const [lignesModifiees, setLignesModifiees] = useState(false);
  useEffect(() => {
    if (existante) initialiser({ code: existante.code, libelle: existante.libelle, modele: existante.modele_engin, notes: existante.notes ?? '', motif: '' });
  }, [existante, initialiser]);
  useEffect(() => {
    if (existante && pos.lignes) setLignes(pos.lignes.map((p) => ({
      code: p.code, libelle: p.libelle ?? '', essieu: p.essieu === null ? '' : String(p.essieu), cote: p.cote ?? '', rang: p.rang ?? '',
      secours: p.secours, dimensions: p.dimensions_admises.join(' ; '), ordre: p.ordre === null ? '' : String(p.ordre),
    })));
  }, [existante, pos.lignes]);
  const changer = (i: number, l: Partial<LignePosition>) => { setLignesModifiees(true); setLignes((x) => x.map((y, j) => (j === i ? { ...y, ...l } : y))); };
  const codes = lignes.map((l) => txt(l.code).toUpperCase().replace(/\s+/g, ' ')).filter(Boolean);
  const listeModeles = [...new Set((modeles.lignes ?? []).map((m) => txt(m.brand_model ?? '')).filter(Boolean))].sort();
  const erreurs = [
    !droits.parametrage ? 'Paramétrage réservé à l\'administrateur ou à un approbateur de la maintenance à périmètre global.' : '',
    !txt(v.code) ? 'Code de la configuration requis.' : '', !txt(v.libelle) ? 'Libellé requis.' : '', !txt(v.modele) ? 'Modèle d\'engin requis.' : '',
    lignes.length === 0 ? 'Au moins une position requise.' : '', ...lignes.map(erreurPosition),
    new Set(codes).size !== codes.length ? 'Code de position en double.' : '',
    existante && !txt(v.motif) ? 'Motif de la modification requis.' : '',
  ].filter(Boolean);
  return (
    <PageFormulaire vue={VUE_PNEUS} module={MODULE_PNEUS} titre={existante ? `Modifier la configuration ${existante.code}` : 'Nouvelle configuration de positions'}
      modifie={modifie || lignesModifiees} erreurs={erreurs} libelleSoumettre="Enregistrer"
      description="Une configuration par modèle d'engin (comparé sans casse). Une position retirée du jeu est désactivée, jamais supprimée ; refus si un pneu y est monté."
      chargement={(code ? conf.lignes === null : false) || modeles.lignes === null} erreurChargement={[conf.erreur, pos.erreur, modeles.erreur].filter(Boolean).join(' ') || (code && conf.lignes && !existante ? `Configuration ${code} introuvable.` : undefined)}
      onSoumettre={async () => {
        const positions = lignes.map((l) => ({
          code: txt(l.code), libelle: txt(l.libelle) || undefined, essieu: txt(l.essieu) ? Number(l.essieu) : undefined, cote: l.cote || undefined, rang: l.rang || undefined,
          secours: l.secours, dimensions: l.dimensions.split(/[;\n]/).map((d) => d.trim()).filter(Boolean), ordre: txt(l.ordre) ? Number(l.ordre) : undefined,
        }));
        const r = await appel('definir_configuration_pneus', { p_code: txt(v.code), p_libelle: txt(v.libelle), p_modele_engin: txt(v.modele), p_positions: positions, p_notes: txt(v.notes) || undefined, p_motif: txt(v.motif) || undefined });
        return r.erreur ? { erreur: r.erreur } : { vers: routeEspace('parametrage') };
      }}>
      <SectionFormulaire titre="Configuration">
        <ChampPage libelle="Code *" aide="Normalisé en majuscules ; une configuration existante se modifie par son code.">
          <input value={v.code ?? ''} onChange={(e) => poser('code', e.target.value)} disabled={Boolean(existante)} className={CHAMP_FENETRE} />
        </ChampPage>
        <Texte v={v} k="libelle" poser={(k, x) => poser(k, x)} libelle="Libellé *" />
        <ChampPage libelle="Modèle d'engin *" aide="Tel qu'enregistré dans la fiche engin (champ marque et modèle).">
          <input list="modeles-engins" value={v.modele ?? ''} onChange={(e) => poser('modele', e.target.value)} className={CHAMP_FENETRE} />
          <datalist id="modeles-engins">{listeModeles.map((m) => <option key={m} value={m} />)}</datalist>
        </ChampPage>
        <Texte v={v} k="notes" poser={(k, x) => poser(k, x)} libelle="Notes" />
      </SectionFormulaire>
      <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Positions</legend>
        <div className="space-y-3">
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-stone-200 p-3 text-sm md:grid-cols-4 xl:grid-cols-8">
              <input aria-label={`Code position ${i + 1}`} placeholder="Code *" value={l.code} onChange={(e) => changer(i, { code: e.target.value })} className={CHAMP_FENETRE} />
              <input aria-label={`Libellé position ${i + 1}`} placeholder="Libellé" value={l.libelle} onChange={(e) => changer(i, { libelle: e.target.value })} className={CHAMP_FENETRE} />
              <input aria-label={`Essieu position ${i + 1}`} placeholder="Essieu" inputMode="numeric" value={l.essieu} onChange={(e) => changer(i, { essieu: e.target.value })} className={CHAMP_FENETRE} />
              <select aria-label={`Côté position ${i + 1}`} value={l.cote} onChange={(e) => changer(i, { cote: e.target.value })} className={CHAMP_FENETRE}>
                <option value="">Côté</option><option value="gauche">Gauche</option><option value="centre">Centre</option><option value="droite">Droite</option>
              </select>
              <select aria-label={`Rang position ${i + 1}`} value={l.rang} onChange={(e) => changer(i, { rang: e.target.value })} className={CHAMP_FENETRE}>
                <option value="">Rang</option><option value="simple">Simple</option><option value="interieure">Intérieure</option><option value="exterieure">Extérieure</option>
              </select>
              <input aria-label={`Dimensions admises position ${i + 1}`} placeholder="Dimensions admises (séparées par ;)" value={l.dimensions} onChange={(e) => changer(i, { dimensions: e.target.value })} className={CHAMP_FENETRE} />
              <input aria-label={`Ordre position ${i + 1}`} placeholder="Ordre" inputMode="numeric" value={l.ordre} onChange={(e) => changer(i, { ordre: e.target.value })} className={CHAMP_FENETRE} />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1"><input type="checkbox" checked={l.secours} onChange={(e) => changer(i, { secours: e.target.checked })} /> Secours</label>
                <button type="button" onClick={() => { setLignesModifiees(true); setLignes((x) => x.filter((_, j) => j !== i)); }} className="rounded-lg px-2 text-stone-500 hover:bg-stone-100">Retirer</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => { setLignesModifiees(true); setLignes((x) => [...x, { ...POSITION_VIDE }]); }} className="text-sm font-semibold text-orange-800">Ajouter une position</button>
        </div>
      </fieldset>
      {existante && (
        <SectionFormulaire titre="Motif">
          <ChampPage libelle="Motif de la modification *" className="sm:col-span-2"><textarea rows={2} value={v.motif ?? ''} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        </SectionFormulaire>
      )}
    </PageFormulaire>
  );
};

// ---------------------------------------------------------------- seuils

const FormulaireSeuils = ({ remplace }: { remplace?: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const ancien = useLecture<Seuils>(() => (remplace ? supabase.from('pneus_seuils').select('*').eq('id', remplace) : Promise.resolve({ data: [], error: null })), 'seuils', [remplace]);
  const s = ancien.lignes?.[0];
  const { valeurs: v, poser, modifie, initialiser } = useSaisie<Valeurs>({});
  useEffect(() => {
    if (s) initialiser(Object.fromEntries(['dimension', 'marque', 'modele', 'application', ...CHAMPS_SEUILS.map(([k]) => k)].map((k) => [k, s[k] === null || s[k] === undefined ? '' : String(s[k])])));
  }, [s, initialiser]);
  const p = (k: string, x: string) => poser(k, x);
  const numeriques = CHAMPS_SEUILS.map(([k]) => k);
  const erreurs = [
    !droits.parametrage ? 'Paramétrage réservé à l\'administrateur ou à un approbateur de la maintenance à périmètre global.' : '',
    !['dimension', 'marque', 'modele', 'application'].some((k) => txt(v[k])) ? 'Portée requise : au moins une dimension, une marque, un modèle ou une application (aucun seuil universel).' : '',
    !numeriques.some((k) => txt(v[k])) ? 'Au moins un seuil requis.' : '',
    ...numeriques.filter((k) => nombreInvalide(v[k] ?? '')).map((k) => `Nombre illisible : ${CHAMPS_SEUILS.find(([c]) => c === k)?.[1]}`),
    !txt(v.motif) ? 'Motif requis.' : '',
  ].filter(Boolean);
  return (
    <PageFormulaire vue={VUE_PNEUS} module={MODULE_PNEUS} titre={s ? 'Remplacer des seuils' : 'Nouveaux seuils'} modifie={modifie} erreurs={erreurs} libelleSoumettre="Enregistrer"
      description="Valeurs fournies par le propriétaire (fabricant, contrat, pratique du site). Un champ vide = pas de seuil pour ce critère. Le remplacement désactive l'ancienne ligne, journalisé."
      chargement={remplace ? ancien.lignes === null : false} erreurChargement={ancien.erreur || (remplace && ancien.lignes && !s ? 'Seuils à remplacer introuvables.' : undefined)}
      onSoumettre={async () => {
        const r = await appel('definir_seuils_pneus', { p_valeurs: pourServeur(v, ['dimension', 'marque', 'modele', 'application', ...numeriques], numeriques), p_motif: txt(v.motif), p_remplace: s?.id });
        return r.erreur ? { erreur: r.erreur } : { vers: routeEspace('parametrage') };
      }}>
      <SectionFormulaire titre="Portée">
        <Texte v={v} k="dimension" poser={p} libelle="Dimension" />
        <Texte v={v} k="marque" poser={p} libelle="Marque" />
        <Texte v={v} k="modele" poser={p} libelle="Modèle" />
        <Texte v={v} k="application" poser={p} libelle="Application" />
      </SectionFormulaire>
      <SectionFormulaire titre="Seuils">
        {CHAMPS_SEUILS.map(([k, l, u]) => <Nombre key={k} v={v} k={k} poser={p} libelle={`${l} (${u})`} />)}
      </SectionFormulaire>
      <SectionFormulaire titre="Motif">
        <ChampPage libelle="Motif *" aide="Ex. source de la valeur (fiche fabricant, contrat...)" className="sm:col-span-2"><textarea rows={2} value={v.motif ?? ''} onChange={(e) => p('motif', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

// ---------------------------------------------------------------- criteres de rechapage

const FormulaireCritere = ({ code }: { code?: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const c = useLecture<{ code: string; libelle: string; bloquant: boolean; dimension: string | null; marque: string | null; modele: string | null; actif: boolean }>(
    () => (code ? supabase.from('pneus_criteres_rechapage').select('*').eq('code', code) : Promise.resolve({ data: [], error: null })), 'critère', [code]);
  const existant = c.lignes?.[0];
  const { valeurs: v, poser, modifie, initialiser } = useSaisie<Valeurs>({});
  useEffect(() => {
    if (existant) initialiser({ code: existant.code, libelle: existant.libelle, bloquant: existant.bloquant ? 'oui' : 'non', actif: existant.actif ? 'oui' : 'non', dimension: existant.dimension ?? '', marque: existant.marque ?? '', modele: existant.modele ?? '', motif: '' });
  }, [existant, initialiser]);
  const p = (k: string, x: string) => poser(k, x);
  const erreurs = [
    !droits.parametrage ? 'Paramétrage réservé à l\'administrateur ou à un approbateur de la maintenance à périmètre global.' : '',
    !txt(v.code) ? 'Code requis.' : '', !txt(v.libelle) ? 'Libellé requis.' : '', !v.bloquant ? 'Indiquer si le critère est bloquant.' : '',
    existant && !v.actif ? 'Indiquer si le critère est actif.' : '', existant && !txt(v.motif) ? 'Motif de la modification requis.' : '',
  ].filter(Boolean);
  return (
    <PageFormulaire vue={VUE_PNEUS} module={MODULE_PNEUS} titre={existant ? `Modifier le critère ${existant.code}` : 'Nouveau critère de rechapage'} modifie={modifie} erreurs={erreurs} libelleSoumettre="Enregistrer"
      description="Chaque critère applicable est renseigné à l'envoi au rechapage ; un critère bloquant non satisfait refuse l'envoi."
      chargement={code ? c.lignes === null : false} erreurChargement={c.erreur || (code && c.lignes && !existant ? `Critère ${code} introuvable.` : undefined)}
      onSoumettre={async () => {
        const r = await appel('definir_critere_rechapage', {
          p_code: txt(v.code), p_libelle: txt(v.libelle), p_bloquant: v.bloquant === 'oui', p_portee: pourServeur(v, ['dimension', 'marque', 'modele']),
          p_actif: existant ? v.actif === 'oui' : true, p_motif: txt(v.motif) || undefined,
        });
        return r.erreur ? { erreur: r.erreur } : { vers: routeEspace('parametrage') };
      }}>
      <SectionFormulaire titre="Critère">
        <ChampPage libelle="Code *"><input value={v.code ?? ''} onChange={(e) => p('code', e.target.value)} disabled={Boolean(existant)} className={CHAMP_FENETRE} /></ChampPage>
        <Texte v={v} k="libelle" poser={p} libelle="Libellé *" />
        <Choix v={v} k="bloquant" poser={p} libelle="Bloquant *" options={[['oui', 'Oui : refuse l\'envoi si non satisfait'], ['non', 'Non : renseigné seulement']]} vide="Choisir" />
        {existant && <Choix v={v} k="actif" poser={p} libelle="Actif *" options={[['oui', 'Actif'], ['non', 'Inactif']]} vide="Choisir" />}
      </SectionFormulaire>
      <SectionFormulaire titre="Portée (vide = tous les pneus)">
        <Texte v={v} k="dimension" poser={p} libelle="Dimension" />
        <Texte v={v} k="marque" poser={p} libelle="Marque" />
        <Texte v={v} k="modele" poser={p} libelle="Modèle" />
      </SectionFormulaire>
      {existant && (
        <SectionFormulaire titre="Motif">
          <ChampPage libelle="Motif de la modification *" className="sm:col-span-2"><textarea rows={2} value={v.motif ?? ''} onChange={(e) => p('motif', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        </SectionFormulaire>
      )}
    </PageFormulaire>
  );
};
