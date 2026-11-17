import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { routeDetail, routeListe } from '../ui/routeur';
import { FormulaireClause, FormulaireEngagement, FormulaireTarif, FormulaireVersion } from './Formulaires';
import { useDossier } from './dossier';
import { MODULE_CONTRATS, STATUTS, VUE_CONTRATS, grilleVerrouillee, libelleVersion, type Contrat } from './types';

// Pages d'action et de saisie d'un element du dossier contractuel (D-026,
// D-065, D-079, D-090) : version, tarif, engagement, clause, statut,
// renouvellement, denonciation, suppression d'un brouillon jamais utilise,
// desactivation d'une clause. Ecritures inchangees (table sous RLS ou
// fonction serveur) ; motif exige quand le serveur le conserve.

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const jour = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR') : '—');

const TABLES_SUPPRIMABLES: Record<string, string> = {
  contrats: 'le contrat', contrat_versions: 'la version', contrat_tarifs: 'le tarif', contrat_engagements: 'l\'engagement',
};

export const ActionContrat = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const d = useDossier(id);
  const c = d.c;
  const [champs, setChamps] = useState({ statut: '', date: aujourdhui(), fin: '', document: '' });

  const commun = {
    vue: VUE_CONTRATS, module: MODULE_CONTRATS, reference: c?.reference ?? 'Contrat', id,
    chargement: !d.pret && !d.contrat.erreur, erreurChargement: d.contrat.erreur || (d.contrat.lignes !== null && !c ? 'Contrat introuvable ou non visible avec vos droits.' : '') || d.erreurGrille,
  };
  const sansDroit = !peutEcrire ? 'Droit d\'écriture sur les contrats requis.' : null;
  const inconnu = (quoi: string) => <SansDonnees message={`${quoi} introuvable`} detail="L'élément demandé n'appartient pas à ce contrat ou n'est pas visible avec vos droits." />;

  // Pages de saisie : affichees une fois le dossier lu (saisie initiale exacte).
  if (['version', 'tarif', 'engagement', 'clause'].includes(action)) {
    if (!d.pret || !c) {
      return <PageAction {...commun} titre="Saisie du contrat" motif="aucun" libelleConfirmer="Enregistrer" onExecuter={async () => null} messageSucces="" interdit={commun.erreurChargement ? null : sansDroit} />;
    }
    if (sansDroit) return <PageAction {...commun} titre="Saisie du contrat" motif="aucun" libelleConfirmer="Enregistrer" onExecuter={async () => null} messageSucces="" interdit={sansDroit} />;
    if (action === 'version') {
      const v = requete.version ? d.versions.find((x) => x.id === requete.version) : undefined;
      if (requete.version && !v) return inconnu('Version');
      return <FormulaireVersion key={v?.id ?? 'nouvelle'} contrat={c} version={v} numeroSuivant={d.versions.length === 0 ? 0 : Math.max(...d.versions.map((x) => x.numero)) + 1} />;
    }
    const v = d.versions.find((x) => x.id === requete.version);
    if (!v) return inconnu('Version');
    const verrouillee = grilleVerrouillee(c.statut, v, aujourdhui());
    if (action === 'tarif') {
      const t = requete.tarif ? d.tarifs.find((x) => x.id === requete.tarif && x.version_id === v.id) : undefined;
      if (requete.tarif && !t) return inconnu('Tarif');
      if (!t && verrouillee) return <SansDonnees message="Version verrouillée" detail={`${libelleVersion(v)} est en vigueur sur un contrat actif : un nouveau tarif passe par un avenant.`} />;
      return <FormulaireTarif key={t?.id ?? 'nouveau'} contrat={c} versionId={v.id} tarif={t} parAvenant={t && verrouillee ? { dateEffetVersion: v.date_effet } : undefined} />;
    }
    if (verrouillee) return <SansDonnees message="Version verrouillée" detail={`${libelleVersion(v)} est en vigueur sur un contrat actif : ses engagements et clauses changent par avenant.`} />;
    if (action === 'engagement') {
      const e = requete.engagement ? d.engagements.find((x) => x.id === requete.engagement && x.version_id === v.id) : undefined;
      if (requete.engagement && !e) return inconnu('Engagement');
      return <FormulaireEngagement key={e?.id ?? 'nouveau'} contrat={c} versionId={v.id} engagement={e} />;
    }
    const k = requete.clause ? d.clauses.find((x) => x.id === requete.clause && x.version_id === v.id) : undefined;
    if (requete.clause && !k) return inconnu('Clause');
    return <FormulaireClause key={k?.id ?? 'nouvelle'} contrat={c} versionId={v.id} engagements={d.engagements.filter((e) => e.version_id === v.id)} clause={k} />;
  }

  if (action === 'statut') {
    return (
      <PageAction
        {...commun}
        titre={`Changer le statut de ${c?.reference ?? 'ce contrat'}`}
        description={c && <>Statut actuel : <b>{STATUTS[c.statut]?.libelle ?? c.statut}</b>. Le changement est journalisé par le serveur (journal du contrat).</>}
        motif="aucun"
        libelleConfirmer="Enregistrer le statut"
        interdit={sansDroit}
        pret={Boolean(champs.statut) && champs.statut !== c?.statut}
        messageSucces="Statut du contrat mis à jour."
        onExecuter={async () => {
          const { error } = await supabase.from('contrats').update({ statut: champs.statut }).eq('id', id);
          return error ? error.message : null;
        }}
      >
        <ChampPage libelle="Nouveau statut *">
          <select value={champs.statut} onChange={(e) => setChamps({ ...champs, statut: e.target.value })} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {Object.entries(STATUTS).filter(([k]) => k !== c?.statut).map(([k, s]) => <option key={k} value={k}>{s.libelle}</option>)}
          </select>
        </ChampPage>
      </PageAction>
    );
  }

  if (action === 'renouveler' || action === 'denoncer') {
    const renouveler = action === 'renouveler';
    const possible = (x: Contrat) => Boolean(x.date_fin) && ['actif', 'suspendu'].includes(x.statut);
    const pret = Boolean(champs.date && champs.date <= aujourdhui() && (!renouveler || (champs.fin && c?.date_fin && champs.fin > c.date_fin)));
    return (
      <PageAction
        {...commun}
        titre={`${renouveler ? 'Renouvellement' : 'Dénonciation'} · ${c?.reference ?? ''}`.trim()}
        description={c && <>Fin actuelle : {jour(c.date_fin)}{c.preavis_jours != null ? ` · préavis ${c.preavis_jours} jours` : ''}. L'événement est enregistré avec son motif (fonction serveur, D-065).</>}
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Enregistrer"
        interdit={sansDroit ?? (c && !possible(c) ? 'Un contrat actif ou suspendu, avec une date de fin, se renouvelle ou se dénonce.' : null)}
        pret={pret}
        messageSucces={renouveler ? 'Renouvellement enregistré.' : 'Dénonciation enregistrée.'}
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('enregistrer_echeance_contrat', {
            p_contrat: id, p_evenement: renouveler ? 'renouvellement' : 'denonciation', p_date: champs.date, p_motif: motif,
            p_nouvelle_fin: renouveler ? champs.fin : null, p_document: champs.document.trim() || null,
          });
          return error ? error.message : null;
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChampPage libelle="Date de l'événement *"><input type="date" value={champs.date} max={aujourdhui()} onChange={(e) => setChamps({ ...champs, date: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          {renouveler && <ChampPage libelle="Nouvelle date de fin *" erreur={champs.fin && c?.date_fin && champs.fin <= c.date_fin ? 'Après la fin actuelle.' : null}>
            <input type="date" value={champs.fin} onChange={(e) => setChamps({ ...champs, fin: e.target.value })} className={CHAMP_FENETRE} />
          </ChampPage>}
          <ChampPage libelle="Référence du document"><input value={champs.document} onChange={(e) => setChamps({ ...champs, document: e.target.value })} placeholder="Avenant signé, courrier..." className={CHAMP_FENETRE} /></ChampPage>
        </div>
      </PageAction>
    );
  }

  if (action === 'supprimer') {
    const table = requete.table ?? '';
    const element = requete.element ?? '';
    const quoi = TABLES_SUPPRIMABLES[table];
    const libelle = table === 'contrats' ? c?.reference
      : table === 'contrat_versions' ? (() => { const v = d.versions.find((x) => x.id === element); return v && libelleVersion(v); })()
        : table === 'contrat_tarifs' ? d.tarifs.find((x) => x.id === element)?.libelle
          : d.engagements.find((x) => x.id === element)?.libelle;
    if (!quoi || !element) return <SansDonnees message="Suppression inconnue" detail="Élément du contrat non reconnu." />;
    return (
      <PageAction
        {...commun}
        titre={`Supprimer ${quoi}${libelle ? ` « ${libelle} »` : ''}`}
        description="Suppression réservée à un élément jamais utilisé d'un contrat brouillon : le serveur contrôle les dépendances et trace la suppression au journal. Sur un contrat actif : avenant, clôture ou changement de statut."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Supprimer"
        danger
        interdit={sansDroit ?? (c && c.statut !== 'brouillon' ? 'Seul un contrat brouillon permet une suppression.' : d.pret && !libelle ? 'Élément introuvable dans ce contrat.' : null)}
        messageSucces={table === 'contrats' ? 'Contrat supprimé (tracé au journal).' : 'Élément supprimé (tracé au journal).'}
        versApres={table === 'contrats' ? routeListe(VUE_CONTRATS) : routeDetail(VUE_CONTRATS, id, 'grille')}
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('supprimer_element_contrat', { p_table: table, p_id: element, p_motif: motif });
          return error ? `Suppression refusée : ${error.message}` : null;
        }}
      />
    );
  }

  if (action === 'desactiver-clause') {
    const k = d.clauses.find((x) => x.id === requete.clause) ?? null;
    return (
      <PageAction
        {...commun}
        titre={`Désactiver la clause${k ? ` « ${k.libelle} »` : ''}`}
        description="La clause reste dans la grille, barrée, avec son motif ; elle ne s'applique plus au calcul des clauses."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Désactiver"
        danger
        interdit={sansDroit ?? (d.pret && !k ? 'Clause introuvable dans ce contrat.' : k && !k.actif ? 'Clause déjà désactivée.' : null)}
        messageSucces="Clause désactivée."
        versApres={routeDetail(VUE_CONTRATS, id, 'grille')}
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('desactiver_clause', { p_id: k?.id, p_motif: motif });
          return error ? error.message : null;
        }}
      />
    );
  }

  return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du dossier contractuel.`} />;
};
