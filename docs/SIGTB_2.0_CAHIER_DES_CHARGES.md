> Document de reference contractuel. Version 2.0 recue le 2026-11-06.
> Remplace `docs/specs/CAHIER_DES_CHARGES.md` (auto-evaluation Bolt, archivee
> sous `docs/specs/CONFORMITE_DECLAREE_BOLT.md`). Ecarts avec le code :
> [SIGTB_2.0_PROGRESS.md](SIGTB_2.0_PROGRESS.md). Ne pas modifier sans
> decision consignee dans `docs/SIGTB_2.0_DECISIONS.md`.

# SIGTB 2.0
## CAHIER DES CHARGES GÉNÉRAL, FONCTIONNEL ET TECHNIQUE
### DARI HOLDING — ENTERPRISE MINING OPERATIONS PLATFORM

**Version :** 2.0 — Spécification consolidée  
**Périmètre :** Enterprise  
**Flotte :** Propre et sous-traitants  
**Priorité stratégique :** Production  
**Zone d'exploitation :** Guinée  
**Langue principale :** Français  
**Devise principale :** GNF

---

# PARTIE I — VISION ET OBJECTIFS

## 1. Présentation générale

SIGTB 2.0 est une plateforme intégrée de gestion, de supervision, de planification et d'optimisation des opérations de transport minier de DARI HOLDING.

Elle doit couvrir la totalité du cycle opérationnel, depuis la planification de la production jusqu'à la livraison effective de la bauxite, la réconciliation des tonnages, la facturation, le paiement et l'analyse de rentabilité.

SIGTB doit constituer le référentiel opérationnel central de l'entreprise.

Il ne doit pas être une simple application de suivi GPS ou de gestion administrative de camions.

Il doit permettre de comprendre, contrôler, anticiper et optimiser les opérations.

## 2. Objectifs stratégiques

Les objectifs sont :

1. Augmenter les tonnes effectivement livrées et acceptées.
2. Augmenter le nombre de rotations productives par camion.
3. Réduire les temps d'attente au chargement et au déchargement.
4. Améliorer l'utilisation des véhicules et des engins.
5. Optimiser les affectations et les itinéraires.
6. Réduire les consommations et coûts par tonne.
7. Réduire les immobilisations.
8. Améliorer la sécurité des opérations.
9. Contrôler les performances des sous-traitants.
10. Fiabiliser les pesées et les livraisons.
11. Assurer une traçabilité complète des mouvements de bauxite.
12. Améliorer la rentabilité de chaque site, contrat et activité.

La priorité de décision doit être la production acceptée, sous réserve des contraintes de sécurité, de qualité et de conformité.

## 3. Périmètre Enterprise

Le système doit gérer :

- Plusieurs sociétés et unités opérationnelles.
- Plusieurs sites miniers.
- Plusieurs zones d'extraction et de chargement.
- Plusieurs destinations.
- Plusieurs corridors de transport.
- Plusieurs transporteurs.
- Une flotte appartenant à DARI HOLDING.
- Une flotte appartenant aux sous-traitants.
- Plusieurs catégories de véhicules et d'engins.
- Plusieurs équipes et shifts.
- Plusieurs contrats et grilles tarifaires.

Chaque donnée doit être rattachée à son organisation, son site, son propriétaire et son périmètre d'accès lorsque cela est pertinent.

---

# PARTIE II — FONCTIONNALITÉS MÉTIER

## 4. Administration et gouvernance Enterprise

### 4.1 Organisation

Gérer :

- Sociétés.
- Filiales.
- Directions.
- Départements.
- Sites.
- Unités opérationnelles.
- Centres de coûts.
- Entrepôts.
- Ateliers.
- Stations carburant.

### 4.2 Gestion des utilisateurs

Créer les comptes, affecter les rôles, les sites autorisés et les permissions.

Prévoir :

- Activation et désactivation.
- Historique des connexions.
- Authentification renforcée pour les profils sensibles.
- Réinitialisation sécurisée.
- Journal des modifications.
- Gestion des sessions.

### 4.3 Gestion des permissions

Les droits doivent être combinés selon quatre dimensions :

- Rôle.
- Organisation.
- Site.
- Périmètre fonctionnel.

Un responsable d'un site ne doit pas accéder automatiquement aux données financières d'un autre site.

Un sous-traitant ne doit consulter que les informations autorisées de son entreprise.

Un auditeur peut consulter les preuves et journaux sans modifier les opérations.

## 5. Gestion des sites miniers

Créer un référentiel géographique et opérationnel.

Chaque site doit posséder :

- Identifiant.
- Nom.
- Code.
- Société responsable.
- Coordonnées.
- Zones d'exploitation.
- Fronts de chargement.
- Pistes.
- Destinations.
- Ponts-bascules.
- Stations carburant.
- Ateliers.
- Dépôts.
- Zones de sécurité.
- Capacités opérationnelles.

