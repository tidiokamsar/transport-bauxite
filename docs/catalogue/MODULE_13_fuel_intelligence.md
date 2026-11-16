# Module 13 : Fuel Intelligence (carburant)

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : dernière mise à jour consignée `3bbfded`
(`docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 9), démonstration purgée
(D-076) : aucune donnée réelle, donc aucun élément UTILISABLE ni VALIDÉ.

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 3 |
| MAQUETTE | 0 |
| PARTIEL | 7 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 0 |
| DÉPLOYÉ | 15 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : aucun sur les écrans de ce module (voir la
dernière section).

## 1. Objectifs et périmètre

Le carburant est fourni par CBG, au moins chaque semaine, à un prix au litre
qui varie et qui est saisi à chaque livraison (D-034). Il est à la charge de
l'exploitant et n'est pas déduit du décompte du loueur (D-022). Le module
doit permettre de savoir, pour une période et un site : ce qui a été livré et
facturé par CBG, ce qui a été réellement reçu en cuve, ce qui a été
distribué à chaque engin, ce qui reste en stock (prouvé par inventaire), les
écarts, et le coût par engin et par tonne. C'est le coeur du jalon J2.

Décisions de référence : D-022, D-028 (fiche carburant FC), D-030 (analyse
et anomalies sur données réelles), D-034 (livraisons et facture CBG), D-041
(registre des mouvements), D-062 (`saisir_plein`), D-072 (correctifs de
revue : transfert, périmètre site), D-075 (lecture bornée au site).

Entrées : livraisons CBG (bons), fiches carburant FC (module 07, `Fiches`),
pleins unitaires, engins (module 08), sites (module 03), tonnages livrés
(module 07/14, pour L/t), heures pointées (module 10, pour L/h).
Sorties : coût carburant par engin et par tonne (modules 01, 20, 21),
engagement « référence carburant » (module 19, D-031), anomalies (module 26).

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue (demande du propriétaire) | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Référentiel carburant | Produits (gasoil, essence, AdBlue), unité (L), densité facultative, actif | MANQUANT | Aucun écran ; produit unique implicite dans `livraisons_carburant_cbg` |
| 2 | Fournisseur CBG | Livraison et facture rattachées à la fiche fournisseur CBG (module 15) et au contrat qui fixe les conditions | PARTIEL | CBG implicite : `livraisons_carburant_cbg` n'a ni `supplier_id` ni `contrat_id` |
| 3 | Documents de livraison | Bon de livraison CBG joint (fichier), numéro, date | PARTIEL | `document_ref` texte (`LivraisonsCbgView.tsx:108`) ; aucun stockage de fichiers (matrice, constat 4) |
| 4 | Réception | Réception d'une livraison dans un stockage du même site | DÉPLOYÉ | `receptionner_livraison_cbg` (`20261115090000`), `StocksCarburantView.tsx:108` ; pgTAP 25, 52 ; E2E `stocks-carburant` |
| 5 | Contrôle physique | Volume mesuré, méthode (jauge, pige, compteur), motif obligatoire si écart au document | DÉPLOYÉ | `receptions_carburant` ; même preuve |
| 6 | Acceptation | Volume accepté, entrée en stock validée par une autre personne | DÉPLOYÉ | `decider_mouvement_carburant`, réglage `carburant_validation_separee` (D-041) |
| 7 | Stockage | Stock = somme des mouvements validés, NULL tant qu'aucun inventaire d'ouverture validé | DÉPLOYÉ | `mouvements_carburant` append-only, `v_stocks_carburant` (D-041) |
| 8 | Cuves et citernes mobiles | Créer, modifier capacité et seuil, désactiver | PARTIEL | Création seule (`StocksCarburantView.tsx:102`) ; UPDATE accordé (`20261115090000` l.161) mais aucun écran de modification ni de désactivation |
| 9 | Transferts | Sortie et entrée liées, décidées en bloc ; annulation en bloc | DÉPLOYÉ | `transferer_carburant` ; D-072 R1 (annulation en lot commun) |
| 10 | Distribution | Distribution depuis une cuve par la fiche FC (lignes par engin) | DÉPLOYÉ | `saisir_carburant` (`20261120100000`) ; module 07 `Fiches` |
| 11 | Saisie des pleins | Plein unitaire, cuve facultative, compteur | DÉPLOYÉ | `saisir_plein` (`20261118210000`), `PleinsView.tsx:81` ; pgTAP 45 ; E2E `analyses` (plein unitaire) |
| 12 | Validation des distributions | Toute sortie de cuve validée par une autre personne | PARTIEL | Distribution depuis une cuve : mouvement `a_valider` ; plein sans cuve : aucune validation ; aucune annulation de plein (`fuel_transactions`) |
| 13 | Inventaires | Mesure, solde théorique figé, ajustement à la validation, refus si le solde a changé | DÉPLOYÉ | `saisir_inventaire_carburant`, `decider_inventaire_carburant` |
| 14 | Écarts | Écart de réception et d'inventaire chiffré, motivé, historisé | DÉPLOYÉ | `receptions_carburant.motif_ecart`, `inventaires_carburant.ecart` |
| 15 | Anomalies | Règles déterministes (L/h, L/km, seuil saisi) | DÉPLOYÉ | `anomalies_carburant` (`20261111150000`), `AnomaliesCarburantView.tsx` ; pgTAP 16 ; E2E `analyses` |
| 16 | Prix du litre | Saisi à chaque livraison, jamais déduit ni par défaut | DÉPLOYÉ | `enregistrer_livraison_cbg` (`20261112225739`) ; pgTAP 14, 25 |
| 17 | Valorisation | Coût moyen pondéré par stockage (entrées valorisées au prix livraison) | PARTIEL | PMP des livraisons de la période, tous stockages (D-034, limite D-041) |
| 18 | Coût par engin | Litres distribués x prix valorisé, par engin et période | DÉPLOYÉ | `consommation_carburant` (`20261112225739`), `AnalyseCarburantView.tsx` ; pgTAP 14, 16 |
| 19 | Consommation par tonne | L/t sur tonnage livré ; non calculable sans tonnage | DÉPLOYÉ | même fonction ; E2E `analyses` |
| 20 | Historique | Journal des mouvements, décisions, corrections ; historique des livraisons | PARTIEL | Registre `mouvements_carburant` ; livraisons et factures CBG sans correction ni journal |
| 21 | Rapports | Bilan carburant mensuel figé par site (livré, reçu, distribué, stock, écarts, coût) | PARTIEL | Exports CSV (`PleinsView.tsx:91`, `StocksCarburantView.tsx:142`, `AnalyseCarburantView`) ; aucun bilan figé |
| 22 | Import des documents CBG | Import CSV des livraisons et factures CBG | MANQUANT | Aucun import ; OCR soumis à déclencheur (CLAUDE.md, bloc 1 s.9) |
| 23 | Contrôle de la facture CBG | Facture rapprochée des livraisons sélectionnées, écart signalé | DÉPLOYÉ | `enregistrer_facture_carburant_cbg`, `controler_facture_carburant_cbg` ; pgTAP 14 |
| 24 | Correction d'une livraison ou d'une facture CBG saisie à tort | Annulation motivée puis nouvelle saisie | MANQUANT | Aucune fonction (`annuler_livraison*` introuvable) ; limite D-072 R1-11 |
| 25 | Jauges connectées | Lecture des capteurs de cuve | DÉPLOYÉ (extension à déclencheur, aucun matériel) | `CapteursCarburantView.tsx`, `ingest_fuel_data` ; déclencheur « choix d'un matériel » |

## 3. Menus et sous-menus

Groupe « Carburant » (`src/components/Layout/menu.ts`), droit `fuel`
(`src/contexts/AuthContext.tsx:178-182, 212`).

| Entrée | id | Écran | Rôles qui la voient (matrice `docs/guides/guide-administrateur.md`) |
|---|---|---|---|
| Pleins et cuves | `fuel` | `Fuel/PleinsView` | admin, director, operations_manager, fleet_manager, logistician, contract_manager (E) ; accountant, driver (L) |
| Livraisons et factures CBG | `livraisons-cbg` | `Fuel/LivraisonsCbgView` | idem |
| Stocks et cuves | `fuel-stocks` | `Fuel/StocksCarburantView` | idem |
| Analyse carburant | `fuel-dashboard` | `Fuel/AnalyseCarburantView` | idem |
| Anomalies | `fuel-anomalies` | `Fuel/AnomaliesCarburantView` | idem |
| Jauges connectées | `fuel-sensors` | `Fuel/CapteursCarburantView` | idem |

Cible : le rôle `driver` ne devrait voir que ses propres pleins (aujourd'hui
lecture du module entier, bornée au site).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Pleins et cuves | Liste mensuelle des `fuel_transactions`, synthèse, saisie d'un plein, export CSV | DÉPLOYÉ | `PleinsView.tsx` ; E2E `analyses` |
| Livraisons et factures CBG | Saisie livraison, liste, saisie facture, contrôle | DÉPLOYÉ | `LivraisonsCbgView.tsx` ; aucun E2E dédié |
| Stocks et cuves | Stockages, stock calculé, réception, transfert, inventaire, décisions, annulation, export | DÉPLOYÉ | `StocksCarburantView.tsx` ; E2E `stocks-carburant` (2) |
| Analyse carburant | Consommation par engin, L/t, L/h, coût | DÉPLOYÉ | `AnalyseCarburantView.tsx` ; E2E `analyses` |
| Anomalies | Règles et seuil saisi | DÉPLOYÉ | `AnomaliesCarburantView.tsx` ; E2E `analyses` |
| Jauges connectées | Mesures des capteurs | DÉPLOYÉ (sans matériel) | `CapteursCarburantView.tsx` |
| Fiche détaillée d'un stockage (historique, inventaires, alertes) | Stockage | MANQUANT | Liste seule |
| Fiche détaillée d'une livraison (réception, facture, pièce) | Livraison | MANQUANT | - |
| Bilan carburant mensuel | Site, période | MANQUANT | - |
| Référentiel produits carburant | Produit | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Litres distribués, coût des distributions, litres reçus en cuve | `fuel_transactions` | Mois | DÉPLOYÉ (`PleinsView.tsx:119`) ; coût affiché comme absent (tiret) si un prix manque ; pas d'heure de fraîcheur affichée dans la synthèse |
| Stock par stockage, seuil d'alerte | `v_stocks_carburant` | Instant | DÉPLOYÉ |
| Consommation L/engin, L/t, L/h, coût | `consommation_carburant` | Saisie | DÉPLOYÉ |
| Indicateurs carburant du centre de pilotage | `indicateurs_pilotage` (D-057) | Saisie | DÉPLOYÉ (module 01) |
| Écart livré / reçu / facturé par période | - | - | MANQUANT |
| Jours d'autonomie par cuve (stock / consommation moyenne) | - | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Stockage (`stockages_carburant`) | DÉPLOYÉ (insert RLS `fuel` + site) | DÉPLOYÉ | MANQUANT (écran) | sans objet | MANQUANT (`actif` sans écran) | sans objet | sans objet |
| Livraison CBG | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | MANQUANT |
| Réception | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | DÉPLOYÉ (rejet du mouvement ou contre-mouvement) ; nouvelle réception après annulation : à trancher (D-072 R1-11) |
| Mouvement (transfert, distribution) | DÉPLOYÉ | DÉPLOYÉ | interdit (append-only) | sans objet | sans objet | interdit | DÉPLOYÉ (`annuler_mouvement_carburant`) |
| Inventaire | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | DÉPLOYÉ (rejet motivé) |
| Plein (`fuel_transactions`) | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | MANQUANT (aucune annulation) |
| Facture CBG | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | MANQUANT |

## 7. Modals et drawers

| Modal / drawer | État | Preuve |
|---|---|---|
| Saisie d'un plein | DÉPLOYÉ | `PleinsView.tsx` |
| Création de stockage, réception, transfert, inventaire | DÉPLOYÉ (panneau en page) | `StocksCarburantView.tsx:148-216` |
| Confirmation de rejet / annulation (motif) | PARTIEL (`window.prompt`) | `StocksCarburantView.tsx:126-141` |
| Pièces jointes (bon CBG, ticket de jauge) | MANQUANT | stockage absent |
| Historique d'un stockage | MANQUANT | - |
| Import CSV des livraisons | MANQUANT | - |
| Export (choix des colonnes) | PARTIEL (CSV fixe) | `src/lib/exports.ts` |

## 8. Champs des formulaires

| Formulaire | Champ | Type | Obligatoire | Règle (client / serveur) |
|---|---|---|---|---|
| Livraison CBG | Référence | texte | oui | unique (`livraisons_carburant_cbg.reference UNIQUE`) |
| | Date | date | oui | cible : non future |
| | Site | liste | oui | `site_id NOT NULL`, bouton désactivé sans site (`LivraisonsCbgView.tsx:110`) |
| | Quantité (L) | décimal | oui | > 0 (CHECK) |
| | Prix par litre (GNF) | décimal | oui | > 0 (CHECK) ; HT ou TTC : à trancher |
| | Bon / justificatif | texte | non | cible : pièce jointe obligatoire |
| Facture CBG | Référence, date, montant (GNF) | texte, date, décimal | oui | montant >= 0 ; au moins une livraison non facturée cochée |
| Stockage | Code, libellé, type (cuve fixe, citerne mobile), site, capacité, seuil | | code, libellé, site, capacité | capacité > 0, seuil >= 0 ; site dans le périmètre (RLS) |
| Réception | Livraison du site, stockage, date-heure, volume mesuré, volume accepté, méthode, motif d'écart | | tous sauf motif | motif obligatoire si accepté différent du document (serveur) |
| Transfert | Source, destination, litres, date, référence, note | | 4 premiers | source différente de destination |
| Inventaire | Stockage, date, volume mesuré, méthode, note | | 4 premiers | volume >= 0 |
| Plein | Date, engin, chauffeur, litres, compteur, cuve, note | | date, engin, litres | litres > 0 ; cuve du site de l'engin |

Champs cibles manquants : produit carburant, fournisseur et contrat de la
livraison, taux de taxe, pièce jointe, numéro de bon de livraison CBG
distinct de la référence interne.

## 9. Actions individuelles et en masse

| Action | Droit | État |
|---|---|---|
| Enregistrer livraison, facture, contrôler facture | écriture `fuel` | DÉPLOYÉ |
| Réceptionner, transférer, inventorier | écriture `fuel` | DÉPLOYÉ |
| Valider / rejeter un mouvement ou un inventaire | écriture `fuel`, autre personne que l'auteur | DÉPLOYÉ |
| Annuler un mouvement validé (contre-mouvement) | écriture `fuel` | DÉPLOYÉ |
| Valider en masse les mouvements d'une journée | écriture `fuel` | MANQUANT |
| Exporter CSV (pleins, registre, analyse) | lecture `fuel` | DÉPLOYÉ |
| Imprimer un bon de réception | lecture | MANQUANT |
| Annuler une livraison ou un plein | écriture `fuel` + motif | MANQUANT |

## 10. Statuts et transitions

```
Mouvement : a_valider -> valide   (decider_mouvement_carburant, fuel, autre personne)
            a_valider -> rejete   (idem, motif)
            valide    -> [contre-mouvement 'annulation' a_valider] (annuler_mouvement_carburant, motif)
Inventaire : a_valider -> valide (ajustement = ecart, refuse si solde change) | rejete (motif)
Facture CBG : saisie -> conforme | a_examiner (controler_facture_carburant_cbg)
Cible facture CBG : a_examiner -> contestee -> regularisee (avoir CBG) ; aucune transition aujourd'hui
```

## 11. Workflows

1. Livraison CBG saisie (logisticien) -> réception mesurée sur le site -> entrée
   validée par une autre personne (séparation exigée sauf réglage contraire).
2. Distribution par fiche FC signée ou plein -> sortie de cuve à valider.
3. Inventaire périodique -> validation -> ajustement.
4. Facture CBG -> rattachement des livraisons -> contrôle -> écart signalé
   (vérification humaine, jamais corrigé automatiquement).
5. Cible : relance de la facture « à examiner » vers CBG, réclamation et
   avoir CBG (comme D-032 pour Neemba) : MANQUANT.
Délais et escalades (mouvement à valider depuis plus de 24 h) : MANQUANT ;
la boîte « Mes validations » (D-056) les liste.

## 12. Rôles et permissions

| Action | Module | Niveau | Périmètre |
|---|---|---|---|
| Lire | `fuel` | lecture | site du stockage / de la livraison (D-072, D-075) |
| Saisir livraison, réception, transfert, inventaire, plein | `fuel` | écriture | site |
| Valider / rejeter | `fuel` | écriture + autre personne | site |
| Lever la séparation saisie / décision | admin | réglage `carburant_validation_separee` | global |

Cible : distinguer un droit d'approbation carburant (`has_module_approve('fuel')`)
pour la validation, au lieu de la seule écriture.

## 13. Tables et relations

`livraisons_carburant_cbg` (site, volume, prix, montant calculé) ;
`factures_carburant_cbg` + `factures_carburant_cbg_livraisons` ;
`stockages_carburant` (code unique, type, site, capacité, seuil, actif) ;
`receptions_carburant` (livraison unique, stockage, mesuré, accepté, méthode,
motif) ; `inventaires_carburant` ; `mouvements_carburant` (append-only,
contraintes de type et de signe, `annule_mouvement_id` unique) ;
`fuel_transactions` (pleins, plus d'écriture directe) ; `fuel_stocks` en
lecture seule (D-041). RLS : lecture `fuel` + `site_permis` ; écriture des
mouvements par fonctions seulement.

## 14. Fonctions serveur et API

`enregistrer_livraison_cbg`, `enregistrer_facture_carburant_cbg`,
`controler_facture_carburant_cbg` (`20261112225739`) ;
`receptionner_livraison_cbg`, `transferer_carburant`,
`saisir_inventaire_carburant`, `decider_mouvement_carburant`,
`decider_inventaire_carburant` (`20261115090000`) ;
`annuler_mouvement_carburant`, `saisir_carburant` (`20261120100000`) ;
`saisir_plein` (`20261118210000`) ; `consommation_carburant` ;
`anomalies_carburant` ; `ingest_fuel_data` (Edge). Paramètres de chaque
appel vérifiés contre la dernière définition : conformes.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Mouvement ou inventaire à valider | titulaires écriture `fuel` sauf l'auteur | Mes validations (D-056) | DÉPLOYÉ (module 24) |
| Stock sous le seuil d'alerte | logisticien, exploitation | in-app | PARTIEL (affichage seul) |
| Facture CBG à examiner | chargé de contrats, comptable | in-app | MANQUANT |
| Livraison non réceptionnée après 48 h | logisticien | in-app | MANQUANT |

## 16. Documents et modèles d'impression

Bon de réception carburant, PV d'inventaire de cuve, lettre de contestation
de facture CBG : MANQUANT. Fiche carburant FC imprimable : DÉPLOYÉ (module
07, `Fiches/FicheImprimable.tsx`).

## 17. Exports et rapports

CSV : pleins du mois, registre des mouvements, analyse (DÉPLOYÉ). Bilan
carburant mensuel figé, export Excel natif, PDF serveur : MANQUANT.

## 18. Historique et audit

Mouvements et inventaires : auteur, décideur, horodatage, motif (DÉPLOYÉ).
Livraisons et factures CBG : auteur et date seulement, aucune correction
tracée (MANQUANT). Comparaison de versions : sans objet (append-only).

## 19. Tests

Existants : pgTAP 14 (fiches terrain, livraisons, contrôle facture), 16
(IoT carburant, anomalies), 25 (registre carburant), 45 (plein), 52
(correctifs carburant et sites), 58 (périmètre des lectures) ; unitaire
`src/components/Fuel/stocks.test.ts` ; E2E `stocks-carburant.spec.ts` (2),
`analyses.spec.ts` (analyse, anomalies, plein).
Manquants : E2E « Livraisons et factures CBG » (saisie, contrôle conforme et
écart) ; E2E avec un profil non administrateur borné à un site ; parcours J2
de bout en bout contre une vraie base (recette, D-069 point 3).

## 20. Critères de recette métier

Scénario J2 carburant, rejoué par le logisticien et le chargé de contrats sur
une semaine réelle : (1) inventaire d'ouverture de chaque cuve validé ; (2)
chaque bon CBG saisi avec son prix ; (3) réception mesurée, écart motivé ;
(4) fiches FC saisies et validées ; (5) inventaire de fin de semaine, écart
chiffré ; (6) facture CBG contrôlée : écart nul ou expliqué ; (7) coût par
engin et L/t de la semaine cohérents avec le stock. PV signé : aucun.

## Points à trancher par le propriétaire

1. Prix au litre CBG : HT ou TTC, et taux de taxe éventuel (aujourd'hui non
   précisé, devise GNF implicite).
2. Nouvelle réception d'une livraison CBG après annulation de la première
   (D-072, limite R1-11).
3. Validation des pleins sans cuve (aujourd'hui aucune).
4. Valorisation par stockage (CMP par cuve) ou maintien du prix moyen de la
   période (D-034, limite D-041).
5. Fréquence d'inventaire obligatoire par cuve.

## Défauts bloquants constatés

Aucun. Écritures vérifiées : `stockages_carburant` (insert,
`StocksCarburantView.tsx:102`) envoie des colonnes existantes et accordées
(`20261115090000` l.161), site exigé par le bouton (l.148) donc jamais `''` ;
les dix appels de fonctions serveur correspondent aux signatures en vigueur ;
les sélecteurs vides (site, livraison, stockage) désactivent l'enregistrement.

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Correction tracée d'une livraison et d'une facture CBG (annulation motivée, nouvelle saisie) ; annulation d'un plein | M | décision point 2 |
| 2 | Modification et désactivation d'un stockage (capacité, seuil, actif) avec journal | S | - |
| 3 | Rattacher livraisons et factures à la fiche fournisseur CBG et au contrat (module 15, 19) ; taux de taxe et HT/TTC | M | point 1 ; fiche CBG saisie |
| 4 | Import CSV des livraisons et de la facture CBG (ImportWizard) | M | composant commun ImportWizard |
| 5 | Pièces jointes des bons et tickets de jauge | M | lot D (stockage de fichiers, accord propriétaire) |
| 6 | Bilan carburant mensuel figé par site (livré, reçu, distribué, stock, écarts, coût) | M | `figer_rapport` (D-058) |
| 7 | Contestation de facture CBG, avoir CBG, suivi jusqu'à régularisation | M | patron D-032 |
| 8 | Valorisation CMP par stockage | M | point 4 |
| 9 | Fiches détaillées stockage et livraison, validation en masse, alertes notifiées | M | DetailDrawer, BulkActionBar, notifications |
| 10 | Référentiel des produits carburant | S | - |
| 11 | E2E livraisons CBG et parcours J2 contre une vraie base | S | conteneur de rejeu |
