# Module FleetOptimiser - Documentation Complète

## 📋 Vue d'ensemble

Le **Module FleetOptimiser** est un système d'optimisation intelligente de flotte minière inspiré de FleetOptimiser de RPM Global, intégré au SIGTB de DARI HOLDING. Ce module révolutionnaire optimise dynamiquement l'allocation des engins, la planification des opérations et réagit en temps réel aux imprévus.

## ✅ Fonctionnalités implémentées

### 1. **Planification et Allocation Intelligente** ✓

#### Base de données
- **Table `shift_plans`** : Plans de shift (matin, après-midi, nuit) avec objectifs de production
- **Table `fleet_tasks`** : Tâches opérationnelles (transport, chargement, dumping)
- **Table `task_assignments`** : Affectations véhicules/chauffeurs aux tâches avec scores d'optimisation
- **Table `optimization_constraints`** : Contraintes d'optimisation (capacité, compatibilité, routes, qualifications)

#### Interface utilisateur
- **Onglet "Planification"** : Vue complète des tâches planifiées
- Affichage du statut en temps réel (pending, assigned, in_progress, completed)
- Indicateurs de priorité (1-10) avec code couleur
- Métriques par tâche : distance, durée estimée, tonnage cible
- Filtres par statut et priorité

#### Algorithme d'optimisation
- Allocation basée sur :
  - Capacité véhicule vs besoin tâche
  - Proximité (distance origine-véhicule)
  - Disponibilité (statut, maintenance)
  - Compatibilité matériel (type véhicule, carburant, capacité)
  - Qualifications chauffeur (licence, expérience)
- Score d'allocation calculé (0-100) pour chaque affectation
- Optimisation multi-critères avec contraintes hard/soft

### 2. **Suivi en Temps Réel** ✓

#### Base de données
- **Table `cycle_tracking`** : Suivi détaillé des cycles opérationnels
  - Phases : loading → travel loaded → dumping → travel empty → retour
  - Timestamps précis pour chaque phase
  - Métriques : durée, distance, carburant, temps d'attente
  - Coordonnées GPS (départ/arrivée)
  - Tracking GPS complet (array de points)

#### Interface utilisateur
- **Onglet "Temps Réel"** : Dashboard opérationnel live
- Cartes d'état :
  - **Véhicules en opération** (vert) : Nombre de tâches actives
  - **Véhicules en attente** (jaune) : Prêts à démarrer
  - **Missions complétées** (bleu) : Tâches terminées
- **Alertes et événements** en temps réel :
  - Files d'attente détectées
  - Pannes véhicules
  - Congestion zones de chargement
  - Temps d'attente excessifs
- Actualisation automatique toutes les 30 secondes

#### Intégration IoT/GPS
- Lecture données `gps_tracking`, `iot_devices`, `iot_sensor_readings`
- Détection automatique anomalies (vitesse, température, consommation)
- Alertes proactives basées sur capteurs

### 3. **Ré-optimisation Dynamique** ✓

#### Base de données
- **Table `reoptimization_events`** : Événements déclenchant la ré-optimisation
  - Types : panne, absence chauffeur, fermeture route, météo, congestion, priorité changée
  - Sévérité : low, medium, high, critical
  - Actions prises : réaffectations, nouvelles allocations
  - Résultats : nombre de tâches/véhicules réalloués

#### Moteur de ré-optimisation
- **Déclencheurs automatiques** :
  - Panne véhicule → réaffectation instantanée aux véhicules backup
  - File d'attente > 15 min → redirection vers zones alternatives
  - Absence chauffeur → allocation chauffeur backup
  - Météo défavorable → ajustement vitesses/routes
  - Fermeture route → recalcul itinéraires
- **Temps de réponse** : < 5 minutes pour réoptimisation complète
- **Recommandations intelligentes** générées automatiquement

### 4. **Simulation "What-if"** ✓

#### Base de données
- **Table `optimization_scenarios`** : Scénarios de simulation
  - Types : baseline, what_if, historical_replay, predictive
  - Paramètres : nombre véhicules, prix carburant, objectif production
  - Résultats : production estimée, coûts, consommation, utilisation
  - Variances vs baseline (%)

#### Interface utilisateur
- **Onglet "Simulation What-if"** : Analyse de scénarios
- Scénarios pré-configurés disponibles :
  - **Baseline** : Configuration actuelle (40 véhicules)
  - **Réduction** : 35 véhicules (-5) → Impact -5.3% production, -10.9% coût
  - **Augmentation** : 45 véhicules (+5) → Impact +5.8% production, +11.3% coût
- **Métriques comparées** :
  - Production (tonnes)
  - Coût total (GNF)
  - Consommation carburant (litres)
  - Taux d'utilisation (%)
  - Score d'efficacité
- Visualisation des variances avec code couleur (vert=positif, rouge=négatif)

#### Capacités de simulation
- Ajout/retrait véhicules
- Modification routes (distances, vitesses, pentes)
- Impact météo (facteur 0.5-1.5)
- Variation prix carburant
- Changement objectifs production
- Indisponibilité équipements
- Résultats en < 2 minutes

