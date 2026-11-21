# MASTER PROMPT — TRANSFORMATION TRANSVERSALE DE SIGTB

## KOGON MINING SARL — Chaîne intégrée Transport, Pesée, Production, Maintenance et Finance

Source : plan transmis par le propriétaire le 2026-11-20. Ce document est la référence des lots 0 à 9 de la transformation intégrée. Les plans `SIGTB_PLAN_TRANSFORMATION.md` et `SIGTB_MASTER_EXECUTION_PLAN.md` restent des documents historiques.

### 1. MISSION

Tu interviens sur le dépôt existant de SIGTB.

Ta mission consiste à faire évoluer SIGTB vers une véritable plateforme intégrée de gestion et de pilotage des opérations de KOGON MINING SARL.

Il ne s'agit pas de développer une nouvelle application de pesée ni d'ajouter des modules indépendants.

Il faut améliorer l'architecture fonctionnelle existante pour garantir la continuité des opérations entre :

- La gestion du parc automobile et des équipements.
- La planification de la production.
- L'organisation des shifts.
- Le dispatch des véhicules.
- Les rotations de transport.
- Les pesées réalisées par CBG.
- Le rapprochement et la validation des tonnages.
- La consolidation de la production.
- La maintenance des équipements.
- La gestion du carburant.
- La gestion des pneumatiques.
- Les contrats et engagements.
- Les achats et les stocks.
- La facturation et les opérations financières.
- Le reporting et le Command Center.

L'objectif est de supprimer les ruptures entre les modules et de permettre à chaque opération de transmettre automatiquement ses informations aux processus qui en dépendent.

### 2. RÈGLE ARCHITECTURALE FONDAMENTALE

NE PAS CRÉER UN NOUVEAU MODULE MÉTIER CENTRAL.

Tu dois travailler à partir des modules existants.

Avant de créer une table, un service, une API, un écran, un workflow ou une fonctionnalité, examiner les structures existantes et démontrer pourquoi elles ne peuvent pas être réutilisées ou étendues.

Respecter les principes suivants :

- Une seule source de vérité pour chaque donnée.
- Un module propriétaire pour chaque domaine fonctionnel.
- Une seule opération métier de référence.
- Des relations explicites entre les modules.
- Pas de duplication de données métier.
- Pas de calculs financiers ou opérationnels contradictoires.
- Pas de tableaux de bord alimentés par des données fictives.
- Pas de boutons ou fonctionnalités sans comportement réel.

Les services techniques mutualisés sont autorisés pour les calculs, validations, permissions, notifications, synchronisations et traitements communs, mais ils ne doivent pas devenir des modules métier parallèles.

### 3. PHASE 1 — AUDIT COMPLET DU SYSTÈME

Avant de modifier le code, effectuer un audit du dépôt.

Examiner :

- Architecture frontend et backend.
- Modules et routes.
- Composants et écrans.
- Tables et relations de la base de données.
- Migrations existantes.
- API et fonction serveur.
- Services métier.
- Authentification et autorisations.
- Workflows et notifications.
- Journalisation et audit.
- Données de démonstration.
- Tests existants.
- Intégrations externes.
- Fonctionnalités déjà opérationnelles.
- Fonctionnalités incomplètes ou défectueuses.

Produire une matrice :

| Fonctionnalité | Module propriétaire | Existant | État réel | Dépendances | Action |
|---|---|---|---|---|---|
| Gestion des tares | Flotte | À vérifier | À auditer | Rotations | Réutiliser ou compléter |
| Affectation camion | Dispatch | À vérifier | À auditer | Flotte, Shifts | Réutiliser ou compléter |
| Gestion rotation | Rotations | À vérifier | À auditer | Dispatch | Réutiliser ou compléter |
| Ticket CBG | Pesée CBG | À vérifier | À auditer | Rotations | Réutiliser ou compléter |
| Calcul tonnage net | Pesée CBG / processus existant | À vérifier | À auditer | Flotte, CBG | Compléter |
| Consolidation production | Production | À vérifier | À auditer | Shifts, CBG | Compléter |
| Justificatifs financiers | Finance | À vérifier | À auditer | Contrats, Production | Compléter |

Ne pas inventer l'état d'avancement des fonctionnalités.

