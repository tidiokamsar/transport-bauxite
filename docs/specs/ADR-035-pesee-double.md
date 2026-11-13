# ADR-035 — Conservation et rapprochement de la double pesée

- **Statut :** remplacée par D-037 le 2026-11-12 ; conservée comme historique de décision
- **Date :** 2026-11-12
- **Contexte :** après chargement, l'agent Kogon et CBG relèvent chacun un tonnage. Les deux valeurs doivent rester liées au même voyage, à la fiche FR et au ticket de pesée ; la facturation client attend leur confrontation.

## Options étudiées

1. **Ajouter deux colonnes à `trips`** : lecture simple, mais mélange les relevés opérationnels avec l'état courant du voyage et conserve mal les preuves source.
2. **Garder les valeurs uniquement dans `trip_events.donnees`** : pas de table supplémentaire, mais les contrôles, contraintes d'unicité et lectures de réconciliation dépendent d'un JSON peu typé.
3. **Créer une preuve relationnelle liée au voyage, à la fiche et au ticket** : retenue pour imposer les deux valeurs positives, l'unicité du ticket et le lien au document terrain, puis copier les deux poids dans l'instantané de réconciliation.

## Décision initiale (remplacée)

La décision D-035 proposait une ligne de double pesée par voyage dans `pesees_doubles`, avec une pesée Kogon et CBG au départ. Le prompt maître SIGTB du 2026-11-12 a précisé que CBG pèse au dépôt de destination et que Kogon intègre le ticket sans refaire la pesée. D-037 remplace donc ce parcours : voir [ADR-037](ADR-037-integration-ticket-pesee-cbg.md).

Les sections ci-dessous décrivent la proposition historique D-035 et ne constituent plus l'état cible.

## Conséquences et limites

- Les voyages historiques sans deux lectures portent l'anomalie `sans_double_pesee` lors d'une nouvelle réconciliation ; ils demandent une décision humaine avant clôture.
- Une ligne de double pesée est protégée contre l'écriture directe par les droits PostgreSQL et créée dans la transaction de saisie de la fiche.
- La correction d'une erreur de pesée après enregistrement n'est pas incluse dans cette tranche ; elle doit passer par une procédure de correction auditée avant usage en production.
- Les tickets existants restent soumis au contrôle d'unicité dans le journal des voyages.

## Vérification

Les tests pgTAP couvrent l'enregistrement atomique, le lien à la fiche, les deux valeurs, l'écart hors tolérance et le blocage d'une pesée absente. La preuve de rejeu local et l'état de production restent à consigner séparément ; cette proposition ne déploie rien.
