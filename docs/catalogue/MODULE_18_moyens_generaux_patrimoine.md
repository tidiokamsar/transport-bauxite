# Module 18 : Moyens généraux et patrimoine

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(= `main` 8df078d + fiche modèle). Module du jalon J4 (extensions,
bloc 1 section 2) : il ne doit pas être élargi tant que la chaîne J1 n'est
pas fermée ; le registre existant reste utilisable dès que les sites sont
saisis.

## Synthèse des états

| # | Élément (liste du propriétaire) | État | Preuve principale |
|---|---|---|---|
| 1 | Matériel informatique | DÉPLOYÉ | `biens.categorie = 'informatique'` (D-060, migration `20261118150000`, déployée f79e708) ; pgTAP 43, E2E `moyens-generaux` |
| 2 | Mobilier | DÉPLOYÉ | catégorie `mobilier` |
| 3 | Équipements | DÉPLOYÉ | catégorie `equipement` |
| 4 | Outillage | DÉPLOYÉ | catégorie `outillage` |
| 5 | Véhicules administratifs | DÉPLOYÉ | catégorie `vehicule_administratif` avec immatriculation ; distincts du registre flotte (point à trancher) |
| 6 | Affectations | DÉPLOYÉ | `affecter_bien` (personne ou service) |
| 7 | Remises | DÉPLOYÉ | `remettre_bien` |
| 8 | Restitutions | DÉPLOYÉ | `restituer_bien` (état au retour) |
| 9 | Transferts | DÉPLOYÉ | `transferer_bien` (périmètre d'origine et de destination) |
| 10 | Inventaires | DÉPLOYÉ | `inventaires_biens`, `inventaires_biens_lignes`, `cloturer_inventaire_biens`, `v_inventaires_biens_ecarts` |
| 11 | État | DÉPLOYÉ | `constater_etat_bien` (bon, moyen, mauvais, hors service) |
| 12 | Réparations | DÉPLOYÉ | `reparer_bien` (nature, prestataire, coût, état après) |
| 13 | Réformes | DÉPLOYÉ | `reformer_bien` (motif obligatoire) |
| 14 | Amortissements si nécessaires | DÉPLOYÉ | `v_biens` : linéaire en mois entiers si valeur, date et durée saisies, sinon « sans données » ; `planAmortissement` côté écran |
| 15 | Documents | MANQUANT | aucune pièce jointe (facture d'achat, PV de remise signé), aucun document imprimable |
| 16 | Historique patrimonial | DÉPLOYÉ | `biens_operations` append-only, `annuler_operation_bien` motivée ; fiche « Historique » |
| 17 | Exports et rapports | MANQUANT | aucun export dans `MoyensGenerauxView.tsx` |
| 18 | Bénéficiaire lié aux employés ou comptes | PARTIEL | bénéficiaire en texte libre (D-060) |
| 19 | Étiquetage (étiquettes, codes-barres) | MANQUANT | - |

Décompte : DÉPLOYÉ 15, PARTIEL 1, MANQUANT 3, MAQUETTE 0 (19 éléments).
Aucun élément UTILISABLE ni VALIDÉ (production purgée, aucun bien saisi).

## 1. Objectifs et périmètre

Tenir le registre des biens non productifs de Kogon Mining SARL sur ses
sites (ordinateurs, mobilier de la base vie et des bureaux, équipements,
outillage d'atelier, véhicules de liaison), savoir qui détient quoi, dans
quel état, où, et à quelle valeur nette si l'amortissement est renseigné ;
contrôler par inventaire physique. Les engins de production loués à Neemba
et les camions relèvent du module 08 (flotte) ; les pièces et
consommables du module 17 (stocks).

Décisions de référence : D-060 (registre, journal append-only,
inventaires, amortissement conditionnel, droit `stock` à confirmer),
D-038 / D-039 (périmètre site), D-042 (aucune suppression), D-077.
Liens : sites (module 03), fournisseurs (module 15, `fournisseur_id`),
achats (module 16 : un bien pourrait naître d'une réception, non relié),
finance (module 20 : valeur nette pour les états de gestion), GED
(module 23 : PV et factures).

## 2. Sous-modules

1. Registre des biens et fiches.
2. Mouvements : affectation, remise, restitution, transfert.
3. État, réparation, réforme.
4. Inventaire physique par site.
5. Valorisation (amortissement linéaire conditionnel).
6. Documents (PV, factures, étiquettes) : cible.

## 3. Menus et sous-menus

| Entrée (`menu.ts`) | Vue | Droit qui l'affiche | Écriture |
|---|---|---|---|
| Stocks & Achats > Moyens généraux et patrimoine (`moyens-generaux`) | `MoyensGenerauxView` (onglets Registre, Inventaires physiques) | lecture `stock` (`AuthContext.canAccessModule`) | écriture `stock` ou admin, dans le périmètre (fonctions serveur) |

Rôles qui écrivent selon la matrice : `admin`, `director` (hérité de
`manager`), `logistician`. Lecture : `accountant`, `operations_manager`,
`fleet_manager`, `maintenance_chief` (lecture `stock`).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Registre (liste) | `v_biens` | PARTIEL | `MoyensGenerauxView.tsx:287-316` : recherche (numéro, désignation, série, bénéficiaire), filtres statut / catégorie / site ; ni tri par colonne, ni pagination, ni export |
| Saisie d'un bien | `enregistrer_bien` | DÉPLOYÉ | formulaire en panneau |
| Fiche du bien | `v_biens`, `biens_operations` | DÉPLOYÉ | l. 318-354 : informations, plan d'amortissement, historique, actions selon le statut, annulation de la dernière opération |
| Modification de fiche journalisée | `modifier_fiche_bien` (motif) | DÉPLOYÉ | - |
| Campagnes d'inventaire | `v_inventaires_biens` | DÉPLOYÉ | l. 356-384 |
| Détail d'une campagne (constats, écarts provisoires, clôture) | `inventaires_biens_lignes`, `v_inventaires_biens_ecarts` | DÉPLOYÉ | l. 385-420 |
| Tableau de bord patrimoine | - | MANQUANT | - |
| PV de remise / restitution imprimable | - | MANQUANT | - |
| Étiquettes à imprimer | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

MANQUANT. Cible (source, période, heure) :

| Indicateur | Source | Période |
|---|---|---|
| Biens par statut, catégorie et site | `v_biens` | instantané |
| Valeur d'acquisition et valeur nette (biens dont les trois données sont saisies, part des biens sans données affichée) | `v_biens` | date du jour |
| Biens hors service ou en mauvais état | `biens.etat_physique` | instantané |
| Coût des réparations | `biens_operations` (type réparation) | mois, année |
| Dernier inventaire par site et écarts non traités | `v_inventaires_biens`, écarts | campagne |
| Biens affectés à une personne sortie de l'effectif | lien bénéficiaire (cible) | instantané |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Bien | DÉPLOYÉ (`enregistrer_bien`) | DÉPLOYÉ | DÉPLOYÉ (`modifier_fiche_bien`, motif, avant/après au journal) | MANQUANT (saisie d'une série d'articles identiques) | réforme DÉPLOYÉ (définitive) | interdit (l'entrée et la fiche ne s'annulent pas) | DÉPLOYÉ (`annuler_operation_bien` sur la dernière opération) |
| Opération (affectation, remise, restitution, transfert, constat, réparation, réforme) | DÉPLOYÉ | DÉPLOYÉ | interdit (append-only) | - | - | - | annulation motivée DÉPLOYÉ |
| Campagne d'inventaire | DÉPLOYÉ (`ouvrir_inventaire_biens`, une ouverte par site) | DÉPLOYÉ | - | - | clôture DÉPLOYÉ | - | - |
| Constat d'inventaire | DÉPLOYÉ (`constater_inventaire_bien`) | DÉPLOYÉ | - | - | - | - | annulation motivée DÉPLOYÉ (`annuler_constat_inventaire`) |

## 7. Modals et drawers

| Composant | État | Cible |
|---|---|---|
| Saisie d'un bien | DÉPLOYÉ (panneau) | CreateModal avec sections Identification / Acquisition / Localisation, pièce jointe facture |
| Action sur un bien (formulaire selon l'action) | DÉPLOYÉ | ActionDialog ; PV généré à la remise et à la restitution |
| Annulation motivée | PARTIEL (`window.prompt`) | ActionDialog avec motif |
| Fiche et historique | DÉPLOYÉ (panneau) | DetailDrawer + HistoryDrawer |
| Pièces jointes | MANQUANT | AttachmentModal (module 23) |
| Import | MANQUANT | ImportWizard : reprise du registre existant en CSV |
| Export | MANQUANT | ExportModal (CSV, PDF) |

## 8. Champs des formulaires

**Bien.**

| Champ | Type | Obligatoire | Validation (client / serveur) |
|---|---|---|---|
| Numéro d'inventaire | texte | oui | normalisé en majuscules, unique sans tenir compte de la casse (`ux_biens_numero`) |
| Catégorie | liste (6) | oui | CHECK |
| Désignation | texte | oui | non vide |
| Marque, modèle, numéro de série | texte | non | - |
| Immatriculation | texte | non | conditionnel : proposé pour un véhicule administratif |
| Date d'acquisition | date | non | - |
| Valeur d'acquisition (GNF) | entier | non | >= 0 |
| Durée d'amortissement (mois) | entier | non | > 0 ; l'amortissement n'est calculé que si valeur, date et durée sont saisies |
| Fournisseur | liste `suppliers` | non | FK |
| Site | liste | oui | FK, périmètre |
| État à l'entrée | liste (4) | non | CHECK |
| Référence de pièce, date d'entrée, note | texte, date | non | - |

**Actions.** Affecter : type de bénéficiaire (personne, service) et
bénéficiaire obligatoires. Transférer : site de destination différent et
dans le périmètre. Constater : état obligatoire. Réparer : nature
obligatoire, prestataire, coût, état après. Réformer : motif obligatoire.
Annuler : motif obligatoire. Modifier la fiche : motif obligatoire.

**Constat d'inventaire.** Numéro lu (ou désignation pour un bien non
référencé), état, localisation, note ; résultat calculé par le serveur
(constaté, autre site, réformé retrouvé, non référencé) ; manquants figés
à la clôture.

## 9. Actions individuelles et en masse

Individuelles : DÉPLOYÉ (sept actions selon le statut, annulation de la
dernière opération, modification de fiche). En masse : MANQUANT
(transfert d'un lot de biens d'un site à l'autre, affectation d'un lot à
un service, impression d'étiquettes d'une sélection).

## 10. Statuts et transitions

Règles de `actionsPossibles` (`moyensGeneraux.ts:68-73`), appliquées
aussi par les fonctions serveur :

```
(entrée) -> en_stock
en_stock -> affecte   (affecter ; stock ; bénéficiaire obligatoire)
en_stock -> en_stock  (transférer ; site de destination dans le périmètre)
affecte  -> remis     (remettre)
affecte|remis -> en_stock (restituer ; état au retour)
en_stock|affecte|remis : constater, réparer (statut inchangé)
en_stock -> reforme   (réformer ; motif) ; reforme : aucune action
toute opération sauf l'entrée et la fiche -> annulée (dernière seulement, motif)
```

Campagne : `ouverte -> clôturée` (écarts figés, aucune régularisation
automatique, CDC 11.5).

## 11. Workflows

Existant : aucune approbation ; une seule personne enregistre et réforme.
Cible : réforme d'un bien dont la valeur nette dépasse un seuil soumise à
l'approbation de la direction (`has_module_approve('stock')`), seuil à
fixer par le propriétaire (aucune valeur inventée) ; traitement des écarts
d'inventaire (enquête, réforme ou transfert) par décision tracée ;
restitution obligatoire avant la sortie d'un employé (lien RH, cible).

## 12. Rôles et permissions

| Action | Droit | Contrôle serveur |
|---|---|---|
| Lire le registre et les inventaires | `stock` en lecture ou admin, périmètre | politiques `lecture_module` (`site_permis`) |
| Toutes les écritures | `stock` en écriture ou admin, périmètre ; transfert : périmètre d'origine et de destination | fonctions SECURITY DEFINER (D-060), aucune écriture directe |

Point à trancher (D-060) : droit du module `stock` (logistique) ou module
dédié `patrimoine`.

## 13. Tables et relations

| Table / vue | Colonnes clés | Contraintes / RLS |
|---|---|---|
| `biens` | numero_inventaire, categorie, designation, immatriculation, acquisition, valeur, durée, fournisseur_id, statut (cache), site_id, bénéficiaire, état | UNIQUE `upper(numero_inventaire)` ; CHECK statut et bénéficiaire cohérents ; RLS lecture `stock` et périmètre ; aucune écriture directe |
| `biens_operations` | bien_id, type (10), effectue_le, site, site d'origine, bénéficiaire, état, motif, données (fiche avant/après), saisi_par | append-only ; CHECK par type (affectation, réforme, transfert, constat, fiche) |
| `inventaires_biens`, `inventaires_biens_lignes` | site, ouverture, clôture ; résultat, bien, numéro lu, état, annulation | une campagne ouverte par site ; CHECK résultat et bien cohérents |
| `v_biens`, `v_biens_operations_effectives`, `v_inventaires_biens`, `v_inventaires_biens_ecarts` | valeur nette, mois écoulés | `security_invoker` |
| Cible : `biens.beneficiaire_profil_id` / `beneficiaire_employe_id`, `biens.service_id` (module 02) | FK facultatives, texte libre conservé | additives |

## 14. Fonctions serveur et API

DÉPLOYÉ : `enregistrer_bien`, `modifier_fiche_bien`, `affecter_bien`,
`remettre_bien`, `restituer_bien`, `transferer_bien`,
`constater_etat_bien`, `reparer_bien`, `reformer_bien`,
`annuler_operation_bien`, `ouvrir_inventaire_biens`,
`constater_inventaire_bien`, `annuler_constat_inventaire`,
`cloturer_inventaire_biens`. Paramètres des appels de
`MoyensGenerauxView.tsx` (l. 119-189) vérifiés contre les signatures de
la migration `20261118150000` : conformes.

MANQUANT : création d'un bien depuis une réception d'achat (module 16) ;
`imprimer_pv_remise` ou modèle de document ; import contrôlé.

## 15. Notifications

MANQUANT. Cible : inventaire ouvert depuis plus de N jours (N à fixer),
bien affecté à un compte désactivé, réparation sans clôture, au centre de
notifications (D-056).

## 16. Documents et modèles d'impression

MANQUANT : PV de remise et de restitution (bien, état, bénéficiaire,
date, signatures manuscrites), fiche du bien, état d'inventaire et liste
des écarts, étiquette avec numéro d'inventaire (code-barres ou QR code
généré sans dépendance UI nouvelle à vérifier). Pièces jointes (facture
d'achat, PV signé scanné) après le stockage de fichiers (module 23). La
signature électronique reste une extension à déclencheur (bloc 1,
section 9).

## 17. Exports et rapports

MANQUANT : registre (CSV, PDF), tableau d'amortissement par bien et
cumulé, état des écarts d'inventaire, coût des réparations par période.

## 18. Historique et audit

DÉPLOYÉ : journal append-only `biens_operations` (auteur `saisi_par`,
date de saisie serveur, motif des annulations, réformes et modifications,
données avant/après pour la fiche) ; constats d'inventaire annulés
conservés avec motif. Comparaison visuelle des versions de fiche :
MANQUANT.

## 19. Tests

Existants : pgTAP 43 (30 assertions : registre, unicité, cycle, périmètre,
amortissement, inventaire), 56 (contre-revue) ; unitaires
`MoyensGeneraux/moyensGeneraux.test.ts` ; E2E `moyens-generaux` (registre,
affectation, plan d'amortissement, annulation motivée ; inventaire,
écarts, clôture).

Manquants : E2E transfert hors périmètre refusé à l'écran, réparation
avec coût, réforme puis tentative d'action ; tests de l'export et des PV
quand ils existeront.

## 20. Critères de recette métier

1. Le logisticien saisit les ordinateurs et le mobilier de la base de
   Nimba, affecte un ordinateur à une personne, le remet, le reprend en
   mauvais état, le fait réparer, le réforme avec motif.
2. Il ouvre un inventaire du site, scanne ou saisit les numéros : un
   bien d'un autre site et un bien non référencé apparaissent en écart ;
   il clôture : les manquants sont figés.
3. Le comptable lit la valeur nette des biens dont la valeur, la date et
   la durée sont saisies ; les autres sont « sans données ».
4. PV signé par le logisticien et la direction.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucun. L'écran n'écrit qu'au moyen des quatorze fonctions serveur dont
les paramètres correspondent aux signatures ; il lit `suppliers`
(lecture soumise au droit achats : liste de fournisseurs vide pour un
compte sans ce droit, sans blocage puisque le champ est facultatif).

### Lots proposés (ordre)

Module J4 : à engager après la clôture de la chaîne J1, sauf le lot 1 qui
dépend du stockage de fichiers J1.

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Pièces jointes des biens (facture, PV signé, photo) | S | module 23 (bucket privé, table documentaire, D-069 point 2) |
| 2 | PV de remise / restitution imprimables, fiche du bien, état d'inventaire | S | modèles de documents (module 02, lot 9) ou impression HTML existante (`src/lib/exports.ts`) |
| 3 | Exports CSV / PDF du registre, de l'amortissement, des écarts | S | ExportModal |
| 4 | Liste au standard (tri, pagination, colonnes) et tableau de bord patrimoine | S | DataTable |
| 5 | Lien bénéficiaire vers un compte ou un employé, et service (module 02) ; alerte bien détenu par un compte désactivé | S | module 02 (référentiel des services) |
| 6 | Import CSV de reprise du registre | S | ImportWizard |
| 7 | Étiquettes avec numéro d'inventaire et code lisible | S | vérifier une génération sans nouvelle dépendance UI |
| 8 | Approbation des réformes au-dessus d'un seuil | S | seuil fixé par le propriétaire |
| 9 | Création d'un bien à partir d'une réception d'achat | M | module 16 |

Points à trancher par le propriétaire : module de droit (`stock` ou
module dédié) ; véhicules de liaison dans le patrimoine ou dans la flotte
(module 08 : suivi kilométrique, carburant) ; seuil d'approbation des
réformes ; usage comptable de l'amortissement (simple information de
gestion, D-060, ou base d'export comptable, module 20).