Distinguer clairement ce qui fonctionne réellement, ce qui existe partiellement et ce qui n'existe pas.

Livrer le diagnostic et le plan d'intervention avant les modifications structurelles.

### 4. PHASE 2 — CONSTRUCTION DE LA CHAÎNE OPÉRATIONNELLE

#### 4.1 Flotte

Renforcer le référentiel des véhicules et équipements.

Gérer :
- Immatriculation et identification.
- Propriétaire : KOGON ou Neemba.
- Type et catégorie.
- Capacité maximale.
- Tare de référence.
- Historique versionné des tares.
- Configuration tracteur/remorque, si applicable.
- Disponibilité.
- Immobilisation.
- Documents et conformité.
- Historique d'exploitation.

Les informations de tare et de capacité doivent être accessibles aux rotations et au processus de rapprochement CBG.

Une modification de tare ne doit pas modifier rétroactivement les rotations validées.

#### 4.2 Planification et Shifts

Relier les objectifs de production aux ressources réellement disponibles.

Gérer :
- Objectifs par jour et shift.
- Sites et destinations.
- Équipes.
- Conducteurs.
- Véhicules disponibles.
- Capacités de transport.
- Objectifs de rotations.
- Objectifs de tonnage.
- Contraintes d'exploitation.

Afficher les ressources planifiées, affectées, indisponibles et réellement exploitées.

#### 4.3 Dispatch

Renforcer les contrôles avant affectation.

Vérifier :
- Disponibilité du camion.
- Disponibilité du conducteur.
- Habilitations.
- Contrat.
- Tare validée.
- Capacité renseignée.
- Documents applicables.
- Immobilisation.
- Affectation concurrente.

Les dérogations doivent être autorisées, justifiées et auditées.

#### 4.4 Rotations

Chaque rotation doit constituer un dossier opérationnel traçable.

Relier :
- Camion.
- Chauffeur.
- Shift.
- Site de chargement.
- Destination.
- Contrat.
- Affectation.
- Horaires et événements.
- Kilométrage.
- Incidents.
- Ticket CBG.
- Tonnage.
- État de validation.

Conserver les informations de tare et de configuration applicables à la date de la rotation.

Gérer les rotations incomplètes, annulées, interrompues, reprises et clôturées.

#### 4.5 Pesée CBG et rapprochement

CBG reste responsable de la pesée physique.

SIGTB reçoit les tickets et assure le contrôle administratif et opérationnel.

Le calcul de référence est :

TONNAGE NET = POIDS BRUT CBG - TARE APPLICABLE DU VÉHICULE.

Conserver :
- Les valeurs originales du ticket.
- La tare de référence.
- La tare éventuellement indiquée par CBG.
- Le poids net communiqué par CBG.
- Le poids net calculé par SIGTB.
- Les écarts.
- Le résultat du rapprochement.
- Le statut de validation.

Détecter les doublons, incohérences, tickets manquants, erreurs d'immatriculation, dépassements de capacité et litiges.

Aucune correction ne doit écraser silencieusement une donnée originale.

#### 4.6 Production

La production doit consommer les résultats validés des rotations et rapprochements.

Consolider :
- Tonnage par camion.
- Tonnage par chauffeur.
- Tonnage par shift.
- Tonnage par site.
- Tonnage par destination.
- Tonnage par contrat.
- Tonnage journalier, hebdomadaire et mensuel.

Comparer objectifs, déclarations, réalisations et tonnages acceptés.

Prévenir les doubles comptabilisations.

Distinguer les résultats provisoires des résultats officiellement validés.

### 5. PHASE 3 — INTÉGRATION DES MODULES SUPPORT

#### Maintenance et Neemba

Relier les équipements aux interventions, immobilisations, coûts et disponibilités.

Distinguer :
- Maintenance KOGON.
- Obligations de Neemba.
- Interventions du prestataire.
- Pannes.
- Immobilisations.
- Remises en service.
- Coûts et justificatifs.

Ne pas attribuer automatiquement une responsabilité contractuelle à Neemba ou KOGON sur la seule base d'une anomalie.

#### Carburant

Relier :
- Réceptions de carburant fourni par CBG.
- Quantités acceptées.
- Stock disponible.
- Distributions.
- Véhicules bénéficiaires.
- Consommations.
- Écarts.
- Justificatifs.

