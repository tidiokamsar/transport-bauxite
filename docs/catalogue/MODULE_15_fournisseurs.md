# Module 15 : Fournisseurs

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : D-059 déployée (`eca55e3`, migration
`20261118120000`), correctifs D-072 déployés (`16f149e`), D-065 déployée
(`3bbfded`). Démonstration purgée (D-076) : aucun fournisseur réel saisi.

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 4 |
| MAQUETTE | 0 |
| PARTIEL | 2 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 0 |
| DÉPLOYÉ | 11 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : aucun (voir la dernière section). Écran de
saisie prioritaire (le propriétaire commence la saisie réelle) : la fiche
fournisseur fonctionne de bout en bout.

## 1. Objectifs et périmètre

Référentiel unique des tiers fournisseurs de KOGON MINING (pièces, pneus,
carburant, services, autres), avec leur dossier administratif, leur
évaluation et leur historique commercial. Il alimente les consultations et
bons de commande (module 16), les paiements (module 20), les réceptions de
pneus (module 12) et le stock (module 17). Neemba est un loueur sous contrat
(module 10) et CBG un client et fournisseur de carburant (modules 13, 14) :
leur fiche fournisseur doit exister pour les paiements et l'export
comptable (`comptes_tiers`, D-065).

Décisions de référence : D-042 (plus de suppression), D-053 (circuit
achat), D-059 (fournisseurs), D-065 (grille fournisseur séparée de la grille
loueur, comptes de tiers), D-072 R4 (catégories par l'administrateur,
unicité de la raison sociale et du NIF, offre réputée TTC).

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Répertoire | Liste avec recherche, filtres type, catégorie, statut ; numéro FRS | DÉPLOYÉ | `SuppliersView.tsx` (l.34-71) ; `enregistrer_fournisseur` ; pgTAP 42, 55, 56 ; E2E `fournisseurs` |
| 2 | Fiches | Identité, NIF, RCCM, conditions de paiement, journal avant/après | DÉPLOYÉ | `FicheFournisseur.tsx`, `fournisseurs_journal` |
| 3 | Contacts | Plusieurs contacts, un principal actif, téléphone ou courriel exigé, retrait motivé | DÉPLOYÉ | `enregistrer_contact_fournisseur`, `retirer_contact_fournisseur` |
| 4 | Documents administratifs | Type, numéro, émission, expiration, fichier joint ; alerte d'échéance | PARTIEL | Métadonnées et référence de pièce seulement (`enregistrer_document_fournisseur`) ; alerte `v_documents_fournisseurs_echeance` ; aucun fichier (stockage absent) |
| 5 | Catégories | Référentiel administrateur, classement multiple | DÉPLOYÉ | `definir_categorie_fournisseur` (`20261120103000`), `classer_fournisseur`, `ReferentielsFournisseurs.tsx` |
| 6 | Contrats | Contrats-cadres du fournisseur liés à sa fiche (module 19) | MANQUANT | `contrats.contrepartie` est un texte ; aucun lien `supplier_id` ; nature « fournisseur » absente |
| 7 | Produits et services | Catalogue fournisseur : article, référence fournisseur, prix, délai, dernière commande | MANQUANT | `stock_items.supplier_id` existe (base de référence) sans écran |
| 8 | Demandes de cotation | Consultation numérotée CONS, lignes, fournisseurs invités, date limite | DÉPLOYÉ | `creer_consultation`, `inviter_fournisseur_consultation`, `ConsultationsFournisseurs.tsx` |
| 9 | Comparaison des offres | Tableau par ligne et fournisseur, délais | DÉPLOYÉ | `comparerOffres` (`fournisseurs.ts`), `enregistrer_offre`, `selectionner_offre` |
| 10 | Évaluation | Grille pondérée de l'administrateur, notes 1 à 5, note globale serveur, correction motivée | DÉPLOYÉ | `evaluer_fournisseur`, `definir_critere_evaluation` (`20261121120000`) ; pgTAP 42, 48 |
| 11 | Historique des commandes | Bons de commande du fournisseur | DÉPLOYÉ | `FicheFournisseur.tsx:60` |
| 12 | Historique des paiements | Paiements exécutés et à venir | DÉPLOYÉ | `FicheFournisseur.tsx:79` (paiements des bons) ; paiements des factures Neemba non rattachés à la fiche |
| 13 | Réclamations | Réclamation fournisseur (qualité, retard, écart), suivi jusqu'à clôture | MANQUANT | Seul Neemba a des régularisations (D-032) |
| 14 | Suspension | Motivée, approbation achats, blocage des nouveaux bons | DÉPLOYÉ | `suspendre_fournisseur`, garde `garde_fournisseur_actif` |
| 15 | Réactivation | Motivée, approbation achats | DÉPLOYÉ | `reactiver_fournisseur` |
| 16 | Export et import du répertoire | Export CSV, import en masse initial | MANQUANT | Aucun bouton d'export ni d'import dans `Suppliers/*` |
| 17 | Coordonnées bancaires et compte de tiers | Compte comptable du tiers ; RIB (à trancher) | PARTIEL | `comptes_tiers` (D-065, `FinanceView`) ; RIB absent (D-055 : aucune intégration bancaire) |

