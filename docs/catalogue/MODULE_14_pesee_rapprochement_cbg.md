# Module 14 : Pesée et rapprochement CBG

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : migrations jusqu'à `20261121120000` appliquées
(journal `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 9, déploiements
3dc77d4 et 3bbfded), démonstration purgée (D-076) : aucune donnée réelle,
aucun guide de rôle, aucun PV. Aucun élément n'est donc UTILISABLE ni
VALIDÉ. « DÉPLOYÉ » signifie : code et migration en production, tests
automatisés verts sur la base du serveur.

## 1. Objectifs et périmètre

Faire du ticket de pesée CBG la preuve unique du tonnage livré, et du
tonnage accepté la base de la facture CBG. CBG pèse au pont-bascule du
dépôt de destination et émet le ticket ; Kogon Mining ne repèse pas, il
intègre le ticket au voyage, le rapproche du relevé périodique CBG, traite
les anomalies et fige le tonnage facturable par la réconciliation mensuelle.

| Élément | Référence |
|---|---|
| Ticket source au dépôt, sans double pesée Kogon, rectification motivée par une autre personne | D-037 (deux lignes, remplacent D-035) |
| Réconciliation mensuelle par contrat client, anomalies, décision motivée, clôture qui fige | D-029 |
| Import du relevé CBG en CSV, rapprochement, décisions accepte / litige, voyages livrés sans ticket | D-050 |
| Rectification de ticket sous aal2 (si `mfa_exige`) | D-040 |
| Lecture bornée au périmètre de site (ticket par le voyage) | D-075, D-072 (R2-C3) |
| Pièces jointes (justificatifs de tickets) autorisées : bucket privé, contrôle type et taille | D-069 point 2 ; appartient à J1 |
| OCR des tickets : extension à déclencheur (échantillon de tickets réels et constat que le CSV ne suffit pas) | CLAUDE.md bloc 1 section 9 |

Entrées : voyages et rotations (module 07 : état `WEIGHED_IN`, fiche FR
D-028), contrats clients (module 19 : nature `client`, devise), sites et
ponts-bascules (module 03), réglage `tolerance_poids_cbg_t`.
Sorties : tonnage reçu et accepté par voyage, réconciliation close vers la
facture CBG (module 20, `generer_facture`, circuit D-029), indicateur
« voyages livrés sans ticket » du centre de pilotage (module 01, D-057),
rapports (module 21, D-058).

## 2. Sous-modules

| Sous-module | Cible | État |
|---|---|---|
| 14.1 Intégration du ticket au voyage | Saisie du ticket, brut, tare, heure, référence document à la réception au dépôt | DÉPLOYÉ (avec défauts, voir fin) |
| 14.2 Registre des tickets | Liste des tickets effectifs, rectifiés ou source, filtres, export | PARTIEL |
| 14.3 Rectification auditée | Nouvelle ligne motivée, autre personne, ancienne valeur conservée | DÉPLOYÉ |
| 14.4 Import du relevé CBG | CSV, Excel, PDF, photos ; conservé tel que reçu | PARTIEL (CSV seul) |
| 14.5 Rapprochement relevé / SIGTB | Contrôles ticket, poids, immatriculation, date, doublons, manquants, orphelins | DÉPLOYÉ |
| 14.6 Décisions et litiges | Accepte ou litige motivé, suivi du litige jusqu'à la réponse CBG | PARTIEL |
| 14.7 Réconciliation mensuelle | Par contrat client, période, trajet ; clôture qui fige | DÉPLOYÉ |
| 14.8 Réconciliation journalière | Contrôle quotidien des tickets du jour | MANQUANT |
| 14.9 États et exports | CSV, PDF, impression des états de rapprochement | PARTIEL |
| 14.10 OCR assistée | Lecture assistée des tickets photographiés | MANQUANT (extension à déclencheur, hors cible immédiate) |

## 3. Menus et sous-menus

| Entrée (`src/components/Layout/menu.ts`) | Vue (`src/App.tsx`) | Visible pour |
|---|---|---|
| `tickets-cbg` « Tickets CBG » (ligne 42, niveau racine) | `TicketsCbgView` (App.tsx:140) | Lecture : `has_module_view('trips')` ou `('invoices')` (RLS) ; écriture : droit `trips` create ou edit (TicketsCbgView.tsx:33) |
| `finance > reconciliation` « Réconciliation mensuelle » (ligne 99) | `ReconciliationView` (App.tsx:196) | Lecture `invoices` ou `contracts` ; écriture `invoices` (ReconciliationView.tsx:38) |
| `fiches` « Fiches terrain » (ligne 41) | `FichesView` > `SaisieFiche` (saisie du ticket) | Droit `trips` |

Cible : regrouper sous une rubrique « Pesée CBG » : Tickets, Relevés,
Litiges, Réconciliation journalière ; la réconciliation mensuelle reste
sous Contrats et Finance.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Tickets et relevés CBG | Import du relevé, liste des relevés, résultat du rapprochement, décisions, voyages sans ticket, registre | DÉPLOYÉ | `src/components/Fiches/TicketsCbgView.tsx` ; E2E `e2e/tickets-cbg.spec.ts` |
| Saisie de la fiche de rotations (colonne pesée CBG) | Ticket, heure, brut, tare, référence document | DÉPLOYÉ, défaut d'unité | `src/components/Fiches/SaisieFiche.tsx:21-90` ; E2E `e2e/fiches.spec.ts` |
| Fiche voyage, action « Pesée à l'arrivée » | Brut, tare sans ticket | DÉPLOYÉ, contourne D-037 | `src/components/Trips/FicheVoyage.tsx:85-100,181-191` |
| Réconciliation mensuelle | Ouverture, lignes, décisions, rectification du ticket, clôture, génération de facture | DÉPLOYÉ, défaut d'unité | `src/components/Facturation/ReconciliationView.tsx` ; E2E `e2e/facturation.spec.ts` |
| Fiche ticket (détail, historique des rectifications, pièce) | Ticket | MANQUANT | - |
| Registre des litiges CBG | Litiges ouverts, réponse CBG, clôture | MANQUANT | - |
| Réconciliation journalière | Tickets du jour, voyages livrés sans ticket, écarts | MANQUANT | - |
| Tableau de bord pesée | Indicateurs section 5 | MANQUANT | - |
| Paramétrage (tolérances, format du relevé) | `settings` | MANQUANT (aucun écran ; clé lue par le serveur) | `20261120101000_correctifs_revue_r2.sql:260` |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Voyages livrés sans ticket CBG (nombre) | `v_voyages_livres_sans_ticket`, `indicateurs_pilotage` | Choisie au centre de pilotage | DÉPLOYÉ (`20261120102000_correctifs_revue_r3.sql:467`, test 40) |
| Compteur concordants / anomalies d'un relevé | `ecarts_releve_cbg` | Relevé | DÉPLOYÉ (TicketsCbgView.tsx:140) |
| Compteur facturable / à examiner / exclue, tonnage | `reconciliation_lignes` | Mois | DÉPLOYÉ (ReconciliationView.tsx:80-88) |
| Tonnage CBG reçu vs chargé par jour, taux de tickets rectifiés, litiges ouverts et âge, taux de concordance par relevé | À créer (fonction SECURITY INVOKER, période, source, fiabilité, heure) | Jour, mois | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver | Supprimer | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Ticket CBG (`tickets_pesee_cbg`) | DÉPLOYÉ via `saisir_rotation` | DÉPLOYÉ (registre, 300 derniers, sans filtre) | Interdit (déclencheur `tickets_pesee_cbg_immuables`) | Sans objet | MANQUANT | Interdit (immuable) | DÉPLOYÉ : `rectifier_ticket_pesee_cbg` |
| Rectification | DÉPLOYÉ (ReconciliationView seulement) | PARTIEL (dernière seulement, par `v_tickets_pesee_cbg_effectifs` ; historique non affiché) | Interdit | Sans objet | Sans objet | Interdit | Nouvelle rectification |
| Relevé CBG (`releves_cbg`, `_lignes`) | DÉPLOYÉ `importer_releve_cbg` | DÉPLOYÉ (50 derniers) ; lignes brutes non affichées | Interdit (aucune écriture navigateur) | Sans objet | MANQUANT | Interdit | MANQUANT : annulation motivée d'un relevé importé par erreur |
| Écart (`ecarts_releve_cbg`) | DÉPLOYÉ par `rapprocher_releve_cbg` | DÉPLOYÉ | Décision unique | Sans objet | Sans objet | Interdit | MANQUANT : révision motivée d'une décision |
| Réconciliation | DÉPLOYÉ `ouvrir_reconciliation` | DÉPLOYÉ | `actualiser_reconciliation` (recalcul) | MANQUANT | Sans objet | Interdit | Clôture irréversible ; correction par avoir (module 20) |
| Ligne de réconciliation | Calculée | DÉPLOYÉ (filtres par statut) | Décision `decider_ligne_reconciliation` (annulable tant qu'ouverte) | Sans objet | Sans objet | Retirée par recalcul si le voyage sort du périmètre | DÉPLOYÉ |

## 7. Modals et drawers

| Modal / drawer | État | Preuve |
|---|---|---|
| Rectification du ticket (ticket, brut, tare, référence, motif) | DÉPLOYÉ | ReconciliationView.tsx:113-129, 285-297 |
| Décision d'écart et de ligne (motif) | PARTIEL : `window.prompt`, sans ActionDialog ni rappel du contexte | TicketsCbgView.tsx:93 ; ReconciliationView.tsx:109 |
| Import de relevé avec aperçu des lignes et erreurs par ligne (ImportWizard) | PARTIEL : nombre de lignes lues seulement, pas d'aperçu ni de mapping | TicketsCbgView.tsx:115-128 |
| Détail ticket (DetailDrawer, HistoryDrawer des rectifications, pièce) | MANQUANT | - |
| AttachmentModal (scan du ticket, relevé PDF) | MANQUANT (aucun stockage de fichiers) | Matrice, constat transverse 4 |
| ExportModal (CSV, PDF, colonnes) | MANQUANT (export CSV direct) | - |
| CommentThread sur un litige | MANQUANT | - |

## 8. Champs des formulaires

**Ticket (saisie fiche FR, `SaisieFiche.tsx:72-76`, `fiches.ts:93-122`)**

| Champ | Type | Obligatoire | Validation client | Validation serveur |
|---|---|---|---|---|
| Heure de pesée | heure | Oui si une donnée de pesée est saisie | Présente | Pas dans le futur, postérieure au dernier événement (`avancer_voyage`) |
| Ticket CBG | texte | Oui | Non vide | Non vide ; unicité normalisée `upper(btrim)` (index `tickets_pesee_cbg_ticket_norm_uq`) ; refus d'un ticket déjà utilisé (`avancer_voyage`, test 14) |
| Brut | décimal | Oui | > tare | `brut > 0`, `tare < brut` |
| Tare | décimal | Oui | | `tare >= 0` |
| Référence du document | texte | Non | | Gardée NULL si vide |
| Lieu de pesée de la fiche | option de préparation | Oui | `arrivee` | `preparer_fiche` refuse autre chose ; le site de la fiche doit être le dépôt d'arrivée du voyage (`saisir_rotation`) |

Unité : le serveur, la fiche imprimée (`FicheImprimable.tsx:77`, « Brut (t) »),
la fiche voyage et les tests sont en tonnes ; la saisie affiche « kg »
(défaut D1).

**Import du relevé (`TicketsCbgView.tsx:117-123`)** : fichier CSV (requis ;
colonnes reconnues ticket, date, immatriculation, brut, tare, net ;
séparateur `;` ou `,` ; décimales à virgule ; dates JJ/MM/AAAA), référence
(requise, unique), du, au (requis, au >= du), site (facultatif ; vide =
tous sites, profil global exigé par le serveur).

**Ouverture de réconciliation (`ReconciliationView.tsx:161-176`)** : contrat
client (requis, `nature = 'client'`), mois (requis), base de tonnage
(requise, accepte / reçu / chargé, sans valeur par défaut), tolérance
chargé / reçu en % (requise, >= 0), sites de départ et d'arrivée
(facultatifs). Le serveur refuse un chevauchement de période pour le même
contrat et le même trajet.

**Champs conditionnels cibles** : pièce jointe obligatoire si la référence
document est vide ; motif de litige catégorisé (poids, camion, date,
ticket inconnu, autre) ; réponse CBG et date de réponse à la clôture d'un
litige.

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Intégrer un ticket | DÉPLOYÉ | `saisir_rotation` (`20261113100000`, l. 240-288) |
| Rectifier un ticket | DÉPLOYÉ | `rectifier_ticket_pesee_cbg` ; test 15 |
| Importer un relevé | DÉPLOYÉ | `importer_releve_cbg` (`20261120101000`, l. 209) ; test 33, 53 |
| Rapprocher un relevé | DÉPLOYÉ | `rapprocher_releve_cbg` (`20261120101000`, l. 249) |
| Accepter / mettre en litige un écart | DÉPLOYÉ | `decider_ecart_releve_cbg` (l. 320) ; E2E tickets-cbg |
| Exporter le rapprochement (CSV) | DÉPLOYÉ | TicketsCbgView.tsx:98 |
| Ouvrir, actualiser, décider, clôturer une réconciliation, générer la facture | DÉPLOYÉ | `20261111120000` et `20261113100000` ; test 15 ; E2E facturation |
| Exporter la réconciliation (CSV) | DÉPLOYÉ | ReconciliationView.tsx:130 |
| Décisions en masse sur les écarts concordants ou de même nature (BulkActionBar, motif commun) | MANQUANT | - |
| Clore un litige (réponse CBG), le relier au voyage (`DISPUTED`) et à la réconciliation | MANQUANT | D-050 « limites » |
| Joindre le scan du ticket ou le relevé PDF | MANQUANT | - |
| Imprimer l'état de rapprochement (PDF) | MANQUANT | - |

## 10. Statuts et transitions

Ticket (statut dérivé, pas de colonne) :
- `aucun` -> `source CBG` (intégration à `WEIGHED_IN` par `saisir_rotation`, droit trips W, fiche FR à l'arrivée, ticket unique)
- `source CBG` -> `rectifié` (`rectifier_ticket_pesee_cbg`, droits trips W et invoices W, autre personne que l'auteur, aal2 si `mfa_exige`, refus si réconciliation close)
- `rectifié` -> `rectifié` (nouvelle rectification ; la plus récente est effective)
- Cible : `en litige` (décision litige d'un écart) -> `litige clos` (réponse CBG motivée) : MANQUANT.

Relevé : `importe` -> `rapproche` (`rapprocher_releve_cbg`, une fois, irréversible). Cible : `importe` -> `annule` (motif) : MANQUANT.

Écart : `à décider` (decision NULL, nature != concordant) -> `accepte` | `litige` (`decider_ecart_releve_cbg`, motif). `concordant` : aucune décision.

Réconciliation : `ouverte` -> `cloturee` (`cloturer_reconciliation`, aucune ligne à examiner) ; ligne : `a_examiner` | `facturable` | `exclue` (décision motivée, annulable tant que la réconciliation est ouverte).

Voyage (module 07, extrait) : `UNLOADING` -> `WEIGHED_IN` -> `DELIVERED` -> `ACCEPTED` ; `UNLOADING` -> `DELIVERED` direct permis (cycle.ts:59), ce qui produit un voyage livré sans ticket.

## 11. Workflows

1. Réception au dépôt : CBG pèse et remet le ticket ; l'agent Kogon le reporte sur la fiche FR ; la fiche retournée est saisie (ticket, brut, tare, heure, référence). DÉPLOYÉ.
2. Relevé périodique CBG : le chargé de contrats ou l'exploitation importe le CSV, lance le rapprochement, décide chaque anomalie. DÉPLOYÉ. Délai et relance du litige : MANQUANT.
3. Rectification : une autre personne que l'auteur du ticket saisit la correction motivée (séparation des tâches) ; la réconciliation ouverte est actualisée et marque `ticket_rectifie`. DÉPLOYÉ.
4. Réconciliation mensuelle : ouverture (base et tolérance choisies), décisions, clôture, facture (module 20 : brouillon -> à signer -> signée par le director -> émise). DÉPLOYÉ.
5. Cible : réconciliation journalière en fin de poste (module 05) : tickets du jour, voyages sans ticket, écarts ; escalade au responsable d'exploitation au-delà de 24 h. MANQUANT.
6. Cible : le litige accepté par CBG ou rejeté se répercute sur la réconciliation ouverte (anomalie `litige_cbg`) ; une fois close, correction par avoir. MANQUANT.

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre | Preuve |
|---|---|---|---|
| Lire tickets et rectifications | trips ou invoices (V), ou admin | `voyage_permis(trip_id)` | `20261121095000:58-66` ; test 58 |
| Lire relevés, lignes, écarts | trips ou invoices (V) | `site_permis(site_id)` du relevé | `20261120101000:196-205` ; test 53 |
| Intégrer un ticket | trips (W) | Garde site des voyages (D-039) | `saisir_rotation` |
| Rectifier | trips (W) et invoices (W), autre personne, aal2 si exigé | Voyage | `rectifier_ticket_pesee_cbg`, `garde_aal2` ; tests 15, 24 |
| Importer, rapprocher, décider | trips (W) | Site du relevé ; relevé sans site = profil global | `20261120101000` ; test 53 |
| Réconciliation | invoices (W) ; lecture invoices ou contracts | Aucune borne de site (limite D-075) | `20261111120000:326-334` |
| Signer la facture | rôle director (module 20) | - | D-029 |

Cible : approbation distincte (A) pour accepter un écart de poids au-delà
de la tolérance, et pour clore un litige. À trancher par le propriétaire.

## 13. Tables et relations

| Table / vue | Colonnes clés | Contraintes | RLS |
|---|---|---|---|
| `tickets_pesee_cbg` | trip_id (unique), fiche_id, site_id (dépôt), ticket, brut, tare, net généré, mesure_le, document_ref, saisi_par | Ticket unique normalisé, brut > tare, immuable (déclencheur) | Lecture seule, `voyage_permis` |
| `rectifications_tickets_pesee_cbg` | ticket_id, anciennes et nouvelles valeurs, motif, corrige_par | Motif non vide, immuable, `garde_aal2` | Suit le ticket |
| `v_tickets_pesee_cbg_effectifs` | Valeur effective, `est_rectifie` | security_invoker | Héritée |
| `releves_cbg`, `releves_cbg_lignes` | Référence unique, période, site, fichier ; lignes telles que reçues (NULL si illisible) | Append-only | `site_permis` |
| `ecarts_releve_cbg` | nature (8 valeurs dont `doublon_releve`), detail, ecart_net, decision, motif | decision et motif ensemble | Suit le relevé |
| `v_voyages_livres_sans_ticket` | Voyages DELIVERED, ACCEPTED, CLOSED, DISPUTED sans ticket | security_invoker | Héritée de trips |
| `reconciliations`, `reconciliation_lignes` | Contrat, période, base, tolérance, trajet ; lignes : tonnages, ticket, anomalies, décision | Période sans chevauchement (fonction), décision motivée | invoices ou contracts, sans site |
| `settings` clé `tolerance_poids_cbg_t` | Tolérance en tonnes | Absente = 0 | - |

## 14. Fonctions serveur et API

Définitions en vigueur (la plus récente prévaut) : `saisir_rotation`,
`preparer_fiche`, `rectifier_ticket_pesee_cbg`, `decider_ligne_reconciliation`,
`actualiser_reconciliation`, `ligne_bloquee` (`20261113100000`) ;
`avancer_voyage` (`20261111090000`) ; `ouvrir_reconciliation`,
`cloturer_reconciliation`, `generer_facture` (`20261111120000`) ;
`importer_releve_cbg`, `rapprocher_releve_cbg`, `decider_ecart_releve_cbg`
(`20261120101000`) ; `garde_aal2` (`20261114130000`). Toutes SECURITY
DEFINER, `search_path` vide, EXECUTE retiré à PUBLIC et anon.

Appels de l'interface vérifiés contre ces signatures :

| Appel | Paramètres envoyés | Conforme |
|---|---|---|
| `importer_releve_cbg` (TicketsCbgView.tsx:87) | p_reference, p_du, p_au, p_site_id (`''` -> null), p_fichier, p_lignes | Oui |
| `rapprocher_releve_cbg` (:90) | p_releve_id | Oui |
| `decider_ecart_releve_cbg` (:95) | p_ecart_id, p_decision, p_motif | Oui |
| `saisir_rotation` (SaisieFiche.tsx:41) | p_fiche_id, p_trip_id, p_etapes | Oui |
| `avancer_voyage` (FicheVoyage.tsx:95) | p_trip_id, p_etat, p_survenu_le, p_note, p_donnees | Oui (mais sans ticket, voir D2) |
| `ouvrir_reconciliation` (ReconciliationView.tsx:102) | p_contrat_id, p_debut, p_fin, p_base, p_tolerance, p_site_depart / p_site_arrivee (`''` -> null) | Oui |
| `decider_ligne_reconciliation` (:111), `actualiser_reconciliation` (:126, 208), `cloturer_reconciliation` (:209), `generer_facture` (:225), `rectifier_ticket_pesee_cbg` (:119) | Noms conformes | Oui |

Colonnes lues : `releves_cbg`, `v_tickets_pesee_cbg_effectifs`,
`v_voyages_livres_sans_ticket`, `ecarts_releve_cbg`, `sites(id, name)`,
`vehicles(id, registration)`, `contrats(id, reference, contrepartie, devise,
nature)` : toutes existent. Aucune écriture directe en table.

Référentiel vide : sans site, le sélecteur propose « Tous sites » et envoie
null (aucun `''` en uuid) ; sans contrat client, le bouton « Ouvrir et
rapprocher » reste désactivé ; sans voyage, la saisie de fiche affiche un
message. Erreurs de lecture : TicketsCbgView affiche la première erreur
(ligne 55) ; ReconciliationView ignore les erreurs de lecture (lignes 55-71,
liste vide affichée comme « Aucune réconciliation »).

Cible : `annuler_releve_cbg`, `cloturer_litige_cbg`, `reviser_decision_ecart`,
`rattacher_ticket_tardif` (voir D2), `reconciliation_journaliere(date, site)`
(SECURITY INVOKER), `decider_ecarts_en_groupe`, pièces jointes par
fonction serveur.

## 15. Notifications

| Événement | Destinataire | État |
|---|---|---|
| Relevé importé non rapproché, écarts à décider | Exploitation, chargé de contrats | MANQUANT dans `mes_validations()` (D-056) ; à vérifier au module 24 |
| Voyage livré sans ticket depuis plus de 24 h | Responsable de poste | MANQUANT (indicateur seulement) |
| Rectification à effectuer par une autre personne | Second valideur | MANQUANT |
| Litige sans réponse CBG à échéance | Chargé de contrats, DG | MANQUANT |

## 16. Documents et modèles d'impression

| Document | État |
|---|---|
| Fiche FR avec colonnes ticket, brut, tare (t) | DÉPLOYÉ (`FicheImprimable.tsx:77`) |
| Scan du ticket CBG, relevé CBG en PDF | MANQUANT (stockage de pièces jointes, J1, D-069 point 2) |
| État de rapprochement imprimable, lettre de contestation à CBG | MANQUANT |

## 17. Exports et rapports

| Export | État |
|---|---|
| Rapprochement d'un relevé, CSV | DÉPLOYÉ (TicketsCbgView.tsx:98) |
| Réconciliation mensuelle, CSV avec BOM | DÉPLOYÉ (ReconciliationView.tsx:130-142) |
| Registre des tickets, voyages sans ticket : CSV | MANQUANT |
| PDF et impression des états, Excel natif | MANQUANT |

## 18. Historique et audit

| Journal | État |
|---|---|
| Ticket source immuable et rectifications append-only (anciennes et nouvelles valeurs, auteur, heure, motif) | DÉPLOYÉ |
| Relevé tel que reçu, fichier source nommé, importé par, à | DÉPLOYÉ |
| Décisions d'écart (auteur, heure, motif) ; la décision est un UPDATE unique, sans historique de révision | PARTIEL |
| Décisions de ligne de réconciliation : annulables, l'ancienne décision est écrasée sans journal | PARTIEL |
| Affichage de l'historique des rectifications d'un ticket | MANQUANT |

## 19. Tests

| Type | Existant | Preuve |
|---|---|---|
| pgTAP | Ticket immuable, rectification par autre personne, actualisation, `ticket_rectifie` bloquant, clôture refusée, factures (38 assertions) | `supabase/tests/database/15_reconciliation_factures.test.sql` |
| pgTAP | Import, rapprochement, natures, décisions (11) | `33_releves_cbg.test.sql` |
| pgTAP | aal2 sur rectification (7) | `24_mfa_aal2.test.sql` |
| pgTAP | Relevés bornés au site, doublon de ticket dans le relevé | `53_correctifs_revue_exploitation.test.sql` (C3) |
| pgTAP | Tickets lus selon le périmètre du voyage | `58_perimetre_site_lectures.test.sql` |
| pgTAP | Ticket déjà utilisé refusé | `14_fiches_terrain.test.sql` |
| Unitaires | Lecture CSV, statut de ligne, bornes de mois | `src/components/Fiches/releveCbg.test.ts`, `src/components/Facturation/facturation.test.ts`, `fiches.test.ts` |
| E2E (API simulée) | Import CSV, voyage sans ticket, litige motivé ; réconciliation et signature | `e2e/tickets-cbg.spec.ts`, `e2e/facturation.spec.ts`, `e2e/fiches.spec.ts` |
| Manquants | Parcours J1 complet contre une vraie base (ticket -> relevé -> réconciliation -> facture) ; unité kg / t ; voyage pesé sans ticket via la fiche voyage ; ligne rectifiée facturable après réexamen ; réconciliation bornée au site | - |

## 20. Critères de recette métier

1. Sur une semaine réelle de Nimba, chaque voyage livré porte un ticket CBG saisi depuis la fiche FR, en tonnes ; zéro voyage dans « livrés sans ticket » à J+1.
2. Le relevé CBG réel de la période est importé tel que reçu ; le taux de concordance et chaque anomalie (doublon, inconnu, manquant, poids, camion, date) sont expliqués et décidés avec motif.
3. Une erreur de lecture d'un ticket est rectifiée par une seconde personne ; l'original reste visible ; la réconciliation ouverte la signale.
4. La réconciliation du mois, base « accepté », est close ; chaque ligne de la facture CBG remonte à ses voyages, tickets et fiches ; le total facturé égale le tonnage figé.
5. PV signé par le chargé de contrats et le responsable d'exploitation.

## Écarts et lots proposés

### Défauts bloquants constatés

| # | Fichier:ligne | Cause | Effet |
|---|---|---|---|
| D1 | `src/components/Fiches/SaisieFiche.tsx:55` et `src/components/Facturation/ReconciliationView.tsx:291-292` | Libellés « Brut (kg) » et « Tare (kg) », alors que le serveur, la fiche imprimée (`FicheImprimable.tsx:77`, « Brut (t) »), la fiche voyage, le relevé (« Net CBG %s t ») et la tolérance (`tolerance_poids_cbg_t`) sont en tonnes et que les tests saisissent 56,1 | Une saisie en kg enregistre un net 1 000 fois trop grand : tonnage reçu, rapprochement et facture CBG faux |
| D2 | `src/components/Trips/FicheVoyage.tsx:89-100` (action « Pesée à l'arrivée », `WEIGHED_IN`) | Appelle `avancer_voyage` avec brut et tare sans ticket ; aucun `tickets_pesee_cbg` n'est créé. Ensuite `saisir_rotation` refuse tout ticket (« Voyage déjà réceptionné sans preuve CBG ») et `rectifier_ticket_pesee_cbg` refuse (« Ticket CBG introuvable pour ce voyage ») | Le voyage reste sans ticket pour toujours ; la ligne de réconciliation porte `sans_ticket_cbg` (bloquante, `decider_ligne_reconciliation` refuse « facturable ») : voyage non facturable, contraire à D-037 (le ticket CBG est la preuve) ; même impasse si le voyage passe `UNLOADING -> DELIVERED` sans pesée (`cycle.ts:59`) |
| D3 | `supabase/migrations/20261113100000_d037_ticket_pesee_cbg_rectification.sql:135` (`decider_ligne_reconciliation`) | `ticket_rectifie` figure parmi les anomalies qui interdisent « facturable », et l'anomalie est recalculée à chaque actualisation tant qu'une rectification existe | Un voyage dont le ticket a été rectifié ne peut jamais être facturé (seule l'exclusion est possible, confirmé par le test 15) ; D-037 prévoit une « anomalie à examiner », pas une exclusion forcée. À trancher : autoriser « facturable » après réexamen motivé par une autre personne |

Vérifié sans défaut : noms et types des paramètres des 11 appels RPC
(section 14), colonnes lues, absence d'écriture directe, cas référentiel
vide (aucun `''` envoyé en uuid ; boutons désactivés sans contrat, relevé
ou référence).

### Lots proposés (ordre)

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Corriger D1 (libellés en tonnes, contrôle de vraisemblance : net > 100 t refusé ou confirmé) | S | Aucune |
| 2 | Corriger D2 : retirer la saisie brut / tare sans ticket de la fiche voyage, ou exiger le ticket et passer par la même insertion que `saisir_rotation` ; fonction `rattacher_ticket_tardif` (ticket CBG reçu après la réception, motivé, autre personne) ; décider si `UNLOADING -> DELIVERED` sans pesée reste permis | M | Module 07, revue indépendante (migration) |
| 3 | Corriger D3 : réexamen motivé d'une ligne rectifiée, par une autre personne que l'auteur de la rectification | S | Décision du propriétaire, revue indépendante |
| 4 | Pièces jointes : scan du ticket, relevé PDF, document de livraison ; bucket privé, politiques par module et site | L | Socle commun pièces jointes (D-069 point 2, D-077), serveur web partagé |
| 5 | Litiges CBG : statut, réponse CBG, échéance, relance ; lien vers la réconciliation ouverte (anomalie bloquante) et vers l'état `DISPUTED` du voyage | M | Modules 07, 20, 24 |
| 6 | Réconciliation journalière par site et poste, intégrée à la clôture de poste | M | Module 05 |
| 7 | Registre des tickets au standard : DataTable (recherche, filtres date / site / camion / état, pagination, export), fiche ticket avec historique des rectifications | M | Composants communs DataTable, DetailDrawer, HistoryDrawer |
| 8 | Import au standard : aperçu des lignes, erreurs par ligne, mapping de colonnes, Excel natif ; annulation motivée d'un relevé importé par erreur | M | ImportWizard ; format réel du relevé CBG |
| 9 | Décisions en masse et révision motivée d'une décision (écarts et lignes), journal des décisions | S | BulkActionBar, ActionDialog |
| 10 | Borne de site sur la réconciliation (lecture et fonctions) | M | D-075 (limite consignée), revue indépendante |
| 11 | Notifications (relevé à rapprocher, voyage sans ticket, litige à échéance) dans `mes_validations` | S | Module 24 |
| 12 | Tableau de bord et état imprimable du rapprochement (PDF) | S | Module 21 |
| 13 | OCR des tickets | - | Extension à déclencheur : non commencée |

### Points à trancher par le propriétaire

1. `tolerance_poids_cbg_t` : valeur (absente = 0 t, tout écart est signalé) et approbation distincte au-delà.
2. Format réel du relevé CBG (CSV, Excel, PDF ; colonnes, unité kg ou t) : un échantillon réel est requis.
3. Ligne à ticket rectifié : facturable après réexamen, ou exclusion systématique et régularisation sur la période suivante (D3).
4. Voyage livré sans pesée (`UNLOADING -> DELIVERED`) : permis ou interdit pour les voyages facturés au tonnage.
