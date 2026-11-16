# Module 21 : Reporting et BI

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release journalisée 3bbfded,
démonstration purgée (D-076), aucune donnée réelle.

## 1. Objectifs et périmètre

Produire, sur les données enregistrées et avec les droits du lecteur, les
rapports qui justifient l'exploitation et la facturation : rapport
journalier et de shift pour l'exploitation de Nimba, rapport mensuel pour
la direction, rapport client pour CBG (tonnes livrées et acceptées,
tickets, écarts, factures), rapport loueur pour Neemba (heures pointées,
immobilisations, interventions, factures contrôlées), rapports financiers
et de performance. Un rapport transmis à un partenaire est figé
(append-only) pour être opposable. Jalons : J1 (rapport client de la
période facturée), J2 (coûts), J3 (rapports journaliers, de poste et
mensuels).

Décisions de référence : D-031 (rapport de performance mensuel figé),
D-030 (analyses flotte sur données réelles), D-048 (bilan figé du poste),
D-050 (écarts de relevé CBG), D-057 (indicateurs de référence), D-058
(rapports standard, format commun, rapports figés, coût direct par tonne),
D-063 (`rapport_production`), D-066 (`rapport_voyages`, `durees_voyages`),
D-072 R3-1 (rapports figés lus avec le droit de leur domaine), D-018 (nom du
produit seul sur les exports). Règle 5 : une valeur absente reste « sans
données » avec sa raison, jamais 0.

Entrées : tous les modules opérationnels et financiers. Sorties : exports
CSV, impression, rapports figés (pièces opposables), Command Center (01).

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 21.1 Rapports standard | Journalier, shift, mensuel (et jour par jour), client CBG, loueur Neemba, production planifié/réalisé, voyages par camion, chauffeur, site, shift |
| 21.2 Rapports financiers | Facturé, encaissé, créances, dettes, coûts directs, coût par tonne, rentabilité par devise |
| 21.3 Rapports de performance | Performance contractuelle (disponibilité, engagements), fiabilité des engins (MTBF, MTTR), performance chauffeurs, consommation |
| 21.4 Rapports figés | Instantané numéroté (RAP-AAAA-NNNNN), note, consultation et réexport |
| 21.5 Analyse libre | Générateur (choix des indicateurs, dimensions, filtres), tableaux croisés, graphiques, comparaisons |
| 21.6 Diffusion | Exports CSV, Excel, PDF, impression, planification d'envoi |

## 3. Menus et sous-menus

| Entrée (`menu.ts`, groupe `reporting` « Reporting & Analyse ») | Écran | Droit (`AuthContext.tsx:204-218`) |
|---|---|---|
| `reports` « Rapports » | `Reports/ReportsView` | `reports` lecture ; figer : `reports` création ou modification |
| `tco-analysis` « Coût direct par tonne » | `Analyses/AnalysesFlotte` `CoutTonneView` | `reports` |
| `fleet-health` « Santé de la flotte » | `SanteFlotteView` | `reports` |
| `predictive-maintenance` « Fiabilité des engins » | `FiabiliteEnginsView` | `reports` |
| `driver-behavior` « Performance chauffeurs » | `PerformanceChauffeursView` | `reports` |
| `iot-dashboard` « Capteurs IoT », `esg-tracking` « Environnement » | hors module (03 et 22) | `reports` |
| Rapports rattachés ailleurs | `Trips/RapportsVoyages` (onglet de `TripsView`), `Planning/ClotureProduction` (onglet de `PlanificationView`), `Contrats/EngagementsView` (rapport de performance) | droits du module hôte |

