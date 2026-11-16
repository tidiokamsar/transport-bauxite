# Module 17 : Stocks et magasins

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : registre D-044 déployé (`7abf1b6`, migration
`20261115180000`), correctifs D-072 déployés (`16f149e`). Stocks avancés
D-067 (réservations, lots et séries, coût moyen pondéré ; migration
`20261121130000`) fusionnés sur `main` (PR #92, `9ad7116`), sans déploiement
consigné dans `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` : état TESTÉ.
Démonstration purgée (D-076) : aucun article réel.

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 2 |
| MAQUETTE | 0 |
| PARTIEL | 6 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 5 |
| DÉPLOYÉ | 9 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : aucun (voir la dernière section). Écran de
saisie prioritaire (articles, dépôts) : fonctionnel, mais sans catégories ni
import en masse pour la première saisie.

## 1. Objectifs et périmètre

Magasin des pièces, consommables, pneus en stock et fournitures de KOGON
MINING, par dépôt et par site. La quantité n'est jamais saisie : elle est la
somme des mouvements (D-044). Le module reçoit les entrées des achats
(module 16), sert les ordres de travail (module 11) et les engins, et fournit
la valeur du stock et le coût des consommations (modules 20, 21). Les engins
loués sont entretenus par Neemba (D-022, D-025) : le magasin sert surtout les
consommables, pneus et équipements de l'exploitant.

Décisions de référence : D-042, D-044 (registre), D-053 (réception d'achat),
D-061 (pièces d'ordre de travail sorties du registre), D-067 (réservations,
lots, séries, CMP), D-072 (politiques bornées, oracles retirés), D-075
(lecture bornée au site du dépôt).

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Articles | Code, désignation, unité, prix de référence, seuils, suivi, actif | DÉPLOYÉ | `StockView.tsx:120-124` (insert/update colonnes accordées `20261115180000` l.142) ; pgTAP 28 ; E2E `stocks-magasin` |
| 2 | Catégories | Référentiel hiérarchique des familles d'articles | MANQUANT | Table `stock_categories` (base de référence) sans écran ; `category_id` non saisi |
| 3 | Unités | Référentiel d'unités et conversions (achat / stock) | PARTIEL | Texte libre `unit_of_measure` (`StockView.tsx:214`) |
| 4 | Entrepôts | Créer, modifier, désactiver ; rattachement au site | PARTIEL | Création seule (`StockView.tsx:127`) ; ni modification ni désactivation à l'écran |
| 5 | Emplacements | Allée, rayon, case par dépôt | MANQUANT | `location_in_warehouse` accordé mais non saisi |
| 6 | Stocks disponibles | Par article et dépôt, réservé, libre | DÉPLOYÉ (quantité) / TESTÉ (réservé, libre) | `v_stock_depots` (D-044) ; `v_stock_disponibilite` (D-067). Compté DÉPLOYÉ |
| 7 | Réservations | Pour un ordre de travail, un engin ou une affectation ; levée motivée ; consommation par sortie | TESTÉ | `reserver_stock`, `lever_reservation_stock` ; pgTAP 50 ; E2E `stocks-avances` |
| 8 | Entrées | Entrée hors achat, prix saisi | DÉPLOYÉ | `mouvement_stock` |
| 9 | Sorties | Refus au-delà du stock libre, imputation ordre ou engin | DÉPLOYÉ | `mouvement_stock` ; imputation à l'ordre par l'écran Maintenance (D-061) |
| 10 | Transferts | Entre dépôts | DÉPLOYÉ | `mouvement_stock` type `transfer` |
| 11 | Retours | Retour au magasin | DÉPLOYÉ | type `return` |
| 12 | Inventaires | Comptage par article et dépôt, ajustement motivé ; campagne d'inventaire | PARTIEL | `inventorier_stock` (DÉPLOYÉ), `inventorier_lot_stock` (TESTÉ) ; pas de campagne (liste à compter, gel, clôture) |
| 13 | Ajustements autorisés | Ajustement seulement par inventaire, motif obligatoire | DÉPLOYÉ | D-044 |
| 14 | Seuils minimum et maximum | Alerte sous le minimum, au-dessus du maximum | PARTIEL | Minimum saisi et alerte affichée (`alerteArticle`) ; maximum non saisi |
| 15 | Alertes | Notification des ruptures et seuils | PARTIEL | Affichage dans la liste seulement |
| 16 | Lots | Lot exigé à chaque mouvement d'un article suivi | TESTÉ | `stock_mouvements_lots` ; pgTAP 50 |
| 17 | Séries | Numéro de série unique, une unité, jamais deux fois en stock | TESTÉ | idem |
| 18 | Traçabilité | Trace d'un lot ou d'une série | TESTÉ | `v_stock_lots_mouvements`, `LotsStock.tsx` |
| 19 | Valorisation | Coût moyen pondéré, valeur partielle signalée, montants GNF | TESTÉ | `valorisation_articles_stock`, `v_valorisation_*`, `ValorisationStock.tsx` |
| 20 | Historique des mouvements | Registre append-only numéroté MVT, export | DÉPLOYÉ | `stock_movements`, `StockView.tsx:168, 298-314` |
| 21 | Coût des consommations | Coût des sorties par engin, ordre, site et période | PARTIEL | Sorties au CMP dans la valorisation ; aucun rapport de coût par engin ou ordre |
| 22 | Annulation | Contre-mouvement motivé, original conservé | DÉPLOYÉ | `annuler_mouvement_stock` |

## 3. Menus et sous-menus

« Stocks & Achats > Stocks » (`stock`), droit `stock` (`AuthContext.tsx:187`).
Écriture : admin, director, logistician. Lecture : operations_manager,
fleet_manager, maintenance_chief, accountant, contract_manager. Aucun accès :
driver. Sous-panneaux de l'écran : articles, réservations, valorisation,
lots, dépôts, registre.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Stocks magasin : articles | Liste, recherche, quantités par dépôt, réservé, seuil, alerte, modifier, archiver | DÉPLOYÉ (réservé : TESTÉ) | `StockView.tsx:268-284` |
| Saisie des mouvements (entrée, sortie, transfert, retour) | Panneau | DÉPLOYÉ (lots, réservation : TESTÉ) | `StockView.tsx:244-260` |
| Inventaire | Panneau | DÉPLOYÉ | `StockView.tsx:227-232` |
| Réservations | Liste, lever, sortir | TESTÉ | `ReservationsStock.tsx` |
| Valorisation | CMP, valeur partielle, « à vérifier » | TESTÉ | `ValorisationStock.tsx` |
| Lots et séries | Stock par lot, trace | TESTÉ | `LotsStock.tsx` |
| Dépôts | Liste, création | PARTIEL | `StockView.tsx:221-226, 293-296` |
| Registre des mouvements | Liste (300 derniers), annulation, export CSV | DÉPLOYÉ | `StockView.tsx:298-314` ; pas de filtre ni de pagination |
| Fiche article (historique, dépôts, lots, consommations) | Article | MANQUANT | - |
| Campagne d'inventaire | Liste à compter, écarts, clôture | MANQUANT | - |
| Catégories, unités, emplacements | Référentiels | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | État |
|---|---|---|
| Alerte de seuil par article | `stock_items.minimum_threshold` | DÉPLOYÉ (liste) |
| Valeur du stock par dépôt et article | `v_valorisation_depots`, `v_valorisation_articles` | TESTÉ |
| Ruptures, couverture en jours, rotation, consommation par engin | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Article | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (suivi modifiable sans stock seulement) | MANQUANT | PARTIEL (archivage, pas de restauration) | interdit (D-042) | sans objet |
| Dépôt | DÉPLOYÉ | DÉPLOYÉ | MANQUANT (écran) | sans objet | MANQUANT | sans objet | sans objet |
| Mouvement | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | DÉPLOYÉ (contre-mouvement) |
| Réservation | TESTÉ | TESTÉ | interdit | sans objet | sans objet | sans objet | TESTÉ (levée motivée) |
| Inventaire | DÉPLOYÉ | DÉPLOYÉ (ajustement au registre) | interdit | sans objet | sans objet | sans objet | DÉPLOYÉ (contre-mouvement de l'ajustement) |

## 7. Modals et drawers

Panneaux de saisie (article, dépôt, mouvements, réservation, inventaire) :
DÉPLOYÉ. Confirmation d'archivage (`window.confirm`) et motifs
(`window.prompt`) : PARTIEL au regard d'ArchiveDialog et ActionDialog.
DetailDrawer article, import d'articles (ImportWizard), pièces jointes :
MANQUANT.

## 8. Champs des formulaires

| Formulaire | Champs | Obligatoires | Règles |
|---|---|---|---|
| Article | code, désignation, unité (texte, `piece` par défaut), prix de référence (GNF, entier), seuil minimum, suivi (aucun, lot, série) | code, désignation | suivi modifiable seulement sans stock (`garde_suivi_article`) ; prix de référence hors valorisation |
| Dépôt | code, nom, type (`main`, `garage`, `fuel_station`, `depot`), site (« Tous sites » = NULL) | code, nom | site dans le périmètre (RLS `site_permis`) ; NULL refusé à un profil borné |
| Mouvement | article, dépôt source et/ou destination, quantité (entier), date-heure, prix (entrée), réservation (sortie), pièce, note, lots / séries | article, quantité, dépôts requis par le type ; lots si article suivi | sortie au plus le stock libre (serveur) |
| Réservation | article, dépôt, quantité, ordre de travail, engin, affectation, note | article, dépôt, quantité, un des trois rattachements | au plus le stock libre |
| Inventaire | article, dépôt, lot (si suivi), quantité comptée, motif | article, dépôt, quantité ; motif si écart | inventaire global refusé pour un article suivi |

Champs cibles manquants : catégorie, seuil maximum, emplacement, fournisseur
habituel, référence fabricant, unité d'achat et facteur de conversion.

## 9. Actions individuelles et en masse

Entrée, sortie, transfert, retour, réservation, levée, inventaire,
annulation, archivage, export CSV du registre : DÉPLOYÉ ou TESTÉ (écriture
`stock`). Actions en masse (inventaire de plusieurs articles, archivage
groupé, import d'articles) : MANQUANT. Impression d'un bon de sortie :
MANQUANT.

## 10. Statuts et transitions

```
Article : actif -> archive (update active=false, ecriture stock) ; restauration : MANQUANT
Mouvement : enregistre (append-only) ; annule par contre-mouvement 'annulation' (motif),
            refuse pour un mouvement issu d'une reception (annuler la reception) ou
            une piece d'ordre annule (D-061, D-072 R4)
Reservation : active -> consommee (sortie qui la cite) | levee (motif, ou cloture de l'ordre)
Valorisation article : normale | partielle (entree sans prix) | a verifier (entree annulee tardive)
```

## 11. Workflows

Réception d'achat (module 16) -> entrée au dépôt au prix commandé ;
réservation pour un ordre de travail -> sortie qui consomme la réservation ->
levée automatique à la clôture de l'ordre ; inventaire -> ajustement motivé.
Pas de séparation saisie / validation pour le magasin (D-044, à reconsidérer
si l'exploitation le demande). Campagne d'inventaire avec validation du
responsable : MANQUANT.

## 12. Rôles et permissions

Lecture : `stock` et site du dépôt (D-072, D-075) ; catalogue d'articles
global. Écriture : `stock` + `depot_ecrivable`. Sortie sur ordre : `stock` +
`ordre_travail_permis` ; sur engin : `vehicule_permis`. Réception de pneus :
`stock` + `vehicles` ou `maintenance`. Limite consignée (D-067) :
`stock_items.quantity_in_stock` reste un total tous dépôts lisible par un
compte borné.

## 13. Tables et relations

`stock_items` (catalogue, `suivi`, cache `quantity_in_stock`) ;
`warehouses` (+ `site_id`) ; `stock_movements` (append-only, MVT,
`enregistre_le`) ; `stock_mouvements_lots` ; `reservations_stock` (RES) ;
vues `v_stock_depots`, `v_stock_disponibilite`, `v_reservations_stock`,
`v_stock_lots`, `v_stock_lots_mouvements`, `v_valorisation_stock`,
`v_valorisation_articles`, `v_valorisation_depots`. `stock_categories` sans
usage. RLS active, aucune écriture directe des mouvements, DELETE retiré.

## 14. Fonctions serveur et API

`mouvement_stock` (13 paramètres), `inventorier_stock`,
`inventorier_lot_stock`, `reserver_stock`, `lever_reservation_stock`,
`annuler_mouvement_stock`, `valorisation_articles_stock`
(`20261121130000`). En production (D-044) : `mouvement_stock` à 11
paramètres tant que D-067 n'est pas déployée ; l'écran actuel envoie 13
paramètres (`StockView.tsx:143-151`) : le déploiement du front et de la
migration D-067 doit être simultané (même release), sinon les mouvements
échouent. Écritures directes : `stock_items` (insert, update) et
`warehouses` (insert) sous RLS, colonnes vérifiées existantes et accordées.

## 15. Notifications

Rupture ou seuil franchi, réservation non consommée depuis N jours,
inventaire en retard : MANQUANT (affichage seulement).

## 16. Documents et modèles d'impression

Bon de sortie, bon de transfert, feuille de comptage d'inventaire,
étiquettes d'emplacement : MANQUANT.

## 17. Exports et rapports

Export CSV du registre (DÉPLOYÉ). Valeur du stock par dépôt, consommations
par engin et période, articles dormants : MANQUANT (valorisation à l'écran
seulement).

## 18. Historique et audit

Registre append-only avec auteur, date d'enregistrement serveur, motif ;
annulations reliées : DÉPLOYÉ. Modification d'un article (prix, seuil,
suivi) : aucun journal (MANQUANT).

## 19. Tests

Existants : pgTAP 28 (registre), 44 (corrections écrans), 50 (stocks
avancés, 96 assertions), 55 (achats et maintenance) ; unitaire
`src/components/Stock/stock.test.ts` ; E2E `stocks-magasin.spec.ts`,
`stocks-avances.spec.ts`. Manquants : E2E profil borné à un site ; E2E
création d'article et de dépôt contre une vraie base.

## 20. Critères de recette métier

Le magasinier crée les dépôts et articles réels, saisit l'inventaire
d'ouverture, reçoit un bon de commande, sert un ordre de travail sur
réservation, effectue un inventaire de fin de mois : écarts motivés, valeur
du stock cohérente avec les entrées valorisées. PV signé : aucun.

## Points à trancher par le propriétaire

1. Coût moyen visible par un compte borné, calculé sur tous les sites (D-067,
   à confirmer).
2. Séparation saisie / validation pour les mouvements de magasin (D-044 : non).
3. Annulation d'une réception de pneus (dérogation D-052 retenue par D-067).
4. Devise du registre : GNF (aucune devise sur les mouvements).
5. Liste des catégories d'articles et des unités à charger.

## Défauts bloquants constatés

Aucun sur le code de `main`. Écritures vérifiées : `stock_items` insert et
update (`StockView.tsx:121-123`) : colonnes `item_code`, `name`,
`unit_of_measure`, `unit_price`, `minimum_threshold` accordées
(`20261115180000` l.142), `suivi` accordée (`20261121130000` l.90) ;
archivage (`l.160`, colonne `active` accordée) ; `warehouses` insert
(`l.127`) : colonnes existantes, site envoyé `NULL` et jamais `''`. Les
appels de fonctions correspondent aux définitions de `20261121130000`.
Risque de déploiement (non bloquant sur `main`) : voir section 14.

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Import en masse des articles et de l'inventaire d'ouverture (ImportWizard) | M | composant ImportWizard |
| 2 | Catégories, unités, emplacements (référentiels et saisie) | M | - |
| 3 | Modification et désactivation des dépôts ; restauration d'un article archivé ; journal des modifications d'articles | S | - |
| 4 | Fiche article (DetailDrawer) : dépôts, lots, réservations, mouvements, consommations | M | DetailDrawer |
| 5 | Campagne d'inventaire (liste à compter, saisie en masse, validation) | M | BulkActionBar |
| 6 | Rapport de coût des consommations par engin, ordre, site, période ; valeur du stock exportable | M | module 21 |
| 7 | Seuil maximum, alertes notifiées (rupture, seuil) | S | notifications |
| 8 | Registre : filtres, pagination au-delà de 300 lignes | S | DataTable |
| 9 | Bons de sortie et de transfert imprimables | S | modèles |
| 10 | Déploiement coordonné de D-067 (migration et front dans la même release) | S | D-069 |
