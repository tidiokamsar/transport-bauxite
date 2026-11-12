# SIGTB — plan de transformation ordonné

**Références :** prompt maître du 2026-11-12, CDC 2.0, dépôt `main`/`921d583`, PR #45 et revues indépendantes code opérations, sécurité et carburant/finance. Ce plan ne promeut aucun statut sans preuve.

## Phase 0 — Audit initial

- Cartographie du code, schéma, procédures, tests, sécurité et documents de référence.
- Séparation de l'état `main`, de la branche D-034/D-035, des tests locaux, de CI, de production et de la recette métier.
- Livrables : [audit technique](SIGTB_AUDIT_TECHNIQUE.md), [audit fonctionnel](SIGTB_AUDIT_FONCTIONNEL.md), [écarts et priorités](SIGTB_ECARTS_ET_PRIORITES.md), présent plan.
- **État :** audit statique dépôt effectué; suite locale de la branche exécutée; production et recette terrain non inspectées.

## Lot 1 — Résoudre le flux de pesée (P0)

Comparer trois options : (A) deux pesées effectuées au départ — rejetée car incompatible avec le flux CBG du prompt; (B) pesée CBG au dépôt, intégration du ticket par Kogon, rapprochement/validation humaine et événements correctifs liés à la preuve originale — retenue dans D-037; (C) laisser D-035 au départ et reporter le processus du prompt — rejetée pour le mandat courant.

D-037 remplace D-035 : Kogon intègre le ticket/document CBG et le rapproche du voyage; il ne réalise pas une pesée additionnelle. Modèle candidat : ticket CBG et fichier source liés au voyage, provenance/auteur/horodatage, validation séparée; rectification append-only avec motif, anciennes/nouvelles valeurs, acteur et lien à l'événement remplacé. Ne jamais réécrire la preuve initiale.

## Lot 2 — Identité et périmètres (LOT 01/02)

- MFA/AAL sur administration, contrôles et signature; vérification côté serveur.
- Organisation/site dans le modèle d'accès, RLS et fonctions `SECURITY DEFINER`.
- Inventaire de chaque table métier et test négatif avec JWT d'un autre site.
- Conserver la matrice rôle-module et les droits utilisateurs D-036 comme niveau d'autorisation fonctionnelle.

## Lot 3 — Kilométrage mesuré et décomptes (LOT 07/12)

- Relevés d'odomètre append-only avec source, auteur, heure, valeurs initiale/finale et justificatif.
- Distinguer distance de référence, delta compteur mesuré, segment chargé/vide/repositionnement/atelier et quantité contractuellement acceptée.
- Afficher les écarts; décisions de validation motivées; aucun prix dû sans données et règle disponibles.
- Connecter D-033 uniquement à la quantité approuvée.

## Lot 4 — Carburant sous contrôle (LOT 10)

- Événements distincts: déclaration, réception physique, contrôle/acceptation, entrée stock, transfert citerne, distribution, inventaire, écart, décision d'approbation.
- Calcul de solde à partir du ledger; fonctions atomiques côté serveur et aucune mise à jour/suppression directe du solde.
- Séparer la saisie et le contrôle; valoriser par site/produit/devise/période après confirmation de la source.
- Lier les justificatifs d'origine et conserver la chaîne d'audit.

## Lot 5 — Référentiels et productivité (LOT 02/05/06/09)

- Référentiels organisation, site de chargement, dépôt, pont-bascule, transporteur, propriétaire/exploitant, véhicule et chauffeur.
- Plusieurs rotations et réaffectation directe au prochain site, sans retour obligatoire au dépôt Kogon.
- Dépôt « disponible », file et capacité affichés seulement si observés et datés; la recommandation expose hypothèses et limites.
- Gestion de tickets absents/doublons, mauvais véhicule/dépôt, changement de chauffeur et fermeture de site.

## Lot 6 — Opérations résilientes et pilotage (LOT 03/04/08/13/18)

- Shifts opérables avec responsable, équipe, passation et clôture.
- KPI indiquent période, source, fraîcheur et qualité.
- IoT non activé tant qu'un vrai matériel/protocole n'est pas qualifié; validation stricte des clés et mesures.
- Synchronisation offline idempotente et statut serveur visible; opérations non confirmées restent en attente.
- Pilote sur données synthétiques et pièces expurgées avant exploitation.

## Lot 7 — Industrialisation (LOT 19)

- Réduire réellement les 37 erreurs de type; ne pas augmenter la baseline.
- Rendre les contrôles distants opérants ou maintenir un CI alternative fiable, répétable et archivée.
- Tester scénarios recette, migration, RLS, E2E, performance, sauvegarde/restauration et rollback en préproduction.
- Procédures de travail et formation terrain; déploiement progressif, observation, retour arrière.
- Étiqueter « testé », « validé », « déployé » avec des preuves distinctes.

## Critère de sortie commun

Une PR par lot, décision/ADR pour tout changement transversal, migration relisible/non destructive, contrôle RLS et RPC, tests pertinents réussis, mise à jour `SIGTB_2.0_PROGRESS.md`, limites restantes, revue, PV métier lorsque requis, preuves de merge et de déploiement distinctes. Les données/charges financières réelles ne sont modifiées que selon la procédure de production autorisée.

## Prochaine action d'implémentation

Corriger la conception D-035 de la PR #45 selon le flux CBG, compléter les tests de ticket/document/rectification, puis réévaluer la PR et le blocage des checks distants. Le parcours compteur et le ledger carburant restent des lots séparés; ils ne doivent pas être présentés comme livrés par cette reprise.
