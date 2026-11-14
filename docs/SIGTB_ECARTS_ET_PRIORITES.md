# SIGTB — écarts et priorités

**Périmètre :** prompt maître, CDC 2.0, `main`/`921d583` et branche D-034/D-035 `d807159` (PR #45 non intégrée). État au 2026-11-12.

## Bloqueurs

| Classe | Écart constaté | Impact | Condition de sortie |
|---|---|---|---|
| BLOCKING | Pesée D-035 candidate au départ; prompt métier: poids/ticket CBG au dépôt, Kogon n'effectue pas une deuxième pesée | Donnée prise au mauvais moment, comparaison et facture potentiellement erronées | Nouvelle décision métier, ticket CBG source, revue humaine, correction rectificative auditée, tests et recette |
| BLOCKING avant multi-site | RLS par rôle/module sans scope ligne par organisation/site | Accès intersite possible via PostgREST/RPC | LOT 02: scopes et tests RLS/RPC intersites sur toutes tables métier |
| BLOCKING avant carburant réel | Solde carburant modifiable; pas de chaîne complète réception/acceptation/transfert/inventaire/approbation | Pertes ou facture non vérifiables | Ledger append-only, opérations serveur atomiques et séparation d'approbation |
| BLOCKING avant paiement au km | Contrôle D-033 exploite `km_start/km_end`, sans parcours opérationnel de relevé et validation | Quantité facturable sans preuve terrain | LOT odomètre, segments, validation contractuelle et provenance |
| BLOCKING avant usage offline | Identifiant local et replay générique sans idempotence serveur | Doublons; attente locale prise pour acceptation serveur | API sync idempotente, acquittement serveur et état « en attente » |

## Ordre des lots

| Priorité | Travail | Dépendances |
|---|---|---|
| P0 | Aligner D-035 et PR #45 avec le processus réel de pesée CBG | Confirmation de la sémantique Kogon; décision/ADR |
| P0 | D-034: devise issue des pièces, séparation saisie/contrôle, valorisation avec dimension site/produit | Règles fournisseur/facture |
| P1 | Scopes organisation/site, RLS et RPC | Identités, sites et responsabilités |
| P1 | Relevés odomètre et kilomètres facturables | Règles du contrat, procédure terrain |
| P1 | Authentification MFA/AAL pour signatures, droits et contrôles | Configuration Auth et politique de profils |
| P1 | IoT: type/route/véhicule, limites, rotation secrets, anti-rejeu et quota | Registre d'appareils réels |
| P2 | Ledger carburant réception/transfert/distribution/inventaire/variance | Processus de mesure et approbation |
| P2 | Référentiels transporteurs/propriété, véhicule, chauffeur, dépôt et pont-bascule | Documents de référence validés |
| P2 | Import et archivage sécurisé des documents CBG | Politique stockage/rétention |
| P2 | Instances de shift, passation et clôture journalière | Rôles de supervision |
| P3 | Mobile offline résilient et Control Tower complète | API/synchro et données de qualité |
| P3 | Pilote, charge, restauration et déploiement industriel | Lots métier validés |

## Dette transversale et limites

- Baseline: 37 erreurs TypeScript et 165 avertissements lint. Les réduire sans augmenter les seuils.
- Checks GitHub de la PR #45 : échec sans étapes exécutées; aucun CI distant vert.
- Toute fonction privilégiée doit vérifier rôle et périmètre sur le serveur, pas uniquement l'interface.
- L'existence de données de démonstration en production est mentionnée dans le dossier d'hébergement; toute transition vers données réelles doit suivre la procédure de purge autorisée et être documentée.
- Aucune preuve à date de test de restauration récent, de test de charge, ou de pilote réel.

## Informations à garder configurables

Devise et quantité acceptée sur justificatif CBG; sites/dépôts/transporteurs/véhicules vérifiés; tolérance de pesée; règle de correction et de clôture d'un ticket contesté; méthode de relevé et de facturation des segments kilométriques; matériel de mesure carburant; capacité et disponibilité des dépôts. Inconnu signifie « à confirmer » ou « non mesurable », jamais une valeur par défaut inventée.