## 3. Menus et sous-menus

« Stocks & Achats > Fournisseurs » (`suppliers`), droit `purchases`
(`AuthContext.tsx:190`). Voient : admin, director, logistician,
accountant, contract_manager (écriture ; approbation : admin, director,
accountant). La lecture de la fiche est étendue au module `stock` côté
serveur (D-059), mais le menu suit `purchases` : un magasinier sans
`purchases` ne voit pas l'entrée. Onglets internes : répertoire, fiche,
consultations, référentiels.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Répertoire | Liste, recherche, filtres, création, modification | DÉPLOYÉ | `SuppliersView.tsx` ; E2E `fournisseurs` |
| Fiche fournisseur | Identité, contacts, documents, catégories, évaluation, commandes, paiements, journal | DÉPLOYÉ | `FicheFournisseur.tsx` |
| Consultations | Création, invitations, offres, comparaison, sélection, bon préparé | DÉPLOYÉ | `ConsultationsFournisseurs.tsx` ; E2E `fournisseurs` |
| Référentiels | Catégories, critères d'évaluation | DÉPLOYÉ | `ReferentielsFournisseurs.tsx` |
| Tableau de bord fournisseurs | Documents expirés, évaluations, dépendance | MANQUANT | - |
| Réclamations | Liste et fiche | MANQUANT | - |
| Catalogue produits du fournisseur | Articles et prix | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Documents arrivant à échéance | `v_documents_fournisseurs_echeance` (délai `fournisseurs_alerte_documents_jours`, 30 si absent) | Instant | DÉPLOYÉ (fiche) |
| Note courante | `v_evaluations_fournisseurs_courantes` | Période évaluée | DÉPLOYÉ (répertoire) |
| Total commandé, payé | bons et paiements | Historique | DÉPLOYÉ (fiche, `FicheFournisseur.tsx:135`) |
| Délai moyen de livraison, taux de refus à réception, part des achats | - | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Fournisseur | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (journal avant/après) | MANQUANT | DÉPLOYÉ (suspension / réactivation) | interdit (D-042) | sans objet |
| Contact | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | sans objet | DÉPLOYÉ (retrait motivé) | interdit | sans objet |
| Document administratif | DÉPLOYÉ | DÉPLOYÉ | MANQUANT (nouvelle saisie) | sans objet | DÉPLOYÉ (retrait motivé) | interdit | sans objet |
| Catégorie | DÉPLOYÉ (admin) | DÉPLOYÉ | DÉPLOYÉ | sans objet | DÉPLOYÉ (désactivation) | sans objet | sans objet |
| Critère d'évaluation | DÉPLOYÉ (admin) | DÉPLOYÉ | DÉPLOYÉ | sans objet | DÉPLOYÉ (actif) | sans objet | sans objet |
| Évaluation | DÉPLOYÉ | DÉPLOYÉ | interdit (append-only) | sans objet | sans objet | interdit | DÉPLOYÉ (correction motivée) |
| Consultation | DÉPLOYÉ | DÉPLOYÉ | MANQUANT (lignes figées à la création) | MANQUANT | sans objet | sans objet | DÉPLOYÉ (annulation motivée) |
| Offre | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | sans objet | sans objet | sans objet | DÉPLOYÉ (retrait motivé) |

## 7. Modals et drawers

Création et édition de fiche, contact, document, évaluation, critère,
consultation, offre : DÉPLOYÉ (panneaux en page). Confirmations par
`window.prompt` (motif) : PARTIEL au regard d'ActionDialog. Pièces jointes,
import, export, commentaires : MANQUANT.

