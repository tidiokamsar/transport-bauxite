# Module 23 : Documents et GED

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(= `main` 8df078d + fiche modèle). Le stockage des pièces jointes
appartient au jalon J1 (bloc 1, section 2 : « sans pièce, pas de
preuve ») ; il est autorisé par le propriétaire (D-069, point 2 : bucket
privé, politiques par module et site, contrôle du type et de la taille,
précautions sur le serveur web partagé). La GED avancée (circuits,
rétention, OCR, signature) relève de J4 et des extensions à déclencheur.

## Synthèse des états

| # | Élément (liste du propriétaire) | État | Preuve principale |
|---|---|---|---|
| 1 | Référentiel documentaire (types de documents) | MANQUANT | types codés par table (`vehicle_documents`, `documents_fournisseurs`, `habilitations_chauffeur`) |
| 2 | Classement | MANQUANT | - |
| 3 | Dossiers | MANQUANT | dossier numérique du voyage : MANQUANT (matrice, module 07) |
| 4 | Métadonnées | PARTIEL | métadonnées sans fichier : `vehicle_documents` (type, référence, dates, coût), `documents_fournisseurs` (D-059), `habilitations_chauffeur` (D-051), colonnes `reference_piece` texte de nombreux registres |
| 5 | Versions | MANQUANT | - |
| 6 | Pièces jointes | MANQUANT | aucun `supabase.storage`, aucun bucket ; service `storage` retiré de la pile (`deploy/vps/docker-compose.yml:7`) et route `/storage/*` fermée (`deploy/vps/sigtb.caddy:33-36`) |
| 7 | Prévisualisation | MANQUANT | - |
| 8 | Recherche | MANQUANT | `GlobalSearchModal` ne cherche aucun document |
| 9 | OCR | MANQUANT | extension à déclencheur (bloc 1, section 9) : non commencée |
| 10 | Signature électronique selon le cadre applicable | MANQUANT | extension à déclencheur (cadre juridique à fournir) : non commencée |
| 11 | Circuits de validation | MANQUANT | - |
| 12 | Archivage | PARTIEL | `vehicle_documents.status = 'archived'` (`VehicleDocumentsView.tsx:56`) ; `documents_fournisseurs.retire_le` motivé |
| 13 | Rétention | MANQUANT | - |
| 14 | Téléchargement | MANQUANT | - |
| 15 | Impression | MANQUANT | (impression des écrans par `src/lib/exports.ts`, pas de document stocké) |
| 16 | Partage contrôlé | MANQUANT | - |
| 17 | Alertes d'échéance des documents de véhicule | DÉPLOYÉ | `v_documents_vehicule_a_renouveler` (D-062, migration `20261118210000`, déployée) ; pgTAP 45, E2E `flotte` |

Décompte : DÉPLOYÉ 1, PARTIEL 2, MANQUANT 14, MAQUETTE 0 (17 éléments).
Aucun élément UTILISABLE ni VALIDÉ.

## 1. Objectifs et périmètre

Conserver la preuve de chaque franc facturé ou payé (finalité du bloc 1) :
le ticket de pesée CBG et le relevé CBG (module 14), la fiche terrain
signée (module 07), les relevés kilométriques (D-043), le bon de
livraison carburant CBG (module 13), la facture Neemba et ses annexes
(module 10), les pointages (module 10), les factures et avoirs émis
(module 20), les contrats et avenants (module 19), les documents de
véhicules, de chauffeurs et de fournisseurs, les PV (moyens généraux,
recette, HSE). Le module fournit un **socle commun de pièces jointes**
utilisé par tous les modules, puis une GED (classement, versions,
recherche, rétention, partage).

