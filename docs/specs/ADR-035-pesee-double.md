# ADR-035 — Conservation et rapprochement de la double pesée

- **Statut :** implémentée et vérifiée localement ; à valider en revue de PR avant déploiement
- **Date :** 2026-11-12
- **Contexte :** après chargement, l'agent Kogon et CBG relèvent chacun un tonnage. Les deux valeurs doivent rester liées au même voyage, à la fiche FR et au ticket de pesée ; la facturation client attend leur confrontation.

## Options étudiées

1. **Ajouter deux colonnes à `trips`** : lecture simple, mais mélange les relevés opérationnels avec l'état courant du voyage et conserve mal les preuves source.
2. **Garder les valeurs uniquement dans `trip_events.donnees`** : pas de table supplémentaire, mais les contrôles, contraintes d'unicité et lectures de réconciliation dépendent d'un JSON peu typé.
3. **Créer une preuve relationnelle liée au voyage, à la fiche et au ticket** : retenue pour imposer les deux valeurs positives, l'unicité du ticket et le lien au document terrain, puis copier les deux poids dans l'instantané de réconciliation.

## Décision proposée

Conserver une ligne de double pesée par voyage dans `pesees_doubles`. Le poids Kogon est calculé par brut moins tare ; le poids net CBG est saisi séparément. Les deux valeurs sont enregistrées lors de la pesée au départ, après chargement, dans la saisie de la fiche FR. La ligne de réconciliation copie ces deux mesures.

La tolérance déjà saisie à l'ouverture de la réconciliation s'applique à l'écart relatif `abs(Kogon - CBG) / Kogon × 100`. Une double pesée absente ou hors tolérance produit une anomalie bloquante ; la clôture et la facturation attendent une décision humaine motivée. La base de tonnage contractuelle existante (chargé, reçu ou accepté) continue de déterminer la quantité facturée après cette décision.

## Conséquences et limites

- Les voyages historiques sans deux lectures portent l'anomalie `sans_double_pesee` lors d'une nouvelle réconciliation ; ils demandent une décision humaine avant clôture.
- Une ligne de double pesée est protégée contre l'écriture directe par les droits PostgreSQL et créée dans la transaction de saisie de la fiche.
- La correction d'une erreur de pesée après enregistrement n'est pas incluse dans cette tranche ; elle doit passer par une procédure de correction auditée avant usage en production.
- Les tickets existants restent soumis au contrôle d'unicité dans le journal des voyages.

## Vérification

Les tests pgTAP couvrent l'enregistrement atomique, le lien à la fiche, les deux valeurs, l'écart hors tolérance et le blocage d'une pesée absente. La preuve de rejeu local et l'état de production restent à consigner séparément ; cette proposition ne déploie rien.
