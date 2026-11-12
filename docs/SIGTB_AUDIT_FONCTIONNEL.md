# SIGTB — audit fonctionnel par flux métier

**État examiné :** `main` au commit `921d583`, plus la branche D-034/D-035 `d807159` (PR #45 ouverte, non intégrée). Le prompt maître fourni le 2026-11-12 est la cible; l'existence d'une page n'est pas une preuve de fonctionnement.

## Résultat

Les parcours de planification, affectation, fiches terrain, facturation et immobilisations ont un noyau serveur et des tests. Ils restent partiels face au processus opérationnel décrit : cloisonnement par site, relevés kilométriques mesurés, ingestion des tickets CBG, chaîne de stock carburant et recette terrain ne sont pas démontrés. Les tests automatisés de la branche ne remplacent pas la validation par les agents Kogon/CBG.

## Matrice des domaines

| Domaine | Existant vérifié | Limite prioritaire | Statut prompt |
|---|---|---|---|
| Utilisateurs | Rôles, droits par module et exceptions par utilisateur sur `main` | MFA et scopes organisation/site non présents | EN COURS |
| Flotte / chauffeurs / partenaires | Véhicules et immobilisations; contrats et tarifs d'engins | Transporteurs, propriété, combinaison tracteur/remorque, dossiers techniques incomplets | EN COURS |
| Planification | Objectifs par date/site/shift, statistiques historiques | Modèle ne tient pas compte des dépôts, distance, file, carburant et scénarios de rattrapage | EN COURS |
| Dispatch | Recommandation déterministe, décision humaine historisée, contrôles serveur | Pas de données réelles de distance, capacité/file dépôt ou disponibilité des dépôts | EN COURS |
| Rotations | Cycle à 18 états, journal d'événements, fiches terrain | Relevés compteur/segments absents du parcours; recette de réaffectation directe non fournie | EN COURS |
| Pesée CBG | Main : poids/journal historiques; branche PR #45 : double mesure au départ | Contradiction avec le prompt, qui décrit la pesée par CBG au dépôt sans seconde pesée Kogon | À ARBITRER — BLOQUANT |
| Kilométrage | Contrôle D-033 lit `km_start/km_end` de `trips` | Pas de parcours saisie/validation de compteur; distance référence, mesurée et facturable non séparées | EN COURS |
| Carburant | Écrans de pleins, cuves, analyses; branche D-034 ajoute livraisons et facture | Pas de reçu/accepté, transfert citerne, inventaire, écart, séparation d'approbation | EN COURS |
| Finance | Facture client signée par directeur, avoirs et recouvrement; contrôle facture Neemba | Contrôle après paiement et coût fiable par tonne en attente | EN COURS |
| Maintenance | Immobilisations journalisées et blocage disponibilité | Ordres d'entretien et liens pièces/coûts partiels | EN COURS |
| Documents | Fiches terrain imprimables et références de ticket | Pas d'import CBG multi-format ni d'archivage sécurisé de la pièce source démontré | PARTIEL |
| Mobile / hors ligne | Indicateur et file générique dans le code | Pas d'app Expo/SQLite; file générique sans acquittement idempotent | NON COMMENCÉ |
| Control Tower | Production et vues de poste | Source, fraîcheur, fiabilité, coût et stock fiables incomplets | EN COURS |
| Intelligence | Recommandations déterministes et analyses de données disponibles | OR-Tools, prédiction dépôt/carburant et recommandations avec confiance non implémentés | EN COURS |

## Constats prioritaires

### BLOCKING — Pesée CBG incohérente avec le prompt

**Preuve :** le prompt §12 demande à Kogon d'intégrer le ticket CBG et interdit une seconde pesée reproduisant CBG. La migration de branche `supabase/migrations/20261112231927_pesee_double_avant_facturation.sql:79-92` stocke deux valeurs lors de `WEIGHED_OUT`, et exige une fiche de pesée au départ. Le D-035 précédent décrit le même flux au départ.

**Impact :** saisie à une étape opérationnelle différente du ticket CBG et risque de comparaison/facturation incohérente.

**Suite :** D-037, consignée pendant l'audit selon le prompt du 2026-11-12, remplace D-035 : ticket CBG au dépôt, intégration/rapprochement Kogon, pas de nouvelle pesée Kogon. Il reste à réaliser la migration et l'interface, avec correction rectificative immuable.

### MAJOR — Kilométrage facture sans preuve terrain

**Preuve :** `supabase/migrations/20261112100000_facturation_par_engin.sql:124-128` agrège `km_end-km_start`; le parcours de fiche voyage ne recueille pas ces relevés. Le prompt demande une distinction entre distance de référence, mesurée et validée/facturable.

**Impact :** contrôle au km peut rester vide ou utiliser une valeur non prouvée; tarif de contrat seul ne suffit pas à établir la distance due.

**Suite :** relevés compteur append-only (auteur, heure, source), calcul contrôlé, segments (chargé, à vide, repositionnement, hors production), décision selon contrat et tests.

### MAJOR — Chaîne carburant non comptabilisée de bout en bout

**Preuve :** l'écran historique permet de modifier/supprimer le solde; D-034 candidate couvre livraison/facture mais pas quantité physique acceptée, transfert, inventaire ni approbation séparée. L'analyse pondérée candidate ne distingue pas le site du plein et de la livraison.

**Impact :** coût/allocation et stock ne sont pas suffisamment fiables pour paiement ou analyse de perte.

**Suite :** ledger par site/produit/devise avec réception, acceptation, transfert, distribution, inventaire et approbation distincte.

### MAJOR — Recette opérationnelle non établie

**Preuve :** les 44 E2E exécutés sur branche utilisent l'API simulée; aucune recette terrain signée n'est jointe. Les scénarios prompt dépôt fermé, longue attente, mauvaise immatriculation, ticket en double, lecture compteur fautive et réception carburant partielle ne sont pas tous couverts par des scénarios métier vérifiés.

**Impact :** les tests prouvent seulement les cas automatisés; ils ne valident pas les procédures terrain ni l'acceptation des acteurs.

**Suite :** recette AT avec rôles réels et tickets expurgés sur un environnement de préproduction isolé; procès-verbal par scénario.

## Échelle de statut

- **Développé :** code sur une branche.
- **Testé :** résultat d'automatisation observé.
- **Validé :** scénario métier rejoué et PV accepté.
- **Déployé :** migration/version constatée sur le serveur cible et contrôles post-déploiement.
- **Utilisable en exploitation :** rôles, données, procédures et formation disponibles avec validation terrain.

D-034/D-035 : développé sur branche et testé localement; PR ouverte, non fusionnée; pas de PV métier ni preuve de déploiement.