Décisions de référence : D-069 point 2 (pièces jointes autorisées et
conditions), D-077 (pièces jointes multiples dans le standard ; socle
serveur commun ; composant AttachmentModal), D-062 (documents de
véhicule, alertes), D-059 (documents fournisseurs, `reference_piece`),
D-051 (pièce justificative des habilitations), D-016 (pile Supabase
auto-hébergée réduite), règles non négociables 2 (RLS) et 3 (aucun
secret dans git). Extensions à déclencheur : OCR des tickets (échantillon
réel et constat que l'import CSV ne suffit pas), signature électronique
(cadre juridique fourni par le propriétaire), portails partenaires
(module 25).

## 2. Sous-modules

1. Socle de pièces jointes (J1) : dépôt, contrôle, stockage privé,
   rattachement à un objet métier, lecture selon les droits de l'objet,
   remplacement par nouvelle version, retrait motivé.
2. Référentiel documentaire : types, métadonnées obligatoires par type,
   validité, documents exigés par objet (ex. ticket CBG exigé pour valider
   un rapprochement, à décider).
3. Dossiers et classement : dossier d'un voyage, d'un engin, d'un
   chauffeur, d'un contrat, d'une période de facturation.
4. Consultation : prévisualisation (PDF, image), téléchargement,
   impression, recherche par métadonnées.
5. Cycle de vie : circuits de validation, archivage, rétention, partage
   contrôlé.
6. Extensions à déclencheur : OCR, signature électronique.

## 3. Menus et sous-menus

| Entrée (`menu.ts`) | Vue | Droit qui l'affiche | État |
|---|---|---|---|
| Flotte > Documents (`documents`) | `VehicleDocumentsView` | lecture `vehicles` | métadonnées des documents de véhicule seulement |
| Cible : Documents > Bibliothèque, À valider, À renouveler, Paramétrage des types | - | selon le module de chaque document | MANQUANT |
| Cible : onglet « Pièces » dans chaque fiche métier (voyage, ticket, facture, contrat, engin, chauffeur, fournisseur, bien, incident) | AttachmentModal commun | droits de l'objet | MANQUANT |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Documents de véhicule (liste, alertes) | `vehicle_documents`, `v_documents_vehicule_a_renouveler` | PARTIEL | `VehicleDocumentsView.tsx` : recherche, filtres, alertes, archivage ; colonnes `file_*` présentes en base mais jamais remplies |
| Saisie / modification d'un document de véhicule | `vehicle_documents` | PARTIEL | `VehicleDocumentModal.tsx` : métadonnées, aucun fichier |
| Documents fournisseurs | `documents_fournisseurs` | PARTIEL | module 15 (D-059) : référence texte de la pièce papier |
| Pièces jointes d'un objet (AttachmentModal) | - | MANQUANT | - |
| Bibliothèque documentaire, recherche | - | MANQUANT | - |
| Prévisualisation | - | MANQUANT | - |
| Paramétrage des types et de la rétention | - | MANQUANT | - |
| Circuits de validation | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

PARTIEL : documents de véhicule à renouveler (`v_documents_vehicule_a_renouveler`,
jours restants). Cible : pièces manquantes par processus J1 (tickets
rapprochés sans pièce, factures émises sans annexe, livraisons carburant
sans bon), documents expirés par domaine (véhicules, chauffeurs,
fournisseurs), volume stocké, documents en attente de validation ; chaque
indicateur avec source, période et heure.

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Document de véhicule (métadonnées) | DÉPLOYÉ (insert direct, droit `vehicles`, périmètre) | DÉPLOYÉ | DÉPLOYÉ (update direct, sans journal) | MANQUANT (renouvellement) | archivage DÉPLOYÉ, restauration MANQUANT | DELETE retiré (D-042) | - |
| Pièce jointe (fichier) | MANQUANT | MANQUANT | interdit : une nouvelle version remplace, l'ancienne reste | - | retrait motivé (cible) | dépôt abandonné avant rattachement seulement (cible) | nouvelle version (cible) |
| Type de document | MANQUANT | MANQUANT | MANQUANT | - | désactivation (cible) | type jamais utilisé (cible) | - |
| Dossier | MANQUANT | MANQUANT | - | - | clôture (cible) | - | - |

Règle cible : une pièce rattachée à une pièce métier émise (facture,
ticket validé, mouvement de stock ou de carburant) ne se retire jamais ;
elle se complète par une nouvelle version ou une pièce rectificative,
avec motif (D-077).

## 7. Modals et drawers

| Composant | État | Cible |
|---|---|---|
| AttachmentModal | MANQUANT | glisser-déposer ou sélection, plusieurs fichiers, type de document, métadonnées obligatoires du type, contrôle du format et de la taille avant envoi, progression, prévisualisation, liste des versions |
| Visionneuse (DetailDrawer) | MANQUANT | PDF et images dans le navigateur, sans exécuter de contenu |
| Retrait motivé (ActionDialog) | MANQUANT | motif obligatoire, refusé sur une pièce figée |
| Historique (HistoryDrawer) | MANQUANT | dépôts, versions, consultations sensibles, retraits |
| Partage contrôlé | MANQUANT | lien signé à durée limitée, vers un compte connecté seulement (aucun lien public) |
| Saisie de document de véhicule | PARTIEL | `VehicleDocumentModal` ; cible : fichier joint obligatoire selon le type |

## 8. Champs des formulaires

**Pièce jointe (cible).**

| Champ | Type | Obligatoire | Validation |
|---|---|---|---|
| Fichier | binaire | oui | type autorisé par liste blanche (PDF, JPEG, PNG ; CSV et XLSX pour les relevés), contrôlé par l'extension **et** la signature du contenu côté serveur ; taille maximale par réglage (valeur à fixer par le propriétaire, aucune valeur inventée) |
| Type de document | liste du référentiel | oui | actif, admis pour le type d'objet |
| Objet rattaché | type et identifiant | oui | l'objet existe et le déposant a le droit d'écriture de son module et son site |
| Titre, référence, date du document | texte, date | selon le type | - |
| Date d'expiration | date | selon le type (assurance, visite technique, permis) | postérieure à la date du document |
| Empreinte SHA-256, taille, type MIME | calculés | - | calculés par le serveur, jamais saisis |

**Document de véhicule (existant).** Véhicule, type (8 valeurs CHECK),
nom obligatoires ; référence, dates d'émission et d'expiration (expiration
après émission), fournisseur, coût (entier en base, `bigint` : un coût
décimal saisi est refusé par le serveur), notes.

## 9. Actions individuelles et en masse

| Action | État |
|---|---|
| Saisir, modifier, archiver un document de véhicule | DÉPLOYÉ (métadonnées) |
| Joindre, prévisualiser, télécharger, remplacer (nouvelle version), retirer avec motif | MANQUANT |
| Joindre en masse (ex. lot de tickets scannés d'une journée, rattachés par numéro de ticket) | MANQUANT |
| Télécharger le dossier d'une période de facturation (archive des pièces) | MANQUANT |
| Valider / rejeter un document dans un circuit | MANQUANT |

## 10. Statuts et transitions

Existant (`vehicle_documents.status`) : `active`, `expired`,
`pending_renewal`, `archived` ; seul `active -> archived` est fait par
l'écran ; l'expiration est calculée par la vue, pas par le statut.

Cible (pièce jointe) :

```
déposée (fichier reçu, contrôles serveur) -> rattachée (objet, type, métadonnées valides)
rattachée -> remplacée (nouvelle version ; l'ancienne reste consultable)
rattachée -> retirée (motif ; refusé si l'objet est figé : facture émise, ticket validé, mouvement)
rattachée -> figée (automatique quand l'objet passe à un état final)
rattachée -> en_validation -> validée | rejetée (circuit, si le type l'exige ; J4)
déposée non rattachée depuis 24 h -> purgée (fichier orphelin, aucun lien métier)
```

## 11. Workflows

1. Dépôt (J1) : l'utilisateur joint une pièce depuis la fiche de l'objet ;
   le serveur contrôle type, taille, signature du contenu, droit et site ;
   l'empreinte est enregistrée ; un doublon d'empreinte sur le même objet
   est signalé.
2. Pièce exigée (à décider) : le rapprochement d'un ticket CBG, la
   validation d'une distance ou d'une livraison carburant pourrait exiger
   une pièce ; option par défaut : signalée manquante, non bloquante.
3. Circuits de validation (J4) : par type de document, étapes et rôles,
   délais et relances (module 24).
4. Rétention (J4) : durée par type fixée par le propriétaire selon la
   réglementation applicable ; à l'échéance, proposition d'archivage, jamais
   de destruction automatique (suppression définitive = arrêt prévu par
   D-069).

## 12. Rôles et permissions

Cible : **la pièce suit les droits de son objet**. Lire une pièce exige
la lecture du module et du site de l'objet (`has_module_view` et
`site_permis` / `vehicule_permis` / `voyage_permis`) ; joindre exige
l'écriture ; retirer exige l'écriture et un objet non figé ; le
paramétrage des types et de la rétention est réservé à l'administrateur.
Les fichiers ne sont jamais servis par URL publique : téléchargement par
URL signée de courte durée délivrée après contrôle serveur.

Existant : `vehicle_documents` lu et écrit avec le droit `vehicles` et le
périmètre de l'engin (D-046).

## 13. Tables et relations

| Table | Colonnes clés | Contraintes / RLS | État |
|---|---|---|---|
| `vehicle_documents` | vehicle_id, document_type (8), document_name, reference_number, issue_date, expiry_date, file_name, file_url, file_type, file_size (jamais remplis), status, provider, cost | CHECK type et statut ; périmètre (D-046) ; DELETE retiré | PARTIEL |
| `documents_fournisseurs` | supplier_id, type_document, numero, dates, reference_piece (texte), retrait motivé | module 15 | PARTIEL |
| `habilitations_chauffeur` | pièce justificative en référence | module 09 | PARTIEL |
| Cible : bucket privé `pieces` (ou un bucket par domaine sensible) | chemin `module/site/objet/uuid` | politiques `storage.objects` appelant une fonction `piece_permise(objet_type, objet_id, action)` ; aucun accès `anon` | MANQUANT |
| Cible : `types_documents` | code, libellé, domaine, objets admis, métadonnées exigées, expiration exigée, formats admis, rétention (années) | admin, désactivation | MANQUANT |
| Cible : `pieces_jointes` | id, objet_type, objet_id, site_id (dérivé), type_document, titre, référence, date, expiration, statut | RLS selon l'objet ; écriture par fonctions | MANQUANT |
| Cible : `pieces_versions` | piece_id, version, chemin de stockage, sha256, taille, mime, déposée par, déposée le | append-only | MANQUANT |
| Cible : `pieces_journal` | piece, action (dépôt, version, consultation sensible, retrait, validation), auteur, motif | append-only | MANQUANT |

La table polymorphe (objet_type, objet_id) n'a pas de clé étrangère
native : une fonction de résolution par type d'objet contrôle
l'existence et le périmètre (liste fermée des types d'objets admis).