Rôles qui lisent `reports` dans la base de référence : admin, manager
(repris par director, operations_manager selon D-012), dispatcher,
logistician, accountant (`20260903000000_base_reference.sql:12320-12434`) ;
`contract_manager` lit et crée (`20261110230000_contrats_fondation.sql:45`).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Rapports | Choix du rapport, paramètres, résultat par section, export CSV, impression, figer, liste des rapports figés | DÉPLOYÉ | `src/components/Reports/ReportsView.tsx`, `src/lib/rapports.ts` ; fonctions de `20261118090000_reporting.sql` (et `20261120102000_correctifs_revue_r3.sql`) ; pgTAP `41_reporting` (28), `54_correctifs_revue_finance_reporting` (28) ; e2e `rapports.spec.ts` (3 tests Rapports) ; unitaires `src/lib/rapports.test.ts` (12) ; release f59a4b0 (PR #75) |
| Coût direct par tonne | Carburant, ordres de travail, pneus par engin et par tonne | DÉPLOYÉ | `AnalysesFlotte.tsx:221` (`consommation_carburant`, `maintenance_orders.actual_cost`, `tires.purchase_price`) ; D-030 ; release af80816 (PR #39). Limite : location Neemba et carburant valorisé hors coût (D-058) |
| Santé de la flotte | Disponibilité, immobilisations ouvertes, activité | DÉPLOYÉ | `AnalysesFlotte.tsx:156` |
| Fiabilité des engins | Pannes, MTTR, MTBF, disponibilité | DÉPLOYÉ | `AnalysesFlotte.tsx:48`, `fiabilite_engins(timestamptz, timestamptz)` ; pgTAP `17_analyses_flotte` ; e2e `analyses.spec.ts` |
| Performance chauffeurs | Voyages, tonnes, temps de cycle et de chargement, écart de pesée, litiges | DÉPLOYÉ | `AnalysesFlotte.tsx:111`, `performance_chauffeurs(date, date)` |
| Rapports voyages | Par camion, chauffeur, site, shift ; durées | DÉPLOYÉ (module 07) | `Trips/RapportsVoyages.tsx`, `rapport_voyages`, `durees_voyages` (`20261121100000_dispatch_voyages.sql`) ; pgTAP 49 ; release 3dc77d4 |
| Rapport de production | Planifié contre réalisé, causes d'écart | DÉPLOYÉ (module 04) | `Planning/ClotureProduction.tsx:93`, `rapport_production` (`20261121090000_planification_avancee.sql`) ; pgTAP 46 ; release bbf795a |
| Rapport de performance contractuel figé | Engagements de l'avenant contre réalisé | DÉPLOYÉ (module 19) | `Contrats/EngagementsView.tsx`, `rapports_performance` (D-031) |
| Rapports financiers de gestion | Facturé, encaissé, créances, coûts, marge | PARTIEL | sections factures du `rapport_client` et du `rapport_loueur` ; `CostsView` (module 20) ; pas de rapport de rentabilité (D-058 : non calculée) |
| Générateur de rapports | Indicateurs, dimensions, filtres libres | MANQUANT | hors périmètre de D-058 |
| Planification d'envoi | Abonnement, fréquence, destinataires | MANQUANT | pas de passerelle de courriel |

## 5. Widgets et tableaux de bord

| Widget | Source | État |
|---|---|---|
| Tableau jour par jour du mois (voyages, livrés, tonnes livrées et acceptées, gasoil, incidents, immobilisations, heures pointées) | `rapport_mensuel_par_jour` | DÉPLOYÉ (`ReportsView.tsx:190-206`) |
| Provenance et heure de calcul de chaque rapport | composant `Provenance` | DÉPLOYÉ |
| Compteur « N sans mesure » par ligne | colonne `manquants` | DÉPLOYÉ |
| Graphiques d'évolution des rapports | - | MANQUANT (aucun graphique dans `ReportsView` ni `AnalysesFlotte`) |
| Tableau de bord propre au module (rapports figés du mois, rapports attendus non figés) | `rapports_figes` | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Rapport calculé | - (calcul à la lecture) | DÉPLOYÉ | - | - | - | - | - |
| Rapport figé (`rapports_figes`) | DÉPLOYÉ (`figer_rapport`) | DÉPLOYÉ (20 derniers, `ReportsView.tsx:67`) | interdit (déclencheur `rapports_figes_immuables`) | - | MANQUANT (pas de recherche ni de pagination au-delà de 20) | interdit | figer un nouveau rapport ; lien « remplace » MANQUANT |
| Modèle de rapport personnalisé | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | brouillon seulement | - |
| Abonnement d'envoi | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT (suspendre) | MANQUANT | - |

## 7. Modals et drawers

| Modal | État |
|---|---|
| Note jointe au rapport figé | PARTIEL : `window.prompt` (`ReportsView.tsx:121`), à remplacer par ActionDialog avec confirmation (opération irréversible) |
| Détail d'un rapport figé (lignes, auteur, note, période) | MANQUANT (seuls CSV et impression) |
| ExportModal (format, colonnes) | MANQUANT |
| Générateur (étapes : indicateurs, dimensions, filtres, aperçu) | MANQUANT |
| Abonnement (fréquence, destinataires, format) | MANQUANT |

## 8. Champs des formulaires

| Formulaire | Champ | Type | Obligatoire | Règle |
|---|---|---|---|---|
| Paramètres du rapport | Rapport | liste (journalier, shift, mensuel, loueur, client) | oui | `RAPPORTS` (`src/lib/rapports.ts`) |
| | Jour | date | journalier, shift | AAAA-MM-JJ (`argumentsRapport`) |
| | Mois | mois | mensuel | `bornesMois` |
| | Du, au | dates | loueur, client | `periodeValide` (début <= fin) |
| | Site | liste | non | serveur : `site_permis` ; tous sites = profil global exigé pour figer |
| | Poste | liste des postes du jour | shift | figer seulement après clôture du poste (client et serveur) |
| Figer | Note | texte | non | serveur : période non future, droit `reports` écriture, périmètre (`figer_rapport`) |
| Cible : générateur | Indicateurs (codes du format commun), dimensions (jour, site, shift, engin, chauffeur, contrat, partenaire), filtres, période | listes | oui | serveur : seulement les domaines lisibles |
| Cible : abonnement | Rapport ou modèle, fréquence (quotidienne après clôture du poste, mensuelle), destinataires internes, format | listes | oui | destinataires = comptes ayant le droit de lecture du rapport |

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Calculer un rapport | DÉPLOYÉ | `ReportsView.tsx:88-100` |
| Export CSV du rapport et du jour par jour | DÉPLOYÉ | `ReportsView.tsx:111-118` |
| Imprimer (fenêtre d'impression du navigateur) | DÉPLOYÉ | `exportToPDF` (`src/lib/exports.ts:50`) |
| Figer | DÉPLOYÉ | `figer_rapport` |
| Réexporter, réimprimer un rapport figé | DÉPLOYÉ | `ReportsView.tsx:211-212` |
| Export Excel natif | MANQUANT (`exportToExcel` produit un CSV, `exports.ts:46`) | - |
| PDF généré par le serveur | MANQUANT | - |
| Comparer deux rapports figés | MANQUANT | - |
| Envoyer, planifier | MANQUANT | - |
| Exports en masse (tous les rapports figés d'un mois) | MANQUANT | - |

## 10. Statuts et transitions

```
calculé (lecture) -> figé            (figer_rapport ; droit reports écriture ; période passée ; poste clos pour un rapport de shift ; périmètre)
figé -> (aucune transition)          (immuable ; correction = nouveau rapport figé)
cible : figé -> remplacé             (nouveau rapport figé référant l'ancien, motif ; l'ancien reste lisible)
cible : modèle brouillon -> publié -> archivé
cible : abonnement actif <-> suspendu
```

## 11. Workflows

- Rapport client CBG de clôture mensuelle : calcul après réconciliation
  (module 14), figé par le chargé de contrats, joint à la facture (module
  20). Lien rapport figé -> facture : MANQUANT.
- Rapport de shift : figé après clôture du poste (D-048) ; le chef de poste
  suivant le consulte à la passation. DÉPLOYÉ (sans notification).
- Rapport loueur : préparé avant le comité de contrat Neemba (module 19).
  PARTIEL (pas de lien comité -> rapport figé).
- Envoi planifié : MANQUANT (dépend d'une passerelle courriel, intégration
  externe : décision du propriétaire).

## 12. Rôles et permissions

| Action | Module | Niveau | Périmètre | État |
|---|---|---|---|---|
| Calculer un rapport | `reports` (menu) ; chaque section exige le droit de son domaine (sinon « Non visible avec vos droits de lecture ») | lecture | oui | DÉPLOYÉ (D-058) |
| Figer | `reports` écriture ou administrateur | écriture | site du rapport ; tous sites = profil global | DÉPLOYÉ |
| Lire un rapport figé | `rapport_fige_lisible(type)` : `reports` + `contracts` (loueur), `invoices` ou `contracts` (client), `trips` ou `planning` (shift) | lecture | `site_permis(site_id)` | DÉPLOYÉ (D-072 R3-1) |
| Créer un modèle personnalisé | `reports` écriture | écriture | - | MANQUANT |
| Gérer les abonnements | `reports` écriture ; administrateur pour un profil | écriture | - | MANQUANT |

## 13. Tables et relations

| Table | Colonnes clés | RLS | État |
|---|---|---|---|
| `rapports_figes` | `numero` unique (RAP-AAAA-NNNNN), `type` CHECK 5 valeurs, `periode_debut`, `periode_fin`, `site_id`, `poste_id` (obligatoire pour shift), `lignes` jsonb, `note`, `fige_par`, `fige_le` | SELECT seulement (`rapport_fige_lisible` et `site_permis`) ; UPDATE et DELETE refusés par déclencheur | DÉPLOYÉ |
| `rapports_performance` | rapport contractuel mensuel (D-031) | module `contracts` | DÉPLOYÉ (module 19) |
| Cible : `modeles_rapport` (nom, indicateurs, dimensions, filtres, propriétaire, partage) | - | lecture selon partage | MANQUANT |
| Cible : `abonnements_rapport` (modèle ou type, fréquence, destinataires, format, actif) | - | personnel et administrateur | MANQUANT |
| Cible : lien `rapports_figes.remplace_id` | - | - | MANQUANT |

## 14. Fonctions serveur et API

Format commun (D-058) : `rang, section, indicateur, valeur, unite,
manquants, source, remarque`, SECURITY INVOKER.

| Fonction | État |
|---|---|
| `indicateurs_exploitation(date, date, uuid, uuid)` | DÉPLOYÉ |
| `rapport_journalier(date, uuid)` | DÉPLOYÉ |
| `rapport_mensuel(date, uuid)`, `rapport_mensuel_par_jour(date, uuid)` | DÉPLOYÉ |
| `rapport_shift(uuid)` (dernière définition `20261120102000_correctifs_revue_r3.sql:97`) | DÉPLOYÉ |
| `rapport_loueur(date, date, uuid)` | DÉPLOYÉ |
| `rapport_client(date, date, uuid)` (dernière définition `20261121120000_contrats_finance.sql`) | DÉPLOYÉ |
| `figer_rapport(text, date, date, uuid, uuid, text)` SECURITY DEFINER | DÉPLOYÉ |
| `rapport_fige_lisible(text)` | DÉPLOYÉ |
| `fiabilite_engins`, `performance_chauffeurs`, `consommation_carburant` | DÉPLOYÉ |
| `rapport_production`, `rapport_voyages`, `durees_voyages` | DÉPLOYÉ (modules 04, 07) |
| Cible : `rapport_financier(debut, fin, site, devise)` | MANQUANT |
| Cible : `executer_modele_rapport(modele, parametres)` (indicateurs autorisés seulement, pas de SQL libre) | MANQUANT |
| Cible : envoi planifié (tâche serveur, fonction Edge) | MANQUANT |

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Rapport figé | abonnés du type de rapport, DG pour le mensuel | centre de notifications | MANQUANT |
| Rapport mensuel attendu non figé à J+3 | chargé de contrats | centre de notifications | MANQUANT |
| Envoi planifié réalisé ou en échec | propriétaire de l'abonnement | courriel | MANQUANT |

## 16. Documents et modèles d'impression

Impression actuelle : tableau HTML ouvert dans une fenêtre et imprimé par le
navigateur (`exports.ts:50-144`), titre du rapport, colonnes de
`lignesExport`. Cible : modèles A4 par type (en-tête SIGTB, période, site,
numéro RAP du rapport figé, auteur, heure de calcul, sources), pied de page
paginé. État : PARTIEL.

## 17. Exports et rapports

| Format | État |
|---|---|
| CSV (séparateur et encodage de `buildCSV`, testés par `src/lib/exports.test.ts`, 13) | DÉPLOYÉ |
| Impression / PDF navigateur | DÉPLOYÉ (PARTIEL au regard d'un PDF serveur) |
| Excel natif | MANQUANT (une bibliothèque xlsx serait une nouvelle dépendance : à décider) |
| PDF serveur | MANQUANT |

## 18. Historique et audit

- `rapports_figes` append-only, auteur et heure, numéro séquentiel :
  DÉPLOYÉ.
- Comparaison de versions (deux rapports figés de la même période) :
  MANQUANT.
- Journal de consultation et d'export des rapports figés : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `41_reporting` (28), `54_correctifs_revue_finance_reporting` (28), `17_analyses_flotte`, 46, 49 | rapport financier, modèles, abonnements |
| Unitaires | `src/lib/rapports.test.ts` (12), `src/lib/exports.test.ts` (13), `src/components/Trips/rapports.test.ts` | générateur |
| E2E (API simulée) | `rapports.spec.ts` (3 Rapports + 1 Coûts), `analyses.spec.ts` | parcours J1 « rapport client CBG figé » contre une vraie base |

## 20. Critères de recette métier

1. Le chargé de contrats calcule le rapport client CBG du mois : tonnes
   acceptées égales à la somme des tickets validés de la réconciliation
   (module 14) ; écarts D-050 listés ; il le fige ; le numéro RAP figure sur
   l'impression.
2. Le rapport loueur Neemba du mois donne les heures pointées et les
   immobilisations par imputation identiques au contrôle de facture Neemba
   (module 10).
3. Le chef de poste fige le rapport de shift après clôture ; un compte d'un
   autre site ne le lit pas.
4. Un indicateur sans donnée affiche « sans données » avec sa raison, jamais 0.
PV : chargé de contrats, responsable d'exploitation, DG.

## Synthèse des états (éléments du catalogue du propriétaire)

| Élément | État |
|---|---|
| Rapport journalier | DÉPLOYÉ |
| Rapport de shift | DÉPLOYÉ |
| Rapport mensuel et jour par jour | DÉPLOYÉ |
| Rapport partenaire Neemba (loueur) | DÉPLOYÉ |
| Rapport partenaire CBG (client) | DÉPLOYÉ |
| Rapport de performance (contractuel figé, fiabilité, chauffeurs) | DÉPLOYÉ |
| Historique (rapports figés) | DÉPLOYÉ |
| Analyses flotte et coût direct par tonne | DÉPLOYÉ |
| Rapports de production et de voyages (modules 04, 07) | DÉPLOYÉ |
| Export CSV | DÉPLOYÉ |
| Rapports financiers | PARTIEL |
| Tableaux croisés | PARTIEL |
| Graphiques | PARTIEL |
| Filtres multicritères | PARTIEL |
| Export PDF et impression | PARTIEL |
| Rapports personnalisés et générateur | MANQUANT |
| Comparaisons | MANQUANT |
| Export Excel | MANQUANT |
| Planification d'envoi | MANQUANT |

Total : 10 DÉPLOYÉ, 5 PARTIEL, 0 MAQUETTE, 4 MANQUANT. Aucun UTILISABLE ni
VALIDÉ.

## Défauts bloquants constatés

Aucun. Écritures vérifiées : `ReportsView.tsx:123` appelle
`figer_rapport` avec `p_type, p_debut, p_fin, p_site, p_poste, p_note`,
conformes à la signature `figer_rapport(text, date, date, uuid, uuid, text)`
(`20261118090000_reporting.sql:790`) ; lectures sur colonnes réelles
(`postes.date_poste, shift_id, site_id, statut, ouvert_le` ;
`work_shifts.display_name, shift_order` ; `rapports_figes.*`). Les écrans
d'analyse ne font que des lectures, sur colonnes existantes.

Réserves non bloquantes : le choix de la note par `window.prompt` ; les
erreurs de lecture des analyses (`AnalysesFlotte.tsx:56`, `:118`) ne sont pas
affichées (résultat vide sans message).

## Écarts et lots proposés

1. **Rapport financier de gestion (M)** : facturé, encaissé, créances,
   dettes, coûts directs, coût par tonne, par devise. Dépendances : module
   20 (rentabilité, base de tonnage à confirmer, D-058).
2. **Lien rapport figé et facture / comité (S)** : `rapports_figes`
   référencé par la facture CBG et le comité Neemba ; « remplace » motivé.
3. **Modèles d'impression A4 et détail d'un rapport figé (S)**.
   Dépendances : composants DetailDrawer, ExportModal.
4. **Graphiques et comparaisons de périodes (M)** : courbes jour par jour,
   période contre période de référence. Partagé avec le module 01.
5. **Générateur et tableaux croisés (L)** : modèles sur la liste fermée des
   indicateurs du format commun, dimensions autorisées, aucun SQL libre.
6. **Export Excel natif et PDF serveur (M)** : décision du propriétaire sur
   une nouvelle dépendance.
7. **Planification d'envoi (M)** : après fourniture d'une passerelle
   courriel (intégration externe : « toujours demander »).

Points à trancher par le propriétaire : formats exigés par CBG et Neemba
(PDF, Excel) ; destinataires et fréquence des envois ; base de tonnage des
rapports financiers ; passerelle courriel.