Les zones géographiques doivent être gérées avec PostGIS.

## 6. Production Planning

Ce module constitue le point de départ de chaque journée d'exploitation.

### 6.1 Planification

Définir :

- Objectif journalier.
- Objectif par shift.
- Objectif par site.
- Objectif par destination.
- Objectif par contrat.
- Objectif par transporteur.
- Objectif par type de matériau.
- Objectif par zone de chargement.

### 6.2 Calcul des ressources nécessaires

Le système doit calculer une estimation des ressources requises à partir :

- Du tonnage cible.
- De la capacité utile des camions.
- Du temps de cycle moyen.
- Du temps disponible.
- De la disponibilité mécanique.
- Des capacités de chargement.
- Des capacités de réception.
- Des contraintes de sécurité.

### 6.3 Suivi de réalisation

Comparer :

- Plan initial.
- Plan révisé.
- Réalisation actuelle.
- Prévision de fin de shift.
- Écart de production.
- Ressources manquantes.
- Causes de retard.

### 6.4 Scénarios de rattrapage

Proposer plusieurs options lorsque le plan est en retard :

- Réaffectation des camions.
- Changement de destination.
- Rééquilibrage des chargeuses.
- Modification des priorités.
- Activation de véhicules disponibles.
- Adaptation des rotations.

Chaque proposition doit afficher son impact estimé et ses hypothèses.

## 7. Shift Management

Gérer intégralement les postes de travail.

Chaque shift comprend :

- Site.
- Date.
- Heure de début.
- Heure de fin.
- Responsable.
- Équipe.
- Véhicules.
- Chauffeurs.
- Engins.
- Objectifs.
- Événements.
- Production.
- Incidents.
- Passation de consignes.

La clôture d'un shift doit produire un rapport comprenant les performances, écarts, immobilisations, anomalies et opérations en cours.

Prévoir les shifts configurables selon les organisations, y compris les postes de nuit.

## 8. SIGTB Command Center

Le Command Center est l'interface principale de supervision.

Il doit présenter :

### Production
- Tonnes planifiées.
- Tonnes chargées.
- Tonnes livrées.
- Tonnes acceptées.
- Objectifs atteints.
- Prévision de fin de shift.

### Flotte
- Véhicules disponibles.
- Véhicules affectés.
- Véhicules en transport.
- Véhicules en attente.
- Véhicules en maintenance.
- Véhicules immobilisés.

### Exploitation
- Voyages en cours.
- Temps moyen de cycle.
- Temps d'attente.
- Files de chargement.
- Files de réception.
- Goulots d'étranglement.

### Alertes
- Pannes.
- Incidents.
- Retards.
- Surcharges.
- Anomalies carburant.
- Sorties de géofence.
- Non-conformités.

### Décisions
- Recommandations de réaffectation.
- Risques de retard.
- Prévisions de production.
- Optimisation des destinations.
- Scénarios de rattrapage.

Chaque indicateur doit présenter sa période, sa source, son niveau de fiabilité et son heure de dernière actualisation.

## 9. Fleet Management

### 9.1 Référentiel véhicules

Chaque véhicule doit posséder :

- Identifiant interne.
- Immatriculation.
- Marque.
- Modèle.
- Type.
- Numéro de châssis.
- Capacité nominale.
- Capacité utile autorisée.
- Propriétaire.
- Exploitant.
- Transporteur.
- Site.
- Contrat.
- Compteur kilométrique.
- Heures moteur.
- État mécanique.
- Documents.
- Assurance.
- Historique.

### 9.2 Statuts

Prévoir au minimum :

- Disponible.
- Planifié.
- Affecté.
- En mission.
- En attente.
- En ravitaillement.
- En inspection.
- En maintenance.
- Immobilisé.
- Hors service.
- Suspendu.

### 9.3 Flotte propre et sous-traitants

La propriété et l'exploitation doivent être distinguées.

Un véhicule appartenant à un sous-traitant peut être affecté à une mission DARI sans devenir un actif appartenant à DARI.

Le système doit calculer séparément les performances et coûts de chaque catégorie.

## 10. Transporter Management

Créer un véritable espace de gestion des entreprises de transport.

Fonctions :

- Dossier entreprise.
- Contacts.
- Documents administratifs.
- Contrats.
- Avenants.
- Tarifs.
- Durées contractuelles.
- Flotte déclarée.
- Chauffeurs.
- Assurance.
- Visites techniques.
- Permis.
- Habilitations.
- Objectifs.
- Performance.
- Facturation.
- Décomptes.
- Retenues.
- Pénalités.
- Litiges.
- Évaluation périodique.

Le portail partenaire doit permettre de soumettre des documents et consulter les résultats autorisés.