## 14. Fonctions serveur et API

Existant : vue `v_documents_vehicule_a_renouveler` (D-062). MANQUANT :
`deposer_piece` (réservation du chemin et contrôle des droits),
`confirmer_piece` (après envoi : taille, MIME, empreinte lus côté
serveur), `nouvelle_version_piece`, `retirer_piece(p_piece, p_motif)`,
`url_piece(p_piece)` (URL signée courte), `pieces_de(objet_type,
objet_id)`, purge des dépôts orphelins.

Infrastructure (prérequis constaté) : le service Storage de Supabase a été
retiré de la pile auto-hébergée (`deploy/vps/docker-compose.yml`, D-016)
et Caddy répond 404 sur `/storage/*` (`deploy/vps/sigtb.caddy`). Le lot
socle doit : ajouter le conteneur storage (image et version à vérifier
dans le modèle officiel `self-hosted` utilisé, sans deviner), un volume
de fichiers inclus dans `sauvegarder.sh` et `restaurer.sh` et dans le test
de restauration, ouvrir `/storage/v1/*` dans Caddy avec une taille de
requête bornée, en suivant D-069 point 2 : copie de la configuration avant
modification, test de syntaxe avant rechargement, vérification des six
autres sites après, retour arrière immédiat au moindre écart.

