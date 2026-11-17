import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilePlus, Fuel, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Relation } from '../ui/PageDetail';
import { Provenance, Puce, ReferentielVide } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { ecrireRoute, routeDetail, routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { ParcoursCarburant } from './ParcoursCarburant';
import { LIBELLE_STATUT_FACTURE_CBG, VUE_LIVRAISONS, idRoute, lireIdRoute, monnaie } from './carburant';
import {
  ActionFactureCbg, COLONNES_FACTURE_CBG, COLONNES_LIVRAISON, FicheFactureCbg, FicheLivraison, FormulaireFactureCbg, FormulaireLivraison,
  type FactureCbg, type Livraison,
} from './PagesLivraison';

// Livraisons et factures carburant CBG (D-034) au standard des pages
// (D-090) : liste des livraisons (prix saisi a chaque bon), fiche avec ses
// pieces justificatives (D-083), facture rapprochee des livraisons
// selectionnees et controlee une fois par controler_facture_carburant_cbg.
// Un ecart est signale, jamais corrige automatiquement.

export const LivraisonsCbgView = () => {
  const route = useRoute();
  if (route.vue !== VUE_LIVRAISONS || route.mode === 'liste') return <ListeLivraisons />;
  if (route.mode === 'nouveau') return route.requete.objet === 'facture' ? <FormulaireFactureCbg livraison={route.requete.livraison} /> : <FormulaireLivraison />;
  const { objet, id } = lireIdRoute(route.id ?? '', ['facture']);
  if (objet === 'facture') {
    if (route.mode === 'action' && route.action) return <ActionFactureCbg id={id} action={route.action} />;
    return <FicheFactureCbg id={id} />;
  }
  return <FicheLivraison id={id} />;
};

const ListeLivraisons = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [factures, setFactures] = useState<FactureCbg[] | null>(null);
  const [facturees, setFacturees] = useState<Set<string>>(new Set());
  const [aucunSite, setAucunSite] = useState(false);
  const [erreur, setErreur] = useState('');
  const [erreurFactures, setErreurFactures] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [l, f, s, r] = await Promise.all([
      supabase.from('livraisons_carburant_cbg').select(COLONNES_LIVRAISON).order('date_livraison', { ascending: false }),
      supabase.from('factures_carburant_cbg').select(COLONNES_FACTURE_CBG).order('date_facture', { ascending: false }),
      supabase.from('sites').select('id').limit(1),
      supabase.from('factures_carburant_cbg_livraisons').select('livraison_id'),
    ]);
    setErreur(l.error ? `Livraisons indisponibles : ${l.error.message}` : '');
    setLivraisons(l.error ? null : ((l.data ?? []) as unknown as Livraison[]));
    setErreurFactures(f.error ? `Factures indisponibles : ${f.error.message}` : r.error ? `Rattachements indisponibles : ${r.error.message}` : '');
    setFactures(f.error ? null : ((f.data ?? []) as FactureCbg[]));
    setAucunSite(!s.error && (s.data ?? []).length === 0);
    setFacturees(new Set(((r.data ?? []) as { livraison_id: string }[]).map((x) => x.livraison_id)));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Livraison>[]>(() => [
    { id: 'date', libelle: 'Date', valeur: (l) => l.date_livraison, rendu: (l) => new Date(`${l.date_livraison}T00:00:00`).toLocaleDateString('fr-FR') },
    { id: 'reference', libelle: 'Référence', valeur: (l) => l.reference, rendu: (l) => <span className="font-mono">{l.reference}</span> },
    { id: 'site', libelle: 'Site', valeur: (l) => l.site?.name ?? null },
    { id: 'litres', libelle: 'Litres', valeur: (l) => Number(l.volume_litres), rendu: (l) => formatNombre(Number(l.volume_litres), 2), alignement: 'droite' },
    { id: 'prix', libelle: 'GNF / L', valeur: (l) => Number(l.prix_litre), rendu: (l) => formatNombre(Number(l.prix_litre), 2), alignement: 'droite' },
    { id: 'montant', libelle: 'Montant calculé', valeur: (l) => Number(l.montant), rendu: (l) => monnaie(l.montant), alignement: 'droite' },
    { id: 'document', libelle: 'Bon / justificatif', valeur: (l) => l.document_ref, masquee: true },
    { id: 'facture', libelle: 'Facturée', valeur: (l) => (facturees.has(l.id) ? 'Oui' : 'Non'),
      rendu: (l) => (facturees.has(l.id) ? <Puce teinte="vert">Facturée</Puce> : <Puce teinte="orange">À facturer</Puce>) },
  ], [facturees]);
  const filtres = useMemo<FiltreListe<Livraison>[]>(() => [
    { id: 'facture', libelle: 'Facturation', options: [{ valeur: 'oui', libelle: 'Facturées' }, { valeur: 'non', libelle: 'À facturer' }],
      correspond: (l, v) => (v === 'oui') === facturees.has(l.id) },
  ], [facturees]);

  return (
    <div className="space-y-5">
      <ParcoursCarburant vue={VUE_LIVRAISONS} />
      {aucunSite && <ReferentielVide>{SANS_SITE} Chaque livraison CBG est rattachée au site livré.</ReferentielVide>}
      <PageListe
        vue={VUE_LIVRAISONS}
        titre="Livraisons carburant CBG"
        sousTitre="Prix saisi à chaque livraison ; factures rapprochées aux livraisons sélectionnées."
        lignes={livraisons}
        erreur={erreur}
        colonnes={colonnes}
        filtres={filtres}
        placeholderRecherche="Rechercher une référence, un site..."
        cle={(l) => l.id}
        libelleOuverture={(l) => `Fiche ${l.reference}`}
        actions={peutEcrire && <>
          <a href={routeNouveau(VUE_LIVRAISONS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
            <Plus className="h-4 w-4" /> Nouvelle livraison
          </a>
          <a href={ecrireRoute({ vue: VUE_LIVRAISONS, mode: 'nouveau', requete: { objet: 'facture' } })} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm">
            <FilePlus className="h-4 w-4" /> Nouvelle facture CBG
          </a>
        </>}
        nomExport="livraisons-cbg"
        vide={{ message: 'Aucune livraison CBG saisie', detail: 'Saisissez la quantité et le prix figurant sur chaque bon de livraison.' }}
        onActualiser={charger}
        provenance={<Provenance source="livraisons carburant CBG saisies (bons de livraison)" heure={heure} />}
      />
      <Relation
        titre="Contrôle des factures carburant"
        lignes={factures}
        erreur={erreurFactures}
        cle={(f) => f.id}
        vide="Aucune facture CBG enregistrée"
        lien={(f) => routeDetail(VUE_LIVRAISONS, idRoute('facture', f.id))}
        colonnes={[
          { libelle: 'Référence', valeur: (f) => f.reference },
          { libelle: 'Date', valeur: (f) => new Date(`${f.date_facture}T00:00:00`).toLocaleDateString('fr-FR') },
          { libelle: 'Facturé', valeur: (f) => monnaie(f.montant_facture) },
          { libelle: 'Attendu', valeur: (f) => monnaie(f.montant_attendu) },
          { libelle: 'Écart', valeur: (f) => monnaie(f.ecart) },
          { libelle: 'État', valeur: (f) => <Puce teinte={LIBELLE_STATUT_FACTURE_CBG[f.statut].teinte}>{LIBELLE_STATUT_FACTURE_CBG[f.statut].libelle}</Puce> },
        ]}
        note="Le contrôle compare le montant facturé à la somme des quantités × prix saisis à la livraison ; il s'ouvre depuis la fiche de la facture."
      />
      <p className="flex items-center gap-2 text-xs text-stone-500"><Fuel className="h-4 w-4" /> Le coût des distributions est calculé à partir du prix moyen pondéré des livraisons saisies dans la période analysée. Sans livraison, il reste « sans données ».</p>
    </div>
  );
};