## 11. Smart Dispatch Engine

Le moteur de dispatch doit être l'un des composants les plus importants du SIGTB.

### 11.1 Objectif

Calculer et proposer les meilleures affectations de camions, chauffeurs, engins et destinations.

### 11.2 Contraintes

- Position du camion.
- Distance.
- Temps de parcours.
- État des pistes.
- Capacité utile.
- Disponibilité mécanique.
- Disponibilité du chauffeur.
- Niveau de carburant.
- Autonomie.
- File d'attente.
- Capacité de la chargeuse.
- Capacité de réception.
- Priorité de production.
- Contrat.
- Restrictions de sécurité.

### 11.3 Fonctions

- Affectation initiale.
- Réaffectation dynamique.
- Optimisation par shift.
- Rééquilibrage des files.
- Gestion des interruptions.
- Gestion des pannes.
- Gestion des fermetures de pistes.
- Comparaison des affectations.
- Explication des recommandations.

### 11.4 Moteur d'optimisation

Utiliser une architecture permettant de commencer par des algorithmes déterministes puis d'intégrer OR-Tools.

Les objectifs d'optimisation doivent être configurables.

Exemples :

- Maximiser les tonnes acceptées.
- Minimiser les temps improductifs.
- Minimiser les coûts de transport.
- Réduire les distances à vide.
- Réduire les congestions.

Les contraintes de sécurité, de capacité, de disponibilité et de contrat ne doivent jamais être sacrifiées pour améliorer un score de production.

### 11.5 Décision humaine

Le système recommande.

Le dispatcher décide.

Chaque acceptation, modification ou refus est historisé.

Les affectations critiques ne doivent pas être modifiées automatiquement sans règle d'autorisation explicite.

## 12. Trip & Smart Cycle Tracking

Chaque voyage doit posséder un identifiant unique et un dossier numérique.

### Cycle opérationnel

DRAFT → PLANNED → ASSIGNED → AT_LOADING → LOADING → LOADED → WEIGHED_OUT → IN_TRANSIT → AT_DESTINATION → UNLOADING → WEIGHED_IN → DELIVERED → ACCEPTED → CLOSED.

États exceptionnels :

CANCELLED, INTERRUPTED, DISPUTED, REJECTED.

### Informations du voyage

- Mission.
- Site.
- Camion.
- Chauffeur.
- Transporteur.
- Contrat.
- Origine.
- Destination.
- Chargeuse.
- Horaires.
- Positions GPS.
- Distance.
- Arrêts.
- Chargement.
- Pesée.
- Livraison.
- Tonnage accepté.
- Coûts.
- Incidents.
- Documents.

### Détection automatique

Les changements d'état peuvent être détectés par GPS, géofencing, télématique ou équipements.

Une confirmation manuelle reste possible lorsque les données automatiques sont indisponibles.

Le système doit distinguer les événements détectés, déclarés et validés.

Aucune transition ne doit être considérée comme certaine uniquement parce qu'un camion se trouve dans une géofence.

## 13. Weighbridge & Payload Intelligence

Gérer les ponts-bascules et la charge utile.

### Fonctions

- Référentiel des ponts-bascules.
- État de calibration.
- Identification du camion.
- Identification du voyage.
- Ticket.
- Poids brut.
- Tare.
- Poids net.
- Horodatage.
- Photo ou justificatif.
- Agent.
- Origine de la mesure.
- Statut de validation.

### Contrôles

- Ticket en doublon.
- Poids incohérent.
- Surcharge.
- Sous-charge.
- Écart entre pesée départ et réception.
- Écart entre poids théorique et mesuré.
- Correction après clôture.

### Traçabilité

Distinguer systématiquement :

- Tonnes chargées.
- Tonnes transportées.
- Tonnes réceptionnées.
- Tonnes acceptées.

Seules les quantités éligibles selon le contrat doivent alimenter les décomptes.

## 14. Material Traceability

Suivre la bauxite tout au long de son parcours.

Chaque mouvement doit être associé autant que possible à :

- Site d'origine.
- Front ou zone d'extraction.
- Lot ou référence de matériau.
- Voyage.
- Véhicule.
- Pesée.
- Destination.
- Stockpile.
- Réception.
- Qualité.
- Livraison.

Prévoir des lots et mouvements de stock afin de préserver la traçabilité des quantités.

Le système doit pouvoir reconstituer l'historique d'une livraison et identifier les voyages qui ont contribué à un stock donné.

La gestion de la qualité de la bauxite doit être extensible aux analyses et critères contractuels effectivement utilisés par DARI.

## 15. GPS, Telematics & Geofencing

Fonctions :