Calculer les consommations par rotation, kilomètre ou tonne lorsque les données sont suffisantes.

#### Pneumatiques

Suivre individuellement les pneus :
- Identification.
- Marque et dimensions.
- Affectation.
- Position.
- Montage et démontage.
- Permutation.
- Réparation.
- Usure.
- Réforme.
- Coût.
- Kilométrage.

Relier les coûts à la performance des véhicules.

#### Contrats

Gérer les versions contractuelles et leurs périodes d'effet.

Distinguer les bases de facturation :
- Kilomètres pour les camions selon le contrat.
- Heures productives pour les chargeuses et excavatrices selon le contrat.
- Tonnage uniquement si le contrat le prévoit expressément.

Ne jamais transformer automatiquement les tonnages en montants financiers.

#### Achats et stocks

Relier les demandes, validations, commandes, réceptions, entrées en stock, sorties et affectations aux équipements.

Garantir la traçabilité des pièces, consommables et pneumatiques.

#### Finance

Assurer la relation entre :
- Contrat.
- Opération réalisée.
- Décompte.
- Justificatif.
- Facture.
- Créance.
- Règlement.
- Rapprochement.

Chaque montant doit pouvoir être justifié par ses pièces et ses règles contractuelles.

### 6. PHASE 4 — TRAÇABILITÉ INTÉGRALE

Construire une chaîne de traçabilité consultable.

Depuis un indicateur financier ou de production, un utilisateur autorisé doit pouvoir retrouver :

- Le montant ou tonnage consolidé.
- Les opérations qui le composent.
- Les rotations concernées.
- Les véhicules.
- Les conducteurs.
- Les shifts.
- Les tickets CBG.
- Les données de tare.
- Les calculs.
- Les validations.
- Les corrections.
- Les pièces justificatives.
- Les règles contractuelles utilisées.

La traçabilité doit fonctionner dans les deux sens : depuis l'opération vers les indicateurs et depuis les indicateurs vers les pièces justificatives.

Prévoir une gestion des versions des règles et des données applicables.

### 7. PHASE 5 — COMMAND CENTER ET PILOTAGE

Faire évoluer le Command Center pour devenir une véritable interface de pilotage de l'exploitation.

Prévoir des vues consolidées :

- Situation opérationnelle en temps réel, lorsque les données le permettent.
- Véhicules disponibles et immobilisés.
- Rotations en cours.
- Rotations terminées.
- Tickets CBG en attente.
- Anomalies.
- Tonnage provisoire et validé.
- Objectifs et réalisations.
- Performance par shift.
- Disponibilité des équipements.
- Consommation de carburant.
- Coûts de maintenance.
- Situation contractuelle.
- Situation financière.
- Alertes et actions en attente.

Chaque KPI doit avoir une formule documentée, une source, une unité, une période et une définition de son niveau de fiabilité.

Les indicateurs doivent permettre d'accéder aux données détaillées qui les composent.

### 8. PHASE 6 — WORKFLOWS ET RESPONSABILITÉS

Harmoniser les workflows entre modules.

Prévoir les responsabilités distinctes de :
- Saisie.
- Contrôle.
- Validation.
- Approbation.
- Clôture.
- Correction.
- Consultation.

Les permissions doivent être vérifiées côté serveur.

Les utilisateurs ne doivent pas pouvoir valider leurs propres opérations lorsque la séparation des responsabilités l'interdit.

Toute dérogation doit être justifiée et auditée.

### 9. PHASE 7 — FIABILITÉ TECHNIQUE

Garantir :
- Transactions atomiques.
- Idempotence.
- Protection contre les doubles soumissions.
- Historisation des données sensibles.
- Contrôle des accès.
- Gestion des erreurs.
- Sauvegardes et restauration.
- Gestion des imports.
- Gestion des conflits de synchronisation.
- Tests automatisés.
- Performance des requêtes.
- Cohérence des données.

Pour les opérations hors ligne, définir précisément les opérations autorisées, les identifiants uniques, les règles de synchronisation et la résolution des conflits.

Ne jamais présenter une opération hors ligne comme validée définitivement tant que sa validation serveur n'a pas été confirmée.

### 10. PHASE 8 — MÉTHODE D'EXÉCUTION

Travailler par lots fonctionnels, sans perdre la cohérence globale.

