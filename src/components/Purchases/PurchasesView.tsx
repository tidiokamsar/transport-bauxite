import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_BON, STATUTS_BON, VUE_ACHATS, montantGnf, type Bon } from './achats';
import { FormulaireBon } from './FormulaireBon';
import { DetailBon } from './DetailBon';
import { ActionBonVue } from './ActionBon';

// Achats (D-053) au standard des pages (D-090) : liste des bons de
// commande, fiche (lignes, receptions, journal), brouillon en pleine page,
// soumission, decision, reception, solde et annulation en pages d'action,
// chacune par sa fonction serveur.

export const PurchasesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_ACHATS || route.mode === 'liste') return <ListeBons />;
  if (route.mode === 'nouveau') return <FormulaireBon />;
  if (route.mode === 'modifier') return <FormulaireBon id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionBonVue id={route.id ?? ''} action={route.action} requete={route.requete} />;
  return <DetailBon id={route.id ?? ''} />;
};

const ListeBons = () => {
  const { hasPermission } = useAuth();
  const peutAcheter = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [bons, setBons] = useState<Bon[] | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Map<string, string>>(new Map());
  const [depots, setDepots] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [b, f, d] = await Promise.all([
      supabase.from('purchase_orders').select(COLONNES_BON).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('warehouses').select('id, name, code').order('name'),
    ]);
    setErreur(b.error ? `Bons de commande indisponibles : ${b.error.message}` : f.error ? `Fournisseurs indisponibles : ${f.error.message}` : d.error ? `Dépôts indisponibles : ${d.error.message}` : '');
    setBons(b.error ? null : ((b.data ?? []) as Bon[]));
    setFournisseurs(new Map((f.data ?? []).map((x) => [x.id as string, x.company_name as string])));
    setDepots(new Map((d.data ?? []).map((x) => [x.id as string, `${x.name as string} (${x.code as string})`])));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Bon>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (b) => b.po_number },
    { id: 'date', libelle: 'Date', valeur: (b) => b.po_date },
    { id: 'fournisseur', libelle: 'Fournisseur', valeur: (b) => fournisseurs.get(b.supplier_id) ?? null },
    { id: 'depot', libelle: 'Dépôt', valeur: (b) => (b.warehouse_id ? depots.get(b.warehouse_id) ?? null : 'Sans dépôt') },
    { id: 'total', libelle: 'Total (GNF)', valeur: (b) => b.total_amount, rendu: (b) => montantGnf(b.total_amount), alignement: 'droite' },
    { id: 'livraison', libelle: 'Livraison prévue', valeur: (b) => b.expected_delivery_date, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (b) => STATUTS_BON[b.status]?.texte ?? b.status,
      rendu: (b) => <Puce teinte={STATUTS_BON[b.status]?.teinte ?? 'gris'}>{STATUTS_BON[b.status]?.texte ?? b.status}</Puce> },
  ], [fournisseurs, depots]);
  const filtres = useMemo<FiltreListe<Bon>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_BON).map(([valeur, s]) => ({ valeur, libelle: s.texte })), correspond: (b, v) => b.status === v },
    { id: 'fournisseur', libelle: 'Fournisseur', options: [...fournisseurs].map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (b, v) => b.supplier_id === v },
  ], [fournisseurs]);

  return (
    <PageListe
      vue={VUE_ACHATS}
      titre="Achats"
      sousTitre="Bons de commande : brouillon, soumission, approbation par une autre personne, réception vers le stock"
      lignes={bons}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un bon, un fournisseur..."
      cle={(b) => b.id}
      libelleOuverture={(b) => `Ouvrir ${b.po_number}`}
      actions={peutAcheter && (
        <a href={routeNouveau(VUE_ACHATS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouveau bon de commande
        </a>
      )}
      nomExport="bons-de-commande"
      vide={{ message: 'Aucun bon de commande', detail: 'Un bon se crée en brouillon, puis se soumet à approbation.' }}
      onActualiser={charger}
      provenance={<Provenance source="bons de commande enregistrés par les fonctions serveur ; totaux recalculés par le serveur" heure={heure} />}
    />
  );
};
