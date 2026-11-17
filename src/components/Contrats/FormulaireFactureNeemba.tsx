import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  MODULE_FACTURES_NEEMBA, UNITES, VUE_FACTURES_NEEMBA, erreursFactureF, ligneVide, lignesPourServeur, nombre,
  type ContratLoueur, type LigneSaisie,
} from './facturesNeemba';

// Saisie d'une facture recue du loueur en pleine page (D-032, D-033,
// D-090) : en-tete et lignes en une seule transaction serveur
// (saisir_facture_fournisseur, D-078) ; une ligne refusee annule la facture.

const saisieVide = () => ({ contrat: '', numero: '', date: '', debut: '', fin: '', ht: '', lignes: [ligneVide()] });

export const FormulaireFactureNeemba = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<ContratLoueur[] | null>(null);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie(saisieVide());

  useEffect(() => {
    Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie, devise, nature').eq('nature', 'location').order('reference'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('contrat_tarifs').select('categorie_materiel'),
    ]).then(([c, v, t]) => {
      setErreurChargement(c.error ? `Contrats indisponibles : ${c.error.message}` : '');
      const liste = ((c.data ?? []) as ContratLoueur[]).filter((x) => x.nature === 'location');
      setContrats(liste);
      setEngins((v.data ?? []) as { id: string; registration: string }[]);
      setCategories([...new Set(((t.data ?? []) as { categorie_materiel: string | null }[]).map((x) => x.categorie_materiel).filter((x): x is string => Boolean(x)))]);
      // Un seul contrat de location : il est propose, pas invente.
      if (liste.length === 1) initialiser({ ...saisieVide(), contrat: liste[0].id });
    });
  }, [initialiser]);

  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const devise = contrats?.find((c) => c.id === f.contrat)?.devise ?? '';
  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur les contrats requis.'] : []), ...erreursFactureF(f, f.lignes)];
  const majLigne = (i: number, l: Partial<LigneSaisie>) => poser('lignes', f.lignes.map((x, j) => (j === i ? { ...x, ...l } : x)));

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('saisir_facture_fournisseur', {
      p_contrat_id: f.contrat, p_numero: f.numero.trim(), p_date: f.date, p_debut: f.debut, p_fin: f.fin,
      p_montant_ht: nombre(f.ht), p_lignes: lignesPourServeur(f.lignes, immat),
    });
    if (error) return { erreur: error.code === '23505' ? 'Ce numéro de facture existe déjà pour ce contrat' : error.message };
    poserAnnonce('Facture saisie : lancez le contrôle.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_FACTURES_NEEMBA, data) : routeListe(VUE_FACTURES_NEEMBA) };
  };

  return (
    <PageFormulaire
      vue={VUE_FACTURES_NEEMBA}
      module={MODULE_FACTURES_NEEMBA}
      titre="Saisir une facture reçue"
      description="Facture du loueur telle que reçue ; le contrôle contre le contrat, les pointages et les kilomètres se lance ensuite depuis sa fiche."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer la facture"
      chargement={contrats === null}
      erreurChargement={erreurChargement}
    >
      {contrats?.length === 0 && <ReferentielVide>Aucun contrat de location : saisissez le contrat Neemba (nature « Location ») et ses tarifs dans le dossier contractuel (Contrats & Finance → Contrats).</ReferentielVide>}
      <SectionFormulaire titre="En-tête">
        <ChampPage libelle="Contrat *" className="sm:col-span-2">
          <select value={f.contrat} onChange={(e) => poser('contrat', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(contrats ?? []).map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="N° de facture *"><input value={f.numero} onChange={(e) => poser('numero', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Date *"><input type="date" value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Période du *"><input type="date" value={f.debut} onChange={(e) => poser('debut', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="au *"><input type="date" value={f.fin} onChange={(e) => poser('fin', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Montant HT facturé *" aide={devise ? `En ${devise}, devise du contrat.` : undefined}>
          <input inputMode="decimal" value={f.ht} onChange={(e) => poser('ht', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>

      <fieldset className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Lignes de la facture</legend>
        {f.lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 md:grid-cols-8">
            <label className="text-sm md:col-span-2">Engin
              <select aria-label={`Ligne ${i + 1} engin`} value={l.vehicule} onChange={(e) => majLigne(i, { vehicule: e.target.value })} className={CHAMP_FENETRE}>
                <option value="">Sans engin (frais)</option>
                {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
              </select>
            </label>
            <label className="text-sm">Catégorie
              <select aria-label={`Ligne ${i + 1} catégorie`} value={l.categorie} onChange={(e) => majLigne(i, { categorie: e.target.value })} className={CHAMP_FENETRE}>
                <option value="">—</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm">Quantité<input aria-label={`Ligne ${i + 1} quantité`} inputMode="decimal" value={l.quantite} onChange={(e) => majLigne(i, { quantite: e.target.value })} className={CHAMP_FENETRE} /></label>
            <label className="text-sm">Unité
              <select aria-label={`Ligne ${i + 1} unité`} value={l.unite} onChange={(e) => majLigne(i, { unite: e.target.value })} className={CHAMP_FENETRE}>
                {Object.entries(UNITES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">Taux<input aria-label={`Ligne ${i + 1} taux`} inputMode="decimal" value={l.taux} onChange={(e) => majLigne(i, { taux: e.target.value })} className={CHAMP_FENETRE} /></label>
            <label className="text-sm">Montant *<input aria-label={`Ligne ${i + 1} montant`} inputMode="decimal" value={l.montant} onChange={(e) => majLigne(i, { montant: e.target.value })} className={CHAMP_FENETRE} /></label>
            <div className="flex items-end gap-1">
              {!l.vehicule && <input aria-label={`Ligne ${i + 1} libellé`} placeholder="Libellé" value={l.libelle} onChange={(e) => majLigne(i, { libelle: e.target.value })} className={CHAMP_FENETRE} />}
              <button type="button" onClick={() => poser('lignes', f.lignes.filter((_, j) => j !== i))} className="rounded p-2 text-stone-400 hover:text-red-600" aria-label={`Retirer la ligne ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => poser('lignes', [...f.lignes, ligneVide()])} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Ligne</button>
      </fieldset>
    </PageFormulaire>
  );
};