- Position en temps réel.
- Historique des trajets.
- Vitesse.
- Distance.
- Temps d'arrêt.
- Heures moteur.
- Détection des sorties d'itinéraire.
- Alertes de retard.
- Géofences.
- État du dispositif.
- Qualité du signal.

Chaque position doit contenir :

- Horodatage.
- Latitude.
- Longitude.
- Précision.
- Source.
- Identifiant de l'équipement.
- Qualité.
- Statut de fraîcheur.

Prévoir des adaptateurs pour les fabricants de traceurs et les protocoles réellement disponibles.

Ne pas afficher une ancienne position comme une position en direct.

## 16. Road Intelligence

Créer un référentiel intelligent des routes et pistes.

Chaque tronçon comprend :

- Identifiant.
- Géométrie.
- Distance.
- Largeur.
- Pente.
- Altitude.
- Revêtement.
- État.
- Praticabilité.
- Restrictions.
- Vitesse recommandée.
- Capacité.
- Travaux.
- Risques.
- Historique.

Fonctions avancées :

- Détection des pistes dégradées.
- Signalement d'obstacles.
- Gestion des fermetures.
- Analyse des temps de parcours.
- Détection des zones dangereuses.
- Recommandation d'itinéraires.
- Estimation de consommation selon les conditions de piste.
- Intégration de données météo si disponibles.

## 17. Fuel Intelligence 360°

Gérer toute la chaîne carburant.

### Approvisionnement

- Commandes.
- Fournisseurs.
- Réception.
- Quantités.
- Prix.
- Tickets.
- Cuves.
- Stocks.

### Distribution

- Véhicule.
- Chauffeur.
- Agent.
- Date et heure.
- Station.
- Cuve.
- Débitmètre.
- Volume.
- Prix unitaire.
- Montant.
- Kilométrage.
- Heures moteur.
- Justificatifs.
- Validation.

### Réconciliation

Stock théorique = stock initial + entrées − sorties ± ajustements autorisés.

Comparer au stock physique et expliquer les écarts.

### Consommation

Litres/100 km = litres consommés / kilomètres parcourus × 100.

Litres/heure = litres consommés / heures moteur.

Litres/tonne = litres consommés / tonnes acceptées.

Les calculs doivent disposer d'une méthode fiable de mesure de consommation et ne pas confondre distribution et consommation.

### Anomalies

- Volume anormal.
- Ravitaillement répété.
- Variation inexpliquée de cuve.
- Distribution hors mission.
- Capacité de réservoir dépassée.
- Écart débitmètre/saisie.
- Consommation atypique.

Une anomalie doit être investiguée, pas automatiquement qualifiée de fraude.

## 18. Maintenance & Asset Intelligence

Gérer :

- Préventif.
- Correctif.
- Conditionnel.
- Inspections.
- Ordres de travail.
- Diagnostics.
- Pièces.
- Main-d'œuvre.
- Prestataires.
- Garanties.
- Coûts.
- Immobilisations.
- Remises en service.

### Maintenance conditionnelle et prédictive

Les règles de maintenance peuvent dépendre :

- Du kilométrage.
- Des heures moteur.
- Du calendrier.
- Des codes défaut.
- Des mesures de capteurs.
- De l'historique des pannes.

Les modèles prédictifs doivent être activés uniquement lorsque les données sont suffisantes et validées.

Un véhicule immobilisé ou non conforme ne peut pas être proposé par le dispatch.

## 19. Tire Management

Gérer chaque pneu individuellement.

Informations :

- Numéro de série.
- Marque.
- Dimension.
- Date d'achat.
- Coût.
- Position.
- Kilométrage.
- Heures d'utilisation.
- Usure.
- Pression si disponible.
- Permutations.
- Réparations.
- Rechapages.
- Mise au rebut.

Indicateurs :

- Coût par kilomètre.
- Durée de vie.
- Taux d'usure.
- Performance par marque.
- Performance par véhicule.
- Coût par tonne transportée.

## 20. Inventory & Procurement

Gérer les magasins et approvisionnements.

Fonctions :

- Demandes d'achat.
- Approbations.
- Consultations fournisseurs.
- Commandes.
- Réceptions.
- Factures.
- Stocks.
- Transferts.
- Inventaires.
- Lots.
- Numéros de série.
- Seuils d'alerte.
- Consommations.

Chaque pièce consommée doit pouvoir être liée à un ordre de travail et à un véhicule.

## 21. Equipment Management

Gérer les chargeuses, pelles, bulldozers et autres engins.

Informations :

- Type.
- Capacité.
- Site.
- Opérateur.
- Disponibilité.
- Heures moteur.
- Maintenance.
- Production.
- Arrêts.
- Consommation.
- Historique.

Indicateurs :

- Tonnes par heure.
- Temps productif.
- Temps d'attente.
- Disponibilité.
- Utilisation.
- Coût par tonne.