LOT 0 — Audit, architecture, sécurité et cartographie des dépendances.

LOT 1 — Référentiels Flotte, chauffeurs, contrats et configurations.

LOT 2 — Planification, Shifts et Dispatch.

LOT 3 — Rotations, événements, kilométrage et incidents.

LOT 4 — Pesée CBG, tare, tonnage net et rapprochement.

LOT 5 — Production, clôtures et consolidation.

LOT 6 — Maintenance, Neemba, carburant et pneumatiques.

LOT 7 — Contrats, achats, stocks et Finance.

LOT 8 — Reporting, Command Center et traçabilité.

LOT 9 — Tests transversaux, sécurité, performance et documentation.

Les lots ne sont pas des applications séparées. Ils doivent respecter un modèle de données et une architecture fonctionnelle communs.

Avant de commencer chaque lot :
- Vérifier les dépendances.
- Identifier les fonctionnalités réutilisables.
- Établir les critères d'acceptation.
- Préparer les migrations compatibles.
- Identifier les risques de régression.

Après chaque lot :
- Exécuter les tests.
- Contrôler les données.
- Vérifier les permissions.
- Vérifier les modules consommateurs.
- Documenter les modifications.

### 11. SCÉNARIOS DE VALIDATION DE BOUT EN BOUT

Tu dois démontrer les scénarios suivants avec des données de test cohérentes.

SCÉNARIO A — Transport et production :

Fiche camion → tare validée → planification → shift → dispatch → rotation → ticket CBG → calcul net → rapprochement → validation → production → reporting.

SCÉNARIO B — Anomalie de pesée :

Rotation → ticket incohérent → détection → affectation du traitement → correction justifiée → nouvelle validation → mise à jour contrôlée de la production.

SCÉNARIO C — Maintenance :

Camion → panne → immobilisation → intervention Neemba ou KOGON → validation de la remise en service → disponibilité dans le Dispatch.

SCÉNARIO D — Carburant :

Réception CBG → acceptation → stock → distribution au camion → consommation → rapprochement → indicateurs de performance.

SCÉNARIO E — Pneumatiques :

Réception → entrée en stock → affectation → utilisation → permutation → réparation → réforme → coût par véhicule.

SCÉNARIO F — Finance :

Contrat → prestation réalisée → données opérationnelles validées → calcul selon la règle contractuelle → justificatif → facture ou décompte → créance → règlement.

SCÉNARIO G — Traçabilité :

Indicateur de production ou financier → détail des opérations → rotations → tickets et justificatifs sources.

### 12. CRITÈRES DE FIN DE MISSION

La mission n'est terminée que lorsque :

- Les modules concernés communiquent réellement.
- Les données ne sont pas dupliquées.
- Les calculs sont cohérents.
- Les validations fonctionnent.
- Les permissions sont effectives côté serveur.
- Les workflows sont opérationnels.
- Les indicateurs utilisent des données vérifiables.
- Les corrections sont traçables.
- Les tests de bout en bout passent.
- La documentation est actualisée.
- Les fonctionnalités existantes conformes sont préservées.

Produire un rapport final indiquant :
- Ce qui existait initialement.
- Ce qui a été amélioré.
- Ce qui a été créé parce que réellement nécessaire.
- Les tables et migrations concernées.
- Les API et composants modifiés.
- Les tests réalisés et résultats.
- Les fonctionnalités restantes.
- Les risques résiduels.

### 13. AUTONOMIE ET PROTECTION DE LA PRODUCTION

Tu peux organiser le travail en agents spécialisés : architecture, backend, frontend, base de données, tests, sécurité et documentation.

Chaque agent doit travailler dans le cadre d'une architecture commune et ne pas créer de fonctionnalités concurrentes.

Tu dois poursuivre les lots de manière autonome, en vérifiant les résultats à chaque étape.

Ne jamais :
- Supprimer une fonctionnalité existante sans justification et autorisation.
- Écraser des données de production.
- Exécuter une migration destructive sans approbation.
- Déployer en production sans autorisation explicite.
- Déclarer une fonctionnalité terminée sur la base d'une simple compilation.
- Utiliser des données fictives pour prétendre qu'une intégration réelle fonctionne.

La priorité est de rendre SIGTB cohérent, fiable, opérationnel et vérifiable de bout en bout.
