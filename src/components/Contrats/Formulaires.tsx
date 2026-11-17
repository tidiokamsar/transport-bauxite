import { useEffect, useState, type ReactNode } from 'react';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { supabase } from '../../lib/supabase';
import {
  INDICATEURS, MODULE_CONTRATS, NATURES, PERIODICITES, RENOUVELLEMENTS, TYPES_CLAUSE, UNITES_TARIF, VUE_CONTRATS, erreursContrat,
  type Clause, type Contrat, type Engagement, type Tarif, type Version,
} from './types';

// Saisie du dossier contractuel en pleine page (D-026, D-090, remplace les
// fenetres modales). Ecriture inchangee : directe sous RLS (module
// contracts) pour le contrat, ses versions, tarifs et engagements, chaque
// ecriture journalisee par le serveur (journal_contrats) ; fonctions
// serveur pour l'avenant (creer_avenant), le tarif en vigueur
// (modifier_tarif_par_avenant) et la clause (definir_clause).

const CHAMP = CHAMP_FENETRE;
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
const texte = (v: string) => (v.trim() === '' ? null : v.trim());
const messageServeur = (error: { code?: string; message: string }) => (error.code === '23505' ? 'Cette référence ou ce numéro existe déjà.' : error.message);

/** Saisie modifiee : comparaison avec la saisie initiale. */
const useSaisieLocale = <V extends Record<string, unknown>>(initiale: V) => {
  const [origine] = useState(initiale);
  const [f, setF] = useState(initiale);
  return { f, setF, modifie: JSON.stringify(f) !== JSON.stringify(origine) };
};

const Champ = ({ libelle, large = false, aide, children }: { libelle: string; large?: boolean; aide?: ReactNode; children: ReactNode }) => (
  <ChampPage libelle={libelle} aide={aide} className={large ? 'sm:col-span-2' : ''}>{children}</ChampPage>
);

