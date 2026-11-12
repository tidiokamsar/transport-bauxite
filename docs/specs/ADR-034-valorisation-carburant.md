# ADR-034 — Valorisation des distributions de carburant CBG

- **Statut :** implémentée et vérifiée localement ; à valider en revue de PR avant déploiement
- **Date :** 2026-11-12
- **Contexte :** D-034 demande de valoriser les litres distribués pendant une période avec les prix des livraisons de cette période. Le prix change selon la livraison et ne peut pas être déduit lorsqu'aucune livraison n'est saisie.

## Options étudiées

1. **Dernier prix de livraison** : facile à expliquer, mais attribue le prix d'une seule livraison à tous les litres de la période et dépend de l'ordre des dates.
2. **FIFO par livraison** : suit les lots physiques, mais exige des stocks d'ouverture, mouvements de cuve et consommations par lot qui ne sont pas prévus dans D-034.
3. **Prix moyen pondéré de la période** : `somme(litres livrés × prix unitaire) / somme(litres livrés)` ; les coûts sont cohérents avec les prix et volumes réellement saisis dans cette période, sans inventer un prix manquant.

## Décision proposée

Utiliser le prix moyen pondéré des livraisons saisies dans la période sélectionnée pour valoriser les distributions de carburant de cette période. Si aucune livraison n'est enregistrée, afficher le coût comme indisponible. Conserver séparément les valeurs historiques déjà enregistrées sur les transactions ; le calcul de D-034 n'ajoute pas de prix aux anciennes lignes.

Le calcul ne constitue pas un suivi physique de stock par lot. Si Kogon Mining doit rapprocher les litres distribués avec un stock de cuve, les stocks d'ouverture et de clôture et les mouvements de transfert devront être cadrés dans une décision distincte.

## Conséquences

- Chaque livraison CBG porte son volume et son prix unitaire, saisis depuis le justificatif.
- La facture est rapprochée de la somme des livraisons qui lui sont rattachées ; tout écart reste à examiner par une personne.
- Les fiches de plein enregistrent les volumes sans prix unitaire. L'écran d'analyse applique la valorisation pondérée de la période.
- La devise saisie par l'écran est le GNF, conformément à l'unité financière principale affichée par SIGTB. À confirmer sur le justificatif CBG avant une première saisie réelle.

## Vérification

La migration ajoute des contrôles serveur et des politiques de lecture par droit du module carburant. Les assertions pgTAP associées vérifient le prix de livraison, le rapprochement conforme, le signalement d'un écart sans correction, l'unicité du rattachement et le calcul pondéré. L'exécution locale doit être consignée avec la PR ; aucune exécution sur la base de production n'est autorisée par cette proposition.