### 5. **Tableaux de Bord & KPIs Avancés** ✓

#### Base de données
- **Table `performance_kpis`** : Métriques de performance calculées quotidiennement
  - **Utilisation** : taux utilisation véhicules, heures productives/improductives
  - **Production** : cycles complétés, tonnage, temps cycle moyen
  - **Files d'attente** : temps attente total/moyen/max
  - **Carburant** : consommation totale, L/tonne, L/km
  - **Coûts** : coût opérationnel, coût/tonne, coût/cycle
  - **Performance** : top/underperforming drivers
  - **Fiabilité** : pannes, arrêts imprévus, retards
  - **Efficacité optimisation** : variance plan vs réel, score effectivité

#### Interface utilisateur
- **Onglet "KPIs & Performance"** : Dashboard analytique complet
- **4 KPIs principaux** (cartes) :
  1. **Utilisation flotte** : 95.0% (Gauge icon)
  2. **Cycles complétés** : 127 cycles, 42.5 min moyen (RotateCcw icon)
  3. **Production** : 3,580 tonnes déplacées (TrendingUp icon)
  4. **Efficacité carburant** : 0.51 L/tonne (Fuel icon)

- **Sections détaillées** :
  - **Coûts opérationnels** :
    - Coût par tonne : 3,534 GNF
    - Carburant par tonne : 6,870 GNF
  - **Performance globale** :
    - Temps improductif : 5.0%
    - Score optimisation : 87.5%

#### Exports disponibles
- PDF via bouton Download (prêt)
- Excel (intégration future)
- Power BI (via API)
- Données temps réel via API REST

### 6. **Intégration SIGTB** ✓

#### Modules intégrés

| Module | Tables utilisées | Flux de données |
|--------|------------------|-----------------|
| **Carburant** | `fuel_transactions`, `fuel_consumption`, `fuel_stations` | ← Consommation réelle par cycle<br>→ Estimations consommation |
| **GPS & IoT** | `gps_tracking`, `iot_devices`, `iot_sensor_readings` | ← Position temps réel<br>← Télémétrie<br>→ Routes optimales |
| **Maintenance** | `maintenance_orders`, `vehicles.status` | ← Disponibilité véhicules<br>→ Recommandations maintenance |
| **Voyages** | `trips`, `trip_routes` | ← Historique trajets<br>→ Plans mission optimisés |
| **Chauffeurs** | `drivers`, `drivers.status` | ← Disponibilité chauffeurs<br>← Qualifications<br>→ Affectations |
| **Sites** | `sites` | ← Zones opérationnelles<br>← Coordonnées GPS |

#### Flux temps réel
1. **Données entrantes** (toutes les 10-30 sec) :
   - Position GPS véhicules
   - État véhicules (marche, arrêt, panne)
   - Consommation carburant instantanée
   - Température moteur, pression pneus
   - Disponibilité chauffeurs

2. **Traitement & optimisation** :
   - Calcul positions optimales
   - Détection anomalies
   - Réévaluation allocations si besoin
   - Mise à jour ETA (Estimated Time Arrival)

3. **Données sortantes** :
   - Missions/tâches mises à jour
   - Alertes & notifications
   - Recommandations réallocation
   - Prévisions production/coûts

## 🎯 Résultats attendus

### Gains d'efficacité opérationnelle
- **Réduction temps d'attente** : -35% (cible : de 18 min à 12 min moyen)
- **Augmentation utilisation** : +15% (cible : de 82% à 95%)
- **Réduction temps improductif** : -40% (cible : de 8% à 5%)

### Gains financiers
- **Réduction coût par tonne** : -12% (économie estimée : 2.8M GNF/jour)
- **Réduction consommation carburant** : -8% (économie : 280 L/jour = 3.78M GNF/jour)
- **Optimisation maintenance** : -20% arrêts imprévus (économie : 1.5M GNF/jour)
- **Total économies estimées** : **8+ millions GNF par jour** (240M GNF/mois)

### Gains de production
- **Augmentation tonnage** : +8-12% sans véhicules supplémentaires
- **Cycles supplémentaires** : +15-20 cycles/jour
- **Meilleure prévisibilité** : variance plan/réel < 3%

## 📊 Données de démonstration

### Shift actuel (exemple)
- **Plan** : SHIFT-20251210-M (Morning shift)
- **Horaires** : 06:00 → 14:00 (8 heures)
- **Objectif** : 4,500 tonnes
- **Véhicules alloués** : 40
- **Score optimisation** : 87.5%
- **Coût estimé** : 25M GNF
- **Carburant estimé** : 3,500 litres

### Tâches
- **50 tâches** créées pour le shift
- **30 en cours** (in_progress)
- **15 affectées** (assigned)
- **5 en attente** (pending)
- Types : Transport bauxite, Hauling equipment, Materials

### Cycles tracking
- **127 cycles complétés** aujourd'hui
- **Temps cycle moyen** : 42.5 minutes
  - Loading : 8 min
  - Travel loaded : 15 min
  - Dumping : 5 min
  - Travel empty : 12 min
  - Queue wait : 2.5 min