## 22. Driver, HR & Safety

Gérer les dossiers, permis, qualifications, formations, affectations, présences, temps de service et repos.

Sécurité :

- Inspections avant départ.
- Équipements de protection.
- Incidents.
- Accidents.
- Presque-accidents.
- Excès de vitesse.
- Alertes de fatigue.
- Comportements à risque.
- Mesures correctives.

Les données personnelles et disciplinaires doivent être cloisonnées.

Les règles de sécurité doivent être paramétrables par site et réglementation applicable.

## 23. Contracts & Finance

### Contrats

Gérer les contrats clients et transporteurs.

Chaque contrat comprend :

- Parties.
- Durée.
- Site.
- Périmètre.
- Unité tarifaire.
- Prix.
- Devise.
- Conditions de paiement.
- Retenues.
- Pénalités.
- Bonus.
- Objectifs.
- Avenants.

### Facturation

- Décomptes.
- Factures.
- Avoirs.
- Validations.
- Paiements.
- Retenues.
- Litiges.
- Export comptable.

### Rentabilité

Calculer les coûts directs et indirects disponibles :

- Carburant.
- Personnel.
- Maintenance.
- Pneus.
- Pièces.
- Sous-traitance.
- Frais de site.
- Péages.
- Amortissements.

Produire les analyses par voyage, véhicule, transporteur, site, contrat et tonne.

Les données estimées doivent être distinctes des coûts comptabilisés.

## 24. Mobile Operations & Offline-First

Développer une application mobile dédiée aux opérations terrain.

Profils :

- Chauffeur.
- Agent de pesée.
- Agent carburant.
- Mécanicien.
- Superviseur.
- Contrôleur.
- Chef d'équipe.
- Responsable de site.

Fonctions :

- Missions.
- Affectations.
- Checklists.
- GPS.
- Scan QR.
- Photos.
- Incidents.
- Pesées.
- Ravitaillements.
- Maintenance.
- Livraison.
- Rapports.

### Fonctionnement hors ligne

- SQLite.
- Identifiants UUID.
- File transactionnelle persistante.
- Synchronisation incrémentale.
- Idempotence.
- Gestion des conflits.
- Reprise après redémarrage.
- Gestion des pièces jointes.
- Journal de synchronisation.

Une opération enregistrée hors ligne doit être marquée EN ATTENTE DE SYNCHRONISATION tant que le serveur ne l'a pas acceptée.

Les validations financières, clôtures et changements de droits restent soumises à confirmation serveur.

## 25. Portails partenaires

### Portail sous-traitants

- Entreprise.
- Véhicules.
- Chauffeurs.
- Documents.
- Missions.
- Voyages.
- Tonnages.
- Décomptes.
- Factures.
- Litiges.
- Performance.

### Portail clients

- Commandes.
- Suivi des livraisons autorisées.
- Tonnages.
- Réceptions.
- Documents.
- Factures.
- États de paiement.
- Rapports.

Les deux portails doivent être strictement isolés.

## 26. Digital Twin & Mine Performance Simulator

Créer une représentation numérique de l'exploitation.

### Digital Twin

Visualiser :

- Pistes.
- Véhicules.
- Engins.
- Chargeuses.
- Destinations.
- Stocks.
- Zones de chargement.
- Ponts-bascules.
- Stations.
- Ateliers.
- Incidents.

### Historical Replay

Rejouer les événements d'une journée ou d'un shift.

Identifier :

- Les immobilisations.
- Les files d'attente.
- Les trajets.
- Les changements d'affectation.
- Les incidents.
- Les pertes de production.

### Simulation What-if

Simuler :

- Ajout de camions.
- Retrait de camions.
- Panne d'engin.
- Fermeture de piste.
- Modification de destination.
- Changement d'horaire.
- Modification de tarif carburant.
- Augmentation de production.

Chaque scénario doit afficher ses paramètres, hypothèses, résultats et limites.

Ne jamais mélanger les résultats de simulation avec les données réelles.

## 27. AI Operations Copilot

Créer un assistant opérationnel capable de répondre en langage naturel.

Exemples :

- Pourquoi le site a-t-il manqué son objectif ?
- Quels camions ont les cycles les plus longs ?
- Quel transporteur est le plus performant ?
- Combien de tonnes restent à livrer ?
- Quel est le coût par tonne ?
- Quels véhicules doivent être inspectés ?
- Quelle réaffectation pourrait améliorer le rendement ?

Chaque réponse doit comporter :

- Période analysée.
- Périmètre.
- Sources.
- Calcul.
- Hypothèses.
- Qualité des données.
- Niveau de confiance.
- Recommandation.
- Validation humaine nécessaire.

L'assistant ne doit pas inventer des données et ne doit pas effectuer d'opérations sensibles sans autorisation.

## 28. Control Tower et Reporting

