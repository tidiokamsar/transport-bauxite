# ADR-037 — Intégration et rectification des tickets de pesée CBG

- **Statut :** accepté ; implémentation intégrée à main (PR #45, D-034 + D-037), non déployée à ce jour
- **Date :** 2026-11-12
- **Remplace :** D-035 pour le flux de saisie de pesée
- **Contexte :** le prompt opérationnel du 2026-11-12 précise que CBG effectue la pesée au pont-bascule du dépôt et transmet ticket/rapport. Kogon l'intègre au voyage et contrôle sa cohérence. Kogon ne réalise pas une deuxième pesée pour reproduire celle de CBG.

## Options étudiées

1. **Deux pesées au départ, une par Kogon et une par CBG.** Rejetée : ne correspond pas au flux CBG décrit et compare des lectures qui peuvent provenir de moments/ponts différents.
2. **Ticket/mesure émise par CBG, intégré et rapproché par Kogon, avec preuve rectificative append-only.** Retenue : une seule mesure source CBG, le document et sa provenance restent attachés au voyage; les anomalies donnent lieu à une décision humaine.
3. **Conserver le flux existant de poids au départ et reporter l'intégration CBG.** Rejetée : laisse l'exigence opérationnelle de ticket CBG sans réponse et maintient une règle contradictoire.

## Décision

Le poids provenant de la pesée CBG constitue la preuve de pesée importée/saisie, accompagnée du numéro de ticket, date/heure, immatriculation, dépôt, poids brut/tare/net disponibles, source du document et auteur de saisie Kogon. Le système ne demande pas à Kogon de refaire la mesure physique. Il rapproche le ticket avec un voyage et signale les doublons, les voyages sans ticket, les incohérences d'immatriculation/dépôt, le poids impossible, le ticket annulé et les écarts à la base de tonnage contractuelle.

La décision de rapprochement est effectuée par une personne habilitée. Un ticket corrigé n'écrase pas la pièce ou la valeur d'origine : un événement rectificatif lié conserve l'ancienne et la nouvelle valeur, le motif, l'auteur, l'heure d'enregistrement et la référence au document/événement remplacé. Les opérations de facturation lisent la version en vigueur selon la chaîne d'audit et restent bloquées tant qu'une anomalie bloquante n'a pas reçu de décision motivée.

Les imports CSV/Excel/PDF, l'OCR, les interfaces directes de pont-bascule et le stockage pièce jointe sont hors du premier lot. La première version peut accepter un ticket saisi manuellement et une référence de document si le fichier n'est pas encore pris en charge; elle doit l'identifier comme saisie manuelle et ne doit pas prétendre avoir importé ou vérifié le document original.

## Conséquences

- D-035 et la branche PR #45 qui exigent une double mesure au départ doivent être corrigés avant intégration.
- Une table relationnelle de ticket/preuve et un journal append-only sont préférables aux valeurs JSON seules; une transaction serveur lie ticket, voyage et fiche.
- Les droits de saisie, rapprochement, décision et rectification doivent être vérifiés côté serveur; l'auteur ne s'auto-valide pas une correction sensible.
- Les migrations ne suppriment ni ne réécrivent les anciennes lectures. Les voyages historiques sans ticket deviennent « à rapprocher » plutôt qu'ils ne reçoivent un poids inventé.
- La facture utilise la quantité contractuellement admissible après traitement des anomalies, pas automatiquement la dernière valeur saisie.

## Vérification attendue

pgTAP : droits et isolation, ticket dupliqué, mauvaise immatriculation/dépôt, poids incohérent, fichier/référence source, décision bloquante, rectification liée sans mutation de la preuve initiale, refus d'auto-validation. E2E : saisie ticket CBG au dépôt, rattachement à la rotation, anomalie, décision, impression/lecture de l'historique. Recette métier sur environnement isolé avant déploiement.