const Choix = ({ valeur, options, onChange }: { valeur: string; options: Record<string, string>; onChange: (v: string) => void }) => (
  <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>
    {Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
  </select>
);

/** Page de saisie d'un element du contrat ; retour a la grille de la fiche apres succes. */
const SaisieElement = ({ contrat, titre, description, modifie, erreurs, enregistrer, succes, children }: {
  contrat: Contrat;
  titre: string;
  description?: ReactNode;
  modifie: boolean;
  erreurs: string[];
  /** Renvoie le message d'erreur du serveur, ou null. */
  enregistrer: () => Promise<string | null>;
  succes: string;
  children: ReactNode;
}) => (
  <PageFormulaire
    vue={VUE_CONTRATS}
    module={MODULE_CONTRATS}
    titre={titre}
    reference={contrat.reference}
    id={contrat.id}
    description={description}
    modifie={modifie}
    erreurs={erreurs}
    libelleSoumettre="Enregistrer"
    onSoumettre={async () => {
      const erreur = await enregistrer();
      if (erreur) return { erreur };
      poserAnnonce(succes);
      return { vers: routeDetail(VUE_CONTRATS, contrat.id, 'grille') };
    }}
  >
    <SectionFormulaire titre={titre}>{children}</SectionFormulaire>
  </PageFormulaire>
);

const ecrire = async (table: string, id: string | undefined, ligne: Record<string, unknown>) => {
  const { error } = id ? await supabase.from(table).update(ligne).eq('id', id) : await supabase.from(table).insert(ligne);
  return error ? messageServeur(error) : null;
};

/** Contrat : creation (brouillon) ou modification ; le statut change par l'action « Changer le statut ». */
export const FormulaireContrat = ({ contrat, chargement, erreurChargement }: { contrat?: Contrat | null; chargement?: boolean; erreurChargement?: string }) => {
  const initiale = {
    reference: contrat?.reference ?? '', intitule: contrat?.intitule ?? '', nature: contrat?.nature ?? '', contrepartie: contrat?.contrepartie ?? '',
    devise: contrat?.devise ?? '', date_debut: contrat?.date_debut ?? '', date_fin: contrat?.date_fin ?? '',
    delai: contrat?.delai_paiement_jours?.toString() ?? '', description: contrat?.description ?? '', preavis: contrat?.preavis_jours?.toString() ?? '',
    renouvellement: contrat?.renouvellement ?? '', duree: contrat?.renouvellement_duree_mois?.toString() ?? '',
  };
  const { f, setF, modifie } = useSaisieLocale(initiale);
  const corps = {
    reference: f.reference.trim(), intitule: f.intitule.trim(), nature: f.nature, contrepartie: f.contrepartie.trim(),
    devise: f.devise, date_debut: f.date_debut, date_fin: f.date_fin || null,
    delai_paiement_jours: nombre(f.delai), description: texte(f.description),
    preavis_jours: nombre(f.preavis), renouvellement: f.renouvellement || null, renouvellement_duree_mois: nombre(f.duree),
  };

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    if (contrat) {
      const { error } = await supabase.from('contrats').update(corps).eq('id', contrat.id);
      if (error) return { erreur: messageServeur(error) };
      poserAnnonce('Contrat mis à jour (modification journalisée).');
      return { vers: routeDetail(VUE_CONTRATS, contrat.id) };
    }
    const { data, error } = await supabase.from('contrats').insert({ ...corps, statut: 'brouillon' }).select('id');
    if (error) return { erreur: messageServeur(error) };
    const nouveau = (data as { id: string }[] | null)?.[0]?.id;
    poserAnnonce('Contrat créé en brouillon : saisissez le contrat initial et sa grille.');
    return { vers: nouveau ? routeDetail(VUE_CONTRATS, nouveau) : routeListe(VUE_CONTRATS) };
  };

  return (
    <PageFormulaire
      vue={VUE_CONTRATS}
      module={MODULE_CONTRATS}
      titre={contrat ? `Modifier ${contrat.reference}` : 'Nouveau contrat'}
      reference={contrat?.reference}
      id={contrat?.id}
      description={contrat ? 'Le statut se change par l\'action « Changer le statut » de la fiche.' : 'Le contrat est créé en brouillon : saisir le contrat initial et sa grille, puis l\'activer.'}
      modifie={modifie}
      erreurs={erreursContrat(f)}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Identification">
        <Champ libelle="Référence *"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Contrepartie *"><input value={f.contrepartie} onChange={(e) => setF({ ...f, contrepartie: e.target.value })} placeholder="CBG, Neemba..." className={CHAMP} /></Champ>
        <Champ libelle="Intitulé *" large><input value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Nature *"><Choix valeur={f.nature} options={NATURES} onChange={(nature) => setF({ ...f, nature: nature as Contrat['nature'] })} /></Champ>
        <Champ libelle="Devise (code ISO) *">
          <input value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value.toUpperCase().slice(0, 3) })} placeholder="GNF, USD..." className={CHAMP} />
        </Champ>
      </SectionFormulaire>
      <SectionFormulaire titre="Durée et paiement">
        <Champ libelle="Début *"><input type="date" value={f.date_debut} onChange={(e) => setF({ ...f, date_debut: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Fin"><input type="date" value={f.date_fin} onChange={(e) => setF({ ...f, date_fin: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Délai de paiement (jours)"><input inputMode="numeric" value={f.delai} onChange={(e) => setF({ ...f, delai: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Préavis de dénonciation (jours)"><input inputMode="numeric" value={f.preavis} onChange={(e) => setF({ ...f, preavis: e.target.value })} placeholder="Selon le contrat" className={CHAMP} /></Champ>
        <Champ libelle="Renouvellement">
          <select value={f.renouvellement} onChange={(e) => setF({ ...f, renouvellement: e.target.value as typeof f.renouvellement })} className={CHAMP}>
            <option value="">Non renseigné</option>
            {Object.entries(RENOUVELLEMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Champ>
        <Champ libelle="Durée d'un renouvellement (mois)"><input inputMode="numeric" value={f.duree} onChange={(e) => setF({ ...f, duree: e.target.value })} className={CHAMP} /></Champ>
        <Champ libelle="Description" large><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={CHAMP} /></Champ>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const FormulaireVersion = ({ contrat, version, numeroSuivant }: { contrat: Contrat; version?: Version; numeroSuivant: number }) => {
  const { f, setF, modifie } = useSaisieLocale({
    numero: (version?.numero ?? numeroSuivant).toString(), intitule: version?.intitule ?? '', date_effet: version?.date_effet ?? '',
    date_signature: version?.date_signature ?? '', resume: version?.resume ?? '', document_ref: version?.document_ref ?? '',
  });
  const numero = nombre(f.numero);
  const ligne = {
    contrat_id: contrat.id, numero, intitule: f.intitule.trim(), date_effet: f.date_effet,
    date_signature: f.date_signature || null, resume: texte(f.resume), document_ref: texte(f.document_ref),
  };
  // Contrat initial : saisie directe ; avenant : toujours par creer_avenant
  // (numero suivant, reprise de la grille, tout ou rien, D-079).
  const avecReprise = !version && numeroSuivant > 0;
  const erreurs = [
    ...(numero === null || Number.isNaN(numero) || numero < 0 ? ['Numéro de version : 0 pour le contrat initial, puis 1, 2...'] : []),
    ...(!f.intitule.trim() ? ['Intitulé obligatoire.'] : []),
    ...(!f.date_effet ? ['Date d\'effet obligatoire.'] : []),
  ];
  const enregistrer = async () => {
    if (!avecReprise) return ecrire('contrat_versions', version?.id, ligne);
    const { error } = await supabase.rpc('creer_avenant', {
      p_contrat: contrat.id, p_numero: numero, p_intitule: ligne.intitule, p_date_effet: ligne.date_effet,
      p_date_signature: ligne.date_signature, p_resume: ligne.resume, p_document_ref: ligne.document_ref,
    });
    return error ? (error.code === '23505' ? 'Ce numéro de version existe déjà.' : `Avenant refusé : ${error.message}`) : null;
  };
  return (
    <SaisieElement
      contrat={contrat}
      titre={version ? 'Modifier la version' : numeroSuivant === 0 ? 'Contrat initial' : `Nouvel avenant (n° ${numeroSuivant})`}
      description={avecReprise ? 'L\'avenant reprend les tarifs, engagements et clauses de la dernière version. Sa date d\'effet suit celle de toute version et de toute période déjà facturée ; il se complète ensuite tant que sa date d\'effet n\'est pas atteinte.' : undefined}
      modifie={modifie}
      erreurs={erreurs}
      enregistrer={enregistrer}
      succes={version ? 'Version mise à jour.' : avecReprise ? 'Avenant créé : la grille de la version précédente est reprise.' : 'Contrat initial enregistré.'}
    >
      <Champ libelle="Numéro (0 = contrat initial) *"><input inputMode="numeric" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Date d'effet *"><input type="date" value={f.date_effet} onChange={(e) => setF({ ...f, date_effet: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Intitulé *" large><input value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Date de signature"><input type="date" value={f.date_signature} onChange={(e) => setF({ ...f, date_signature: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Référence du document"><input value={f.document_ref} onChange={(e) => setF({ ...f, document_ref: e.target.value })} placeholder="Classement, lien..." className={CHAMP} /></Champ>
      <Champ libelle="Résumé des changements" large><textarea value={f.resume} onChange={(e) => setF({ ...f, resume: e.target.value })} rows={3} className={CHAMP} /></Champ>
    </SaisieElement>
  );
};

/**
 * Tarif en vigueur d'un contrat qui n'est plus brouillon (D-033, D-079) : il
 * ne se modifie pas sur place. La page cree un avenant (fonction serveur)
 * qui reprend toute la grille, le tarif portant le nouveau prix.
 */
const FormulaireTarifParAvenant = ({ contrat, tarif, dateEffetVersion }: { contrat: Contrat; tarif: Tarif; dateEffetVersion: string }) => {
  const { f, setF, modifie } = useSaisieLocale({
    prix: tarif.prix?.toString() ?? '', libelle: tarif.libelle, conditions: tarif.conditions ?? '', intitule: '', date_effet: '', resume: '',
  });
  const prix = nombre(f.prix);
  const erreurs = [
    ...(prix === null || Number.isNaN(prix) || prix < 0 ? ['Nouveau prix unitaire (0 ou plus).'] : []),
    ...(!f.libelle.trim() ? ['Libellé obligatoire.'] : []),
    ...(!f.intitule.trim() ? ['Intitulé de l\'avenant obligatoire.'] : []),
    ...(!f.date_effet || f.date_effet <= dateEffetVersion ? [`Date d'effet de l'avenant après le ${dateEffetVersion}.`] : []),
  ];
  return (
    <SaisieElement
      contrat={contrat}
      titre="Modifier un tarif en vigueur par avenant"
      description="Ce tarif est en vigueur sur un contrat actif : il ne se modifie pas sur place. L'enregistrement crée un avenant (nouvelle version) qui reprend toute la grille, avec le nouveau prix pour ce tarif. La version actuelle reste intacte."
      modifie={modifie}
      erreurs={erreurs}
      succes="Avenant créé avec le nouveau tarif."
      enregistrer={async () => {
        const { error } = await supabase.rpc('modifier_tarif_par_avenant', {
          p_tarif: tarif.id, p_prix: prix, p_intitule: f.intitule.trim(), p_date_effet: f.date_effet,
          p_libelle: f.libelle.trim(), p_conditions: f.conditions.trim(), p_resume: texte(f.resume),
        });
        return error ? `Avenant refusé : ${error.message}` : null;
      }}
    >
      <Champ libelle="Nouveau prix unitaire *"><input inputMode="decimal" value={f.prix} onChange={(e) => setF({ ...f, prix: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Libellé *"><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Conditions" large><input value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Intitulé de l'avenant *" large><input value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle={`Date d'effet de l'avenant * (après le ${dateEffetVersion})`}><input type="date" value={f.date_effet} onChange={(e) => setF({ ...f, date_effet: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Résumé des changements"><input value={f.resume} onChange={(e) => setF({ ...f, resume: e.target.value })} className={CHAMP} /></Champ>
    </SaisieElement>
  );
};

export const FormulaireTarif = ({ contrat, versionId, tarif, parAvenant }: {
  contrat: Contrat; versionId: string; tarif?: Tarif; parAvenant?: { dateEffetVersion: string };
}) => {
  if (tarif && parAvenant) return <FormulaireTarifParAvenant contrat={contrat} tarif={tarif} dateEffetVersion={parAvenant.dateEffetVersion} />;
  return <FormulaireTarifDirect contrat={contrat} versionId={versionId} tarif={tarif} />;
};

const FormulaireTarifDirect = ({ contrat, versionId, tarif }: { contrat: Contrat; versionId: string; tarif?: Tarif }) => {
  const { f, setF, modifie } = useSaisieLocale({
    libelle: tarif?.libelle ?? '', unite: tarif?.unite ?? '', prix: tarif?.prix?.toString() ?? '', categorie: tarif?.categorie_materiel ?? '',
    engin: tarif?.engin ?? '', conditions: tarif?.conditions ?? '',
    retourVide: tarif?.km_retour_vide_facturable == null ? '' : String(tarif.km_retour_vide_facturable),
  });
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  useEffect(() => {
    supabase.from('vehicles').select('id, registration').order('registration')
      .then(({ data }) => setEngins((data as { id: string; registration: string }[] | null) ?? []));
  }, []);
  const prix = nombre(f.prix);
  const erreurs = [
    ...(!f.libelle.trim() ? ['Libellé obligatoire.'] : []),
    ...(!f.unite ? ['Unité obligatoire.'] : []),
    ...(prix === null || Number.isNaN(prix) || prix < 0 ? ['Prix unitaire (0 ou plus).'] : []),
  ];
  return (
    <SaisieElement
      contrat={contrat}
      titre={tarif ? 'Modifier le tarif' : 'Nouveau tarif'}
      modifie={modifie}
      erreurs={erreurs}
      succes={tarif ? 'Tarif mis à jour.' : 'Tarif ajouté.'}
      enregistrer={() => ecrire('contrat_tarifs', tarif?.id, {
        version_id: versionId, libelle: f.libelle.trim(), unite: f.unite, prix,
        categorie_materiel: texte(f.categorie), engin: f.engin || null, conditions: texte(f.conditions),
        km_retour_vide_facturable: f.unite === 'km' && f.retourVide !== '' ? f.retourVide === 'true' : null,
      })}
    >
      <Champ libelle="Libellé *" large><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Unité *"><Choix valeur={f.unite} options={UNITES_TARIF} onChange={(unite) => setF({ ...f, unite })} /></Champ>
      <Champ libelle="Prix unitaire *"><input inputMode="decimal" value={f.prix} onChange={(e) => setF({ ...f, prix: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Engin (tarif propre à cet engin, D-033)">
        <select value={f.engin} onChange={(e) => setF({ ...f, engin: e.target.value })} className={CHAMP}>
          <option value="">Tous (catégorie ou tarif unique)</option>
          {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
        </select>
      </Champ>
      <Champ libelle="Catégorie de matériel"><input value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} placeholder="Semi-remorque, chargeuse..." className={CHAMP} /></Champ>
      <Champ libelle="Conditions"><input value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} className={CHAMP} /></Champ>
      {f.unite === 'km' && <Champ libelle="Retour à vide facturable (D-043)">
        <select value={f.retourVide} onChange={(e) => setF({ ...f, retourVide: e.target.value })} className={CHAMP}>
          <option value="">À confirmer (kilomètres non contrôlés)</option>
          <option value="true">Oui : trajet chargé et retour à vide</option>
          <option value="false">Non : trajet chargé seulement</option>
        </select>
      </Champ>}
    </SaisieElement>
  );
};

export const FormulaireEngagement = ({ contrat, versionId, engagement }: { contrat: Contrat; versionId: string; engagement?: Engagement }) => {
  const { f, setF, modifie } = useSaisieLocale({
    indicateur: engagement?.indicateur ?? '', libelle: engagement?.libelle ?? '', seuil: engagement?.seuil?.toString() ?? '', unite: engagement?.unite ?? '',
    sens: engagement?.sens ?? '', periodicite: engagement?.periodicite ?? '', consequence: engagement?.consequence ?? '',
  });
  const seuil = nombre(f.seuil);
  const erreurs = [
    ...(!f.indicateur ? ['Indicateur obligatoire.'] : []),
    ...(!f.libelle.trim() ? ['Libellé contractuel obligatoire.'] : []),
    ...(seuil === null || Number.isNaN(seuil) ? ['Seuil obligatoire.'] : []),
    ...(!f.unite.trim() ? ['Unité obligatoire.'] : []),
    ...(!f.sens ? ['Sens (minimum ou maximum) obligatoire.'] : []),
    ...(!f.periodicite ? ['Périodicité obligatoire.'] : []),
  ];
  return (
    <SaisieElement
      contrat={contrat}
      titre={engagement ? 'Modifier l\'engagement' : 'Nouvel engagement'}
      modifie={modifie}
      erreurs={erreurs}
      succes={engagement ? 'Engagement mis à jour.' : 'Engagement ajouté.'}
      enregistrer={() => ecrire('contrat_engagements', engagement?.id, {
        version_id: versionId, indicateur: f.indicateur, libelle: f.libelle.trim(), seuil, unite: f.unite.trim(),
        sens: f.sens, periodicite: f.periodicite, consequence: texte(f.consequence),
      })}
    >
      <Champ libelle="Indicateur *">
        <Choix valeur={f.indicateur} options={INDICATEURS} onChange={(indicateur) => setF({ ...f, indicateur, libelle: f.libelle || INDICATEURS[indicateur] || '' })} />
      </Champ>
      <Champ libelle="Libellé contractuel *"><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Seuil *"><input inputMode="decimal" value={f.seuil} onChange={(e) => setF({ ...f, seuil: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Unité *"><input value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value })} placeholder="%, min, km, L/h..." className={CHAMP} /></Champ>
      <Champ libelle="Sens *"><Choix valeur={f.sens} options={{ minimum: 'Au moins (minimum)', maximum: 'Au plus (maximum)' }} onChange={(sens) => setF({ ...f, sens: sens as Engagement['sens'] })} /></Champ>
      <Champ libelle="Périodicité *"><Choix valeur={f.periodicite} options={PERIODICITES} onChange={(periodicite) => setF({ ...f, periodicite })} /></Champ>
      <Champ libelle="Conséquence (pénalité, bonus, clause)" large><textarea value={f.consequence} onChange={(e) => setF({ ...f, consequence: e.target.value })} rows={2} className={CHAMP} /></Champ>
    </SaisieElement>
  );
};

/** Clause chiffree (D-065) : ecrite par la fonction serveur definir_clause. */
export const FormulaireClause = ({ contrat, versionId, engagements, clause }: {
  contrat: Contrat; versionId: string; engagements: Engagement[]; clause?: Clause;
}) => {
  const { f, setF, modifie } = useSaisieLocale({
    type: clause?.type_clause ?? '', libelle: clause?.libelle ?? '', engagement: clause?.engagement_id ?? '', declenchement: clause?.declenchement ?? '',
    base: clause?.base ?? '', valeur: clause?.valeur?.toString() ?? '', plafond: clause?.plafond_ht?.toString() ?? '', article: clause?.article ?? '',
  });
  const devise = contrat.devise;
  const mesurables = engagements.filter((e) => e.indicateur !== 'autre');
  const valeur = nombre(f.valeur);
  const plafond = nombre(f.plafond);
  const erreurs = [
    ...(!f.type ? ['Type de clause obligatoire.'] : []),
    ...(!f.libelle.trim() ? ['Libellé obligatoire.'] : []),
    ...(!f.engagement ? ['Engagement mesuré (condition) obligatoire.'] : []),
    ...(!f.declenchement ? ['Déclenchement obligatoire.'] : []),
    ...(!f.base ? ['Base (montant ou taux) obligatoire.'] : []),
    ...(valeur === null || Number.isNaN(valeur) || valeur <= 0 || (f.base === 'taux' && valeur > 100) ? ['Valeur supérieure à zéro (taux au plus 100 %).'] : []),
    ...(plafond !== null && (Number.isNaN(plafond) || plafond <= 0) ? ['Plafond supérieur à zéro, ou vide.'] : []),
  ];
  return (
    <SaisieElement
      contrat={contrat}
      titre={clause ? 'Modifier la clause' : 'Nouvelle clause chiffrée'}
      description={mesurables.length === 0 ? 'Aucun engagement mesuré dans cette version : saisissez d\'abord l\'engagement qui conditionne la clause.' : undefined}
      modifie={modifie}
      erreurs={erreurs}
      succes={clause ? 'Clause mise à jour.' : 'Clause ajoutée.'}
      enregistrer={async () => {
        const { error } = await supabase.rpc('definir_clause', {
          p_version: versionId, p_type: f.type, p_libelle: f.libelle.trim(), p_engagement: f.engagement, p_declenchement: f.declenchement,
          p_base: f.base, p_valeur: valeur, p_plafond: plafond, p_article: texte(f.article), p_ordre: clause?.ordre ?? 0, p_id: clause?.id ?? null,
        });
        return error ? error.message : null;
      }}
    >
      <Champ libelle="Type *"><Choix valeur={f.type} options={TYPES_CLAUSE} onChange={(type) => setF({ ...f, type })} /></Champ>
      <Champ libelle="Libellé *"><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Engagement mesuré (condition) *">
        <select value={f.engagement} onChange={(e) => setF({ ...f, engagement: e.target.value })} className={CHAMP}>
          <option value="">Choisir</option>
          {mesurables.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
        </select>
      </Champ>
      <Champ libelle="Déclenchement *"><Choix valeur={f.declenchement} options={{ non_tenu: 'Engagement non tenu', tenu: 'Engagement tenu' }} onChange={(declenchement) => setF({ ...f, declenchement })} /></Champ>
      <Champ libelle="Base *"><Choix valeur={f.base} options={{ montant: `Montant fixe HT (${devise})`, taux: "Taux de l'assiette facturée HT (%)" }} onChange={(base) => setF({ ...f, base })} /></Champ>
      <Champ libelle={f.base === 'taux' ? 'Taux (%) *' : `Montant HT (${devise}) *`}><input inputMode="decimal" value={f.valeur} onChange={(e) => setF({ ...f, valeur: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle={`Plafond HT par période (${devise})`}><input inputMode="decimal" value={f.plafond} onChange={(e) => setF({ ...f, plafond: e.target.value })} placeholder="Aucun" className={CHAMP} /></Champ>
      <Champ libelle="Article du contrat"><input value={f.article} onChange={(e) => setF({ ...f, article: e.target.value })} className={CHAMP} /></Champ>
    </SaisieElement>
  );
};