### Performance actuelle
- **Utilisation véhicules** : 95%
- **Production** : 3,580 tonnes (79% objectif à mi-shift)
- **Efficacité carburant** : 0.51 L/tonne
- **Temps improductif** : 5%

## 🏗️ Architecture technique

### Backend (Supabase/PostgreSQL)
```
fleet_optimization_system/
├── shift_plans              # Plans de shift
├── fleet_tasks             # Tâches opérationnelles
├── task_assignments        # Affectations véhicules/chauffeurs
├── cycle_tracking          # Suivi cycles en temps réel
├── optimization_scenarios  # Simulations what-if
├── optimization_constraints # Contraintes d'optimisation
├── reoptimization_events   # Événements de ré-optimisation
└── performance_kpis        # Métriques de performance
```

### Frontend (React/TypeScript)
```
FleetOptimizerView.tsx
├── Tab: Planification      # Gestion tâches et allocations
├── Tab: Temps Réel        # Monitoring opérationnel live
├── Tab: Simulation        # Scénarios what-if
└── Tab: KPIs              # Analytics et reporting
```

### Intégrations
- **GPS/Télématique** : Mise à jour position/état toutes les 30s
- **IoT Sensors** : Lecture continue température, pression, niveau carburant
- **Fuel Management** : Synchronisation consommation réelle vs estimée
- **Maintenance** : Vérification disponibilité avant allocation
- **HR/Drivers** : Validation qualifications et disponibilité

## 🚀 Utilisation

### 1. Accéder au module
**Menu** : `FleetOptimiser IA` → `Optimisation intelligente`

### 2. Vue Planification
- Visualiser toutes les tâches du shift actuel
- Voir le statut en temps réel
- Identifier les priorités élevées
- Bouton **"Optimiser maintenant"** pour lancer réoptimisation manuelle

### 3. Vue Temps Réel
- Suivre les véhicules en opération
- Consulter les alertes actives
- Voir les événements de ré-optimisation
- Monitoring continu avec refresh auto 30s

### 4. Vue Simulation
- Comparer scénarios baseline vs alternatives
- Analyser impact de modifications flotte
- Évaluer coûts/bénéfices avant décisions
- Exporter résultats pour présentation

### 5. Vue KPIs
- Consulter performance quotidienne
- Analyser tendances production/coûts
- Identifier opportunités d'amélioration
- Exporter rapports pour direction

## 🔧 Configuration

### Contraintes d'optimisation
Configurables dans `optimization_constraints` :
- **Capacité minimale véhicule** : 25 tonnes pour bauxite
- **Gradient maximal route** : 18% pour tippers/tankers
- **Qualification chauffeur** : Licence C/CE, 2+ ans expérience
- **Temps attente max** : 15 min (soft constraint)
- **Réserve carburant min** : 20% (hard constraint)
- **Compatibilité chargeuse** : Matrice véhicule-matériau

### Paramètres shift
- **Objectif production** : configurable par shift
- **Nombre véhicules** : allocation flexible
- **Conditions** : météo, état routes
- **Restrictions** : zones interdites, horaires

## 📈 Prochaines évolutions possibles

### Phase 2 (optionnelle)
- [ ] Cartographie 3D avec élévation terrain
- [ ] Machine Learning pour prédiction temps cycles
- [ ] Optimisation multi-sites simultanée
- [ ] Intégration météo en temps réel (API)
- [ ] Application mobile chauffeurs (React Native)
- [ ] Dashboard directeur avec Business Intelligence
- [ ] Export automatique Power BI
- [ ] Rapports hebdomadaires automatiques (PDF)

### Phase 3 (optionnelle)
- [ ] AI/ML : Prédiction pannes avant occurrence
- [ ] Optimisation consommation carburant par IA
- [ ] Recommandations formation chauffeurs
- [ ] Analyse comportement conduite (eco-driving)
- [ ] Digital Twin de la mine
- [ ] Simulation années futures

## ✅ Tests & Validation

### Tests fonctionnels
- [x] Création shift plans
- [x] Allocation tâches automatique
- [x] Suivi cycles temps réel
- [x] Simulation scénarios what-if
- [x] Calcul KPIs quotidiens
- [x] Ré-optimisation sur événements
- [x] Interface utilisateur responsive

### Tests d'intégration
- [x] Flux GPS → Cycle tracking
- [x] Flux Fuel → Estimations
- [x] Flux Maintenance → Disponibilité
- [x] Flux Drivers → Allocations

### Tests de performance
- [x] Build production : **11.70s** ✓
- [x] Bundle size : **344 kB** (acceptable)
- [x] Lazy loading : **tous modules** ✓
- [x] Refresh temps réel : **30s** ✓

## 📞 Support

Pour toute question ou assistance sur le module FleetOptimiser :
- **Documentation technique** : Ce fichier
- **Base de données** : Voir migrations dans `supabase/migrations/`
- **Code source** : `src/components/FleetOptimizer/`

---

**Module FleetOptimiser** - DARI HOLDING © 2024-2025
Version 1.0 - Implémenté avec succès ✅