Prévoir des vues adaptées à :

- Direction générale.
- Direction exploitation.
- Responsable de site.
- Dispatcher.
- Responsable flotte.
- Responsable carburant.
- Maintenance.
- Finance.
- Sous-traitants.

Les indicateurs doivent être centralisés dans des services ou vues de référence et non recalculés différemment dans chaque écran.

---

# PARTIE III — ARCHITECTURE ET EXIGENCES TECHNIQUES

## 29. Architecture générale

Conserver le socle existant lorsque sa pertinence est confirmée :

- React.
- TypeScript.
- Vite.
- Supabase Auth.
- PostgreSQL.
- PostGIS.
- Supabase Edge Functions.
- Leaflet ou MapLibre.
- React Native / Expo pour le mobile.
- SQLite.
- GitHub Actions.

Adopter une architecture de monolithe modulaire avec des services métier distincts.

Ne pas introduire des microservices sans nécessité démontrée.

## 30. Couches logicielles

1. Présentation Web et Mobile.
2. API et authentification.
3. Services métier.
4. Workflows et moteur événementiel.
5. Services d'optimisation.
6. Intégrations externes.
7. Base transactionnelle.
8. Données analytiques.

PostgreSQL constitue la source de vérité métier.

PostGIS gère les données géographiques.

Les calculs d'optimisation complexes peuvent être isolés dans un service Python avec OR-Tools, sans déplacer prématurément toutes les règles métier hors du socle existant.

## 31. Event Engine

Créer un journal durable des événements.

Chaque événement doit comprendre :

- ID.
- Type.
- Entité concernée.
- Date de survenue.
- Date d'enregistrement.
- Acteur.
- Source.
- Site.
- Payload.
- Identifiant de corrélation.
- Clé d'idempotence.
- Pièce justificative éventuelle.

Les événements historiques ne doivent pas être réécrits silencieusement.

Les corrections doivent produire de nouveaux événements audités.

Utiliser une approche Transactional Outbox pour assurer la cohérence entre les transactions métier et les traitements asynchrones.

## 32. Data Quality Engine

Chaque donnée doit disposer d'un statut de qualité adapté à son domaine.

Exemples :

- VERIFIED.
- VALIDATED.
- DECLARED.
- ESTIMATED.
- SIMULATED.
- STALE.
- INVALID.
- PENDING_SYNC.

Les tableaux de bord doivent signaler les données anciennes, incomplètes ou simulées.

## 33. Modèle de données

Cartographier les tables existantes avant d'en créer de nouvelles.

Entités principales à garantir :

**Organisation :**
organizations, business_units, sites, departments.

**Sécurité :**
profiles, user_roles, permissions, user_site_scopes.

**Partenaires :**
clients, transporters, suppliers, contracts.

**Flotte :**
vehicles, vehicle_owners, vehicle_assignments, vehicle_documents.

**Chauffeurs :**
drivers, employees, driver_qualifications, driver_shifts.

**Production :**
production_plans, production_targets, loading_points, equipment.

**Transport :**
trips, trip_events, dispatch_assignments.

**Pesée :**
weighbridges, weighing_records, weighing_tickets, delivery_receipts.

**Carburant :**
fuel_stations, fuel_tanks, fuel_transactions, fuel_measurements, fuel_reconciliations.

**Maintenance :**
maintenance_orders, maintenance_tasks, maintenance_parts, vehicle_downtime.

**Pneus :**
tires, tire_installations, tire_inspections, tire_movements.

**Finance :**
invoices, invoice_lines, payments, cost_entries, settlements.

**Stocks :**
stock_items, stock_locations, stock_movements, purchase_orders.

**Sécurité :**
incidents, safety_inspections, driver_events, compliance_documents.

**IoT :**
iot_devices, device_readings, device_events, device_health.

**Traçabilité :**
business_events, audit_logs, attachments, integration_events.

Les noms constituent un modèle cible conceptuel, pas une instruction de recréer toutes ces tables si des structures existantes remplissent déjà les mêmes fonctions.

## 34. API et intégrations

Prévoir des interfaces versionnées :

/api/v1/production/plans

/api/v1/production/targets

/api/v1/dispatch/recommendations

/api/v1/dispatch/assignments

/api/v1/trips

/api/v1/trips/{id}/events

/api/v1/weighbridge/records

/api/v1/deliveries

/api/v1/fuel/transactions

/api/v1/fuel/reconciliations

/api/v1/maintenance/orders

/api/v1/transporters

/api/v1/contracts

/api/v1/finance/settlements

/api/v1/analytics/production

/api/v1/devices/telemetry

/api/v1/sync/push

/api/v1/sync/pull

Les intégrations matérielles doivent être réalisées par adaptateurs indépendants.

## 35. Sécurité