## 8. Champs des formulaires

| Formulaire | Champs | Obligatoires | Règles |
|---|---|---|---|
| Fiche | raison sociale, type (`parts`, `tires`, `fuel`, `services`, `other`), téléphone, courriel, adresse, ville, pays, NIF, RCCM, conditions de paiement, note | raison sociale, type | raison sociale et NIF uniques (serveur) ; numéro FRS serveur |
| Contact | nom, fonction, téléphone, courriel, principal | nom ; téléphone ou courriel | un seul principal actif |
| Document | type (rccm, nif, attestation fiscale, CNSS, assurance, agrément, contrat cadre, autre), référence de pièce, numéro, émission, expiration, libellé, observation | type, référence de pièce ; libellé si « autre » | expiration >= émission (cible) |
| Évaluation | période, note 1 à 5 par critère actif, observation, commentaire, motif de correction | période, toutes les notes ; motif si période déjà évaluée | grille saisie par l'administrateur, sinon refus |
| Consultation | objet, lignes (article ou désignation, quantité), fournisseurs, dépôt, date limite, note | objet, lignes, au moins un fournisseur | minimum d'offres `consultation_offres_minimum` (1 si absent) |
| Offre | fournisseur, prix par ligne (TTC, D-072), délai (jours), reçue le, référence, validité, conditions | fournisseur, prix, délai, date | délai entier |

Champs cibles manquants : forme juridique, RIB (à trancher), devise
habituelle, délai de paiement en jours (aujourd'hui texte libre).

## 9. Actions individuelles et en masse

| Action | Droit | État |
|---|---|---|
| Créer, modifier, contacts, documents, catégories du fournisseur | écriture `purchases` | DÉPLOYÉ |
| Évaluer | écriture `purchases` | DÉPLOYÉ |
| Suspendre, réactiver | approbation `purchases` | DÉPLOYÉ |
| Consultation : créer, inviter, saisir offre, sélectionner, préparer le bon, annuler | écriture `purchases` | DÉPLOYÉ |
| Exporter le répertoire, import initial en masse | lecture / admin | MANQUANT |
| Fusionner deux fiches en doublon | admin | MANQUANT |

## 10. Statuts et transitions

```
Fournisseur : actif -> suspendu (suspendre_fournisseur, approbation purchases, motif)
              suspendu -> actif (reactiver_fournisseur, approbation purchases, motif)
Consultation : ouverte -> attribuee (selectionner_offre, motif) -> [bon brouillon prepare]
               ouverte -> annulee (annuler_consultation, motif)
Offre : recue -> retenue | retiree (motif)
Document : actif -> retire (motif) ; expire (calcule)
```

## 11. Workflows

Création de fiche par l'acheteur ; contrôle du dossier administratif ;
consultation (au moins N offres selon réglage) ; sélection motivée ; bon de
commande brouillon soumis au circuit D-053. Cible : validation de la
création d'un nouveau fournisseur par une autre personne (risque de
fournisseur fictif), relance des documents expirés : MANQUANT.

## 12. Rôles et permissions

Lecture : `purchases` ou `stock` (D-059). Écriture : `purchases`.
Approbation (suspension, réactivation) : `has_module_approve('purchases')`.
Référentiels (catégories, critères) : administrateur. Pas de périmètre de
site (référentiel global), conforme au caractère central des achats.

## 13. Tables et relations

`suppliers` (+ ville, pays, NIF, RCCM, suspension) ; `fournisseurs_journal`
(append-only) ; `contacts_fournisseurs` ; `categories_fournisseurs`,
`fournisseurs_categories` ; `documents_fournisseurs` ;
`criteres_evaluation_fournisseur` (grille `fournisseur` / `loueur`, D-065) ;
`evaluations_fournisseurs`, `evaluations_fournisseurs_notes` ;
`consultations_fournisseurs`, `consultations_lignes`, `offres_fournisseurs`
(et prix par ligne). RLS active, aucune écriture directe (D-059), DELETE
retiré (D-042).

## 14. Fonctions serveur et API