## 15. Notifications

PARTIEL : alertes d'échéance des documents de véhicule (écran). MANQUANT
: document expirant sous N jours pour véhicules, chauffeurs et
fournisseurs au centre de notifications (D-056) ; pièce exigée manquante ;
document à valider.

## 16. Documents et modèles d'impression

Hors GED, les impressions actuelles (fiches terrain, factures, rapports)
sont générées à la volée et non conservées. Cible : la version imprimée
d'une pièce émise (facture signée, fiche terrain émise, PV) est stockée
comme pièce figée de l'objet, avec son empreinte.

## 17. Exports et rapports

MANQUANT : registre des documents (CSV), liste des pièces manquantes par
processus J1, archive téléchargeable des pièces d'une période de
facturation CBG (preuve de chaque ligne de facture).

## 18. Historique et audit

MANQUANT : journal des dépôts, versions, retraits et consultations
sensibles. `vehicle_documents` est modifié sans journal (update direct).

## 19. Tests

Existants : pgTAP 45 (alertes de documents de véhicule), 29 (périmètre de
`vehicle_documents`), 26 (DELETE retiré) ; E2E `flotte` (alertes
d'expiration, saisie sans valeur inventée).

Manquants (à écrire avec le socle) : pgTAP lecture refusée hors module et
hors site, retrait refusé sur objet figé, version append-only, aucun accès
`anon` au bucket ; tests du contrôle de type par signature (fichier
renommé refusé) et de la taille ; E2E dépôt, prévisualisation,
téléchargement par URL signée, nouvelle version ; test de restauration
incluant les fichiers.

## 20. Critères de recette métier

1. Le chargé de contrats joint le relevé CBG du jour et les tickets
   scannés ; chaque ticket du rapprochement affiche sa pièce ; un compte
   d'un autre site ne la voit pas.
2. Il remplace un scan illisible : l'ancienne version reste consultable,
   l'historique montre qui et quand.
3. Une facture CBG émise : ses pièces ne peuvent plus être retirées ;
   l'archive de la période contient toutes les pièces des lignes facturées.
4. La restauration de la sauvegarde sur une instance vierge restitue les
   fichiers et leurs empreintes.
5. PV signé par le chargé de contrats et la direction.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucune colonne inexistante : les colonnes envoyées par
`VehicleDocumentModal.tsx:47-55` et `VehicleDocumentsView.tsx:56`
existent dans `vehicle_documents`. Défauts :

1. **Bloquant pour J1 (preuve).** Aucun moyen de joindre un fichier :
   ni bucket, ni service Storage dans la pile
   (`deploy/vps/docker-compose.yml:7`), route `/storage/*` fermée
   (`deploy/vps/sigtb.caddy:33-36`). Tickets, relevés et bons de livraison
   carburant ne peuvent pas être prouvés par leur pièce.
2. `src/components/Documents/VehicleDocumentModal.tsx:41` : le coût accepte
   un décimal alors que `vehicle_documents.cost` est un `bigint` : refus
   serveur (message affiché), contrôle client à aligner.
3. `src/components/Documents/VehicleDocumentModal.tsx:54` : modification
   par update direct sans journal ni motif.

### Lots proposés (ordre)

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Socle pièces jointes J1 : service Storage dans la pile (version vérifiée), volume sauvegardé et restauré, Caddy (procédure D-069), bucket privé, tables `types_documents`, `pieces_jointes`, `pieces_versions`, `pieces_journal`, fonctions `deposer_piece` / `confirmer_piece` / `url_piece` / `retirer_piece`, politiques par module et site, contrôle du type et de la taille ; composant AttachmentModal | L | revue indépendante (RLS, SECURITY DEFINER, migration) ; taille maximale et formats confirmés par le propriétaire ; sauvegarde vérifiée avant déploiement |
| 2 | Branchement J1 : tickets et relevés CBG (module 14), fiches terrain signées (module 07), relevés kilométriques (D-043), livraisons carburant CBG (module 13), factures Neemba (module 10), factures et avoirs émis (module 20) ; pièces figées avec l'objet | M | lot 1 |
| 3 | Branchement des documents existants : véhicules (`file_*` remplacé par la pièce jointe), chauffeurs (habilitations), fournisseurs (`reference_piece`), biens (module 18), incidents (module 22) | M | lot 1 |
| 4 | Pièces manquantes par processus et archive des pièces d'une période de facturation | S | lot 2 |
| 5 | Bibliothèque : recherche par métadonnées, filtres, prévisualisation, dossiers par objet | M | lot 3 ; DataTable |
| 6 | Notifications d'expiration (véhicules, chauffeurs, fournisseurs) | S | module 24 |
| 7 | Circuits de validation par type de document | M | module 24 (circuits) ; J4 |
| 8 | Rétention par type (archivage proposé, jamais de destruction automatique) | S | durées fournies par le propriétaire ; J4 |
| 9 | Partage contrôlé (URL signée vers un compte connecté) | S | lot 1 ; portails (module 25) sur déclencheur |
| 10 | OCR des tickets | L | déclencheur : échantillon de tickets réels et constat que l'import CSV du relevé CBG ne suffit pas ; non commencé |
| 11 | Signature électronique | L | déclencheur : cadre juridique fourni par le propriétaire ; non commencé |

Points à trancher par le propriétaire : taille maximale d'un fichier et
formats admis ; pièce exigée (bloquante) ou seulement signalée pour le
rapprochement CBG et la validation des distances (défaut : signalée) ;
durées de rétention par type selon la réglementation applicable ;
emplacement de la copie hors serveur (bloc 1, section 7 : la sauvegarde
des fichiers suit la même règle que celle de la base).