- RLS restrictive.
- Contrôle multi-entreprises.
- Contrôle multi-sites.
- Contrôle par rôle.
- Protection contre l'élévation de privilèges.
- MFA pour les comptes sensibles.
- Secrets côté serveur.
- Journalisation.
- Protection des endpoints.
- Authentification des équipements.
- Limitation de débit.
- Gestion des pièces jointes privées.
- Sauvegardes.
- Tests de restauration.
- Contrôle des dépendances.
- Politique d'archivage.

Les opérations sensibles doivent être exécutées par des fonctions serveur autorisées.

## 36. Fiabilité et performance

Prévoir :

- Pagination.
- Indexation PostgreSQL.
- Index géospatiaux.
- Requêtes optimisées.
- Agrégations analytiques.
- Traitements asynchrones.
- Cache maîtrisé.
- Gestion des erreurs.
- Supervision.
- Journalisation structurée.
- Alertes techniques.

Les objectifs de performance doivent être définis après mesure de la flotte, de la fréquence GPS, du nombre d'utilisateurs et du volume d'événements.

---

# PARTIE IV — KPI ET PILOTAGE

## 37. Indicateurs normalisés

| Indicateur | Règle de calcul |
|---|---|
| Tonnes livrées | Somme des poids nets livrés |
| Tonnes acceptées | Somme des poids nets acceptés |
| Réalisation | Tonnes acceptées / objectif × 100 |
| Voyages par camion | Voyages clôturés par véhicule |
| Temps de cycle | Fin du cycle − début du cycle |
| Temps d'attente | Durée des événements d'attente |
| Disponibilité | Temps disponible / temps planifié |
| Utilisation | Temps productif / temps disponible |
| Consommation spécifique | Litres consommés / tonnes acceptées |
| Coût par tonne | Coûts attribués / tonnes acceptées |
| MTBF | Temps de fonctionnement / nombre de pannes |
| MTTR | Temps de réparation / nombre d'interventions |
| Performance transporteur | Tonnes acceptées / objectif contractuel |
| Marge opérationnelle | Revenus attribués − coûts attribués |

Les heures moteur, heures de conduite, heures de disponibilité et heures productives doivent rester distinctes.

Chaque KPI doit pouvoir être ventilé par site, shift, véhicule, chauffeur, transporteur, contrat, destination et période.

---

# PARTIE V — DÉPENDANCES ET PLAN DE TRANSFORMATION

## 38. Ordre des dépendances

La chaîne de dépendances est :

Sécurité et référentiels
→ Planification
→ Flotte et disponibilité
→ GPS et événements
→ Missions et rotations
→ Pesée et livraison
→ Dispatch avancé
→ Carburant et maintenance
→ Finance et rentabilité
→ Mobile et synchronisation
→ Digital Twin et simulation
→ IA et analytique avancée.

Certains développements peuvent être parallélisés après validation de leurs interfaces.

## 39. Lots de développement

LOT 00 — Audit et état de référence.

LOT 01 — Sécurité et qualité du socle.

LOT 02 — Organisation Enterprise et référentiels.

LOT 03 — Production Planning et Shift Management.

LOT 04 — Command Center et KPI.

LOT 05 — Flotte mixte et sous-traitants.

LOT 06 — Cycle de transport et Event Engine.

LOT 07 — Pesée, livraison et traçabilité.

LOT 08 — GPS, IoT et cartographie.

LOT 09 — Smart Dispatch et Optimization Engine.

LOT 10 — Fuel Intelligence 360°.

LOT 11 — Maintenance, pneus et stocks.

LOT 12 — Finance, contrats et rentabilité.

LOT 13 — Mobile et Offline-First.

LOT 14 — Digital Twin et Simulation.

LOT 15 — Road Intelligence et Safety Intelligence.

LOT 16 — AI Operations Copilot et Analytics.

LOT 17 — Portails partenaires.

LOT 18 — Tests intégrés et pilote opérationnel.

LOT 19 — Préparation et validation de production.

Chaque lot doit posséder :

- Une branche de travail.
- Un responsable.
- Des fichiers concernés.
- Des dépendances.
- Des critères d'acceptation.
- Des tests.
- Une revue.
- Une Pull Request.
- Une documentation.
- Une preuve de validation.

---

# PARTIE VI — RECETTE ET MISE EN PRODUCTION

## 40. Scénarios de recette

AT-001 : Création d'un véhicule DARI.

AT-002 : Enregistrement d'un sous-traitant.

AT-003 : Isolation de ses données.

AT-004 : Planification d'un shift.

AT-005 : Affectation d'un camion.

AT-006 : Départ d'un voyage.

AT-007 : Détection d'arrivée au chargement.

AT-008 : Enregistrement du chargement.

AT-009 : Enregistrement d'une pesée.