`enregistrer_fournisseur`, `enregistrer_contact_fournisseur`,
`retirer_contact_fournisseur`, `enregistrer_document_fournisseur`,
`retirer_document_fournisseur`, `classer_fournisseur`,
`suspendre_fournisseur`, `reactiver_fournisseur`, `creer_consultation`,
`inviter_fournisseur_consultation`, `enregistrer_offre`, `retirer_offre`,
`annuler_consultation`, `preparer_bon_commande_consultation`
(`20261118120000`) ; `definir_categorie_fournisseur`, `selectionner_offre`
(`20261120103000`) ; `evaluer_fournisseur`, `definir_critere_evaluation`
(`20261121120000`) ; `delai_alerte_documents_fournisseurs`. Paramètres des
appels vérifiés : conformes.

## 15. Notifications

Document expiré ou proche de l'échéance : affiché sur la fiche (PARTIEL),
aucune notification ni relance. Offre attendue après la date limite :
MANQUANT. Fournisseur suspendu : refus serveur à la soumission d'un bon
(DÉPLOYÉ), sans notification.

## 16. Documents et modèles d'impression

Demande de cotation imprimable ou envoyable, fiche fournisseur, grille
d'évaluation signée : MANQUANT.

## 17. Exports et rapports

Aucun export du module (MANQUANT) : répertoire, comparatif d'offres,
évaluations, documents à échéance.

## 18. Historique et audit

`fournisseurs_journal` (création, modification avec avant/après, suspension,
réactivation, contacts, documents) : DÉPLOYÉ et affiché sur la fiche.
Évaluations append-only avec correction motivée : DÉPLOYÉ.

## 19. Tests

Existants : pgTAP 42 (fournisseurs), 48 (grille séparée), 55 et 56
(correctifs de revue) ; unitaire `src/components/Suppliers/fournisseurs.test.ts` ;
E2E `fournisseurs.spec.ts` (2 parcours). Manquants : E2E profil
`logistician` (non administrateur) ; test de la consultation sans dépôt
puis préparation du bon (voir écart 4).

## 20. Critères de recette métier

L'acheteur saisit les fournisseurs réels (au moins CBG, Neemba et les
fournisseurs de pièces et pneus) avec leurs documents ; une consultation à
trois offres est comparée, l'offre retenue avec motif, le bon préparé ; une
évaluation trimestrielle est enregistrée avec la grille validée par le
propriétaire. PV signé : aucun.

## Points à trancher par le propriétaire

1. Grille d'évaluation (critères et poids) : aucune grille par défaut
   (D-059).
2. Délai d'alerte des documents (30 jours si absent, à confirmer) et nombre
   minimum d'offres par consultation (1 si absent, à confirmer).
3. Prix des offres : TTC par défaut (D-072) ; confirmer ou ajouter un champ
   taxes.
4. Stockage des coordonnées bancaires (RIB) dans SIGTB : oui ou non (aucune
   intégration bancaire, D-055).
5. Validation par une seconde personne de la création d'un fournisseur.

## Défauts bloquants constatés

Aucun. Tous les écrans écrivent par fonctions serveur ; paramètres conformes
aux dernières définitions ; les listes vides désactivent l'enregistrement
(fournisseur d'offre, contact, critère). Défaut mineur non bloquant : une
consultation créée avec « Dépôt à préciser » ne peut pas préparer son bon
depuis l'écran : `ConsultationsFournisseurs.tsx:193` appelle
`preparer_bon_commande_consultation` sans `p_depot`, et la fonction refuse
(« Dépôt de livraison requis », `20261118120000` l.994) ; la sélection avec
préparation (`selectionner_offre`, `20261120103000` l.270) échoue de même.
Contournement : créer la consultation avec un dépôt.

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Export CSV du répertoire et import initial en masse (ImportWizard) pour la première saisie réelle | M | composant ImportWizard |
| 2 | Lien fournisseur - contrat (nature « fournisseur » au dossier contractuel) | M | module 19 |
| 3 | Réclamations fournisseur (objet, motif, montant, suivi, clôture) | M | - |
| 4 | Choix du dépôt au moment de préparer le bon d'une consultation sans dépôt | S | - |
| 5 | Catalogue produits et prix fournisseur (référence, prix, délai, dernier achat) | M | module 17 |
| 6 | Pièces jointes des documents administratifs | M | lot D (stockage) |
| 7 | Tableau de bord fournisseurs, relance des documents expirés | M | notifications |
| 8 | Demande de cotation imprimable | S | modèles d'impression |
| 9 | Rattacher les paiements des factures Neemba à la fiche du loueur | S | module 20 |