AT-010 : Détection d'un doublon de ticket.

AT-011 : Départ vers destination.

AT-012 : Détection d'un arrêt prolongé.

AT-013 : Enregistrement de livraison.

AT-014 : Rapprochement des poids.

AT-015 : Acceptation du tonnage.

AT-016 : Clôture du voyage.

AT-017 : Déclaration de panne.

AT-018 : Blocage du dispatch d'un véhicule immobilisé.

AT-019 : Remise en service validée.

AT-020 : Ravitaillement carburant.

AT-021 : Réconciliation de cuve.

AT-022 : Détection d'anomalie carburant.

AT-023 : Génération d'un décompte transporteur.

AT-024 : Calcul de coût par tonne.

AT-025 : Réaffectation intelligente.

AT-026 : Fermeture d'une piste.

AT-027 : Simulation de production.

AT-028 : Synchronisation hors ligne.

AT-029 : Rejeu sans doublon.

AT-030 : Tentative d'accès non autorisé.

AT-031 : Correction d'une pesée clôturée.

AT-032 : Rejeu historique d'un shift.

AT-033 : Perte de signal GPS.

AT-034 : Contrôle des données périmées.

AT-035 : Restauration d'une sauvegarde.

## 41. Exigences de validation

Un module ne peut être déclaré terminé que si :

- Son code est intégré.
- Ses règles métier sont implémentées.
- Ses permissions sont vérifiées.
- Ses migrations sont testées.
- Ses tests passent.
- Ses erreurs sont gérées.
- Sa documentation est mise à jour.
- Son comportement est démontré.

Exigences minimales :

- TypeScript sans erreur.
- Build réussi.
- Lint sans erreur bloquante.
- Tests unitaires.
- Tests d'intégration.
- Tests RLS.
- Tests end-to-end.
- Tests de charge adaptés.
- Tests Offline-First.
- Tests de restauration.

## 42. Mise en production

La mise en production exige :

1. Sauvegarde préalable.
2. Vérification des migrations.
3. Validation des permissions.
4. Recette métier.
5. Vérification des équipements.
6. Plan de retour arrière.
7. Supervision.
8. Documentation.
9. Formation.
10. Support opérationnel.

Le déploiement réel et les modifications de données de production nécessitent une autorisation appropriée.

---

# PARTIE VII — LIVRABLES

## 43. Documents techniques

Créer et maintenir :

docs/SIGTB_2.0_MASTER_PLAN.md

docs/SIGTB_2.0_CAHIER_DES_CHARGES.md

docs/SIGTB_2.0_ARCHITECTURE.md

docs/SIGTB_2.0_DATABASE_MODEL.md

docs/SIGTB_2.0_SECURITY.md

docs/SIGTB_2.0_API.md

docs/SIGTB_2.0_EVENT_ENGINE.md

docs/SIGTB_2.0_DISPATCH_ENGINE.md

docs/SIGTB_2.0_FUEL_INTELLIGENCE.md

docs/SIGTB_2.0_MOBILE.md

docs/SIGTB_2.0_DIGITAL_TWIN.md

docs/SIGTB_2.0_AI.md

docs/SIGTB_2.0_TEST_PLAN.md

docs/SIGTB_2.0_DEPLOYMENT.md

docs/SIGTB_2.0_PROGRESS.md

docs/SIGTB_2.0_DECISIONS.md

## 44. Suivi de progression

Pour chaque module, enregistrer :

- Existant.
- À corriger.
- En développement.
- Testé.
- Validé.
- Déployé.
- Dépendances.
- Risques.
- Fichiers.
- Commits.
- Pull Requests.

Ne jamais confondre développé, testé, validé et déployé.

## 45. Définition finale du succès

SIGTB 2.0 est considéré comme opérationnel lorsque :

1. La production est planifiable et mesurable.
2. La flotte propre et partenaire est intégrée.
3. Le dispatch propose des affectations cohérentes.
4. Les voyages sont entièrement traçables.
5. Les pesées et livraisons sont rapprochées.
6. Les coûts sont calculables.
7. Le carburant est contrôlé.
8. La maintenance pilote la disponibilité.
9. Les sous-traitants sont évaluables.
10. Les opérations terrain fonctionnent avec une connectivité intermittente.
11. Les données sont sécurisées.
12. Les tableaux de bord sont fiables.
13. Les simulations sont reproductibles.
14. Les intégrations sont réellement vérifiées.
15. Les tests critiques passent.
16. La documentation et le support sont prêts.

**VISION FINALE**

SIGTB 2.0 doit devenir le centre de commande numérique de DARI HOLDING.

Son indicateur de réussite principal est l'amélioration mesurable des tonnes de bauxite livrées et acceptées, tout en maîtrisant les coûts, la sécurité et la disponibilité des équipements.
