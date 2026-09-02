# Guide d'Administration - SIGTB DARI HOLDING

## Vue d'ensemble

Le module d'administration permet de configurer tous les aspects du système SIGTB. Ce guide détaille chaque paramètre disponible et son impact sur le fonctionnement de l'application.

---

## 1. Gestion des Utilisateurs

### Fonctionnalités
- **Liste des utilisateurs** : Visualisation de tous les comptes utilisateurs
- **Recherche** : Recherche rapide par email
- **Statut** : Actif/Inactif
- **Rôles** : Attribution de rôles (Administrateur, Gestionnaire, Utilisateur)
- **Actions** :
  - Ajouter un nouvel utilisateur
  - Modifier les informations d'un utilisateur
  - Supprimer un utilisateur
  - Réinitialiser le mot de passe

### Colonnes affichées
- Email de l'utilisateur
- Rôle assigné
- Date de création du compte
- Dernière connexion
- Statut du compte

---

## 2. Paramètres Généraux

### Informations entreprise
- **Nom de l'entreprise** : Nom affiché sur les documents et l'interface
- **Adresse** : Adresse complète de l'entreprise
- **Téléphone** : Numéro de contact principal
- **Email** : Email de contact général

### Configuration système
- **Devise** : GNF (Franc Guinéen), USD, EUR
- **Langue** : Français, English
- **Fuseau horaire** : Africa/Conakry par défaut
- **Format de date** : JJ/MM/AAAA, MM/JJ/AAAA, AAAA-MM-JJ

---

## 3. Paramètres Véhicules

### Configuration véhicules
- **Kilométrage minimum pour alerte maintenance** : Distance avant déclenchement d'alerte (défaut: 5000 km)
- **Vitesse maximale autorisée** : Limite de vitesse pour alertes (défaut: 90 km/h)
- **Consommation moyenne** : Consommation standard en L/100km (défaut: 35 L/100km)
- **Rappels automatiques d'inspection technique** : Activation des notifications
- **Alertes renouvellement assurance** : Notifications avant expiration

### Types de véhicules
- **Capacité standard dumper** : Tonnage par défaut (défaut: 50 tonnes)
- **Capacité standard tracteur** : Tonnage par défaut (défaut: 40 tonnes)
- **Intervalle vidange standard** : Kilométrage entre vidanges (défaut: 10000 km)

**Impact** : Ces paramètres affectent les calculs automatiques de maintenance et les alertes préventives.

---

## 4. Paramètres Maintenance

### Maintenance préventive
- **Intervalle maintenance routière** : Fréquence maintenance standard (défaut: 10000 km)
- **Intervalle maintenance majeure** : Fréquence révisions complètes (défaut: 50000 km)
- **Avance alerte maintenance** : Distance avant échéance pour alerte (défaut: 1000 km)
- **Jours avant expiration inspection** : Délai de notification (défaut: 30 jours)
- **Planification automatique des maintenances** : Création auto des ordres de travail

### Coûts et budget
- **Budget mensuel maintenance** : Budget alloué en GNF (défaut: 50M GNF)
- **Coût moyen vidange** : Estimation standard (défaut: 500000 GNF)
- **Taux horaire main d'oeuvre** : Coût horaire technicien (défaut: 25000 GNF)
- **Alertes dépassement budget** : Notifications si budget dépassé

**Impact** : Contrôle la planification automatique et le suivi budgétaire de la maintenance.

---

## 5. Paramètres Carburant

### Tarification carburant
- **Prix diesel** : Prix actuel par litre en GNF (défaut: 8500 GNF/L)
- **Prix essence** : Prix actuel par litre en GNF (défaut: 9000 GNF/L)
- **Capacité réservoir standard** : Capacité moyenne en litres (défaut: 300 L)
- **Mise à jour automatique des prix** : Actualisation automatique depuis source externe

### Alertes carburant
- **Seuil alerte faible niveau** : Pourcentage pour alerte (défaut: 20%)
- **Seuil alerte niveau critique** : Pourcentage pour alerte urgente (défaut: 10%)
- **Variation anormale détection** : Seuil détection anomalie (défaut: 15%)
- **Détection automatique de vol de carburant** : Analyse des variations suspectes

**Impact** : Permet la détection précoce des problèmes de carburant et optimise la gestion des coûts.

---

## 6. Paramètres Pneus

### Gestion des pneus
- **Kilométrage moyen avant remplacement** : Durée de vie estimée (défaut: 80000 km)
- **Profondeur minimale** : Seuil légal en mm (défaut: 3.0 mm)
- **Pression recommandée** : Pression optimale en PSI (défaut: 110 PSI)
- **Nombre maximum de rechapage** : Limite de rechapages (défaut: 3)
- **Rappels rotation des pneus** : Notifications rotation périodique

### Coûts pneus
- **Prix moyen pneu neuf** : Coût d'achat en GNF (défaut: 1.5M GNF)
- **Coût rechapage** : Prix rechapage en GNF (défaut: 600K GNF)
- **Budget mensuel pneus** : Budget alloué en GNF (défaut: 20M GNF)

**Impact** : Optimise le cycle de vie des pneus et réduit les coûts d'exploitation.

---

## 7. Paramètres GPS et Suivi

### Configuration GPS
- **Intervalle de mise à jour** : Fréquence transmission position (défaut: 30 secondes)
- **Durée historique conservé** : Rétention données GPS (défaut: 90 jours)
- **Rayon géofencing par défaut** : Taille zone en mètres (défaut: 500m)
- **Suivi en temps réel activé** : Tracking continu des véhicules
- **Enregistrement automatique des trajets** : Conservation historique trajets

### Alertes GPS
- **Temps maximum hors connexion** : Délai avant alerte déconnexion (défaut: 30 min)
- **Alertes excès de vitesse** : Notifications dépassement limite
- **Alertes sortie de zone** : Notifications géofencing
- **Alertes temps d'arrêt prolongé** : Détection inactivité excessive

**Impact** : Améliore la sécurité, le contrôle des opérations et l'optimisation des trajets.

---

## 8. Paramètres Facturation

### Configuration facturation
- **Préfixe numéro facture** : Préfixe automatique (défaut: INV)
- **Délai de paiement par défaut** : Échéance standard en jours (défaut: 30 jours)
- **Taux TVA** : Pourcentage TVA appliqué (défaut: 18%)
- **Pénalités de retard** : Taux par mois de retard (défaut: 2%)
- **Numérotation automatique** : Génération auto numéros de facture

### Rappels paiement
- **Premier rappel avant échéance** : Jours avant échéance (défaut: 7 jours)
- **Deuxième rappel après échéance** : Jours après échéance (défaut: 7 jours)
- **Envoi automatique des rappels** : Emails automatiques aux clients

**Impact** : Améliore le recouvrement et réduit les impayés.

---

## 9. Paramètres Alertes et Notifications

### Types d'alertes (activable/désactivable)
- ✅ Alertes maintenance
- ✅ Alertes niveau carburant bas
- ✅ Alertes inspection technique
- ✅ Alertes renouvellement assurance
- ✅ Alertes excès de vitesse
- ✅ Alertes sortie de zone
- ✅ Alertes usure pneus
- ✅ Alertes factures impayées

### Canaux de notification
- **Email** : Notifications par courrier électronique
- **SMS** : Notifications par message texte
- **Push** : Notifications push mobile
- **Dashboard** : Notifications dans l'application web

**Impact** : Permet une réactivité optimale aux événements critiques.

---

## 10. Paramètres Sécurité

### Sécurité
- **Durée de session** : Timeout session en minutes (défaut: 60 min)
- **Longueur minimale mot de passe** : Caractères minimum (défaut: 8)
- **Exiger mots de passe complexes** : Majuscules, chiffres, symboles
- **Authentification à deux facteurs** : 2FA pour sécurité renforcée
- **Journaliser activité utilisateurs** : Audit trail complet

### Sauvegardes
- **Fréquence sauvegardes automatiques** : Horaire, Quotidienne, Hebdomadaire
- **Durée conservation sauvegardes** : Rétention en jours (défaut: 30 jours)
- **Activer sauvegardes automatiques** : Backup automatique BDD

**Impact** : Protège les données et permet la traçabilité des actions.

---

## 11. Paramètres Intégrations

### Intégrations disponibles

#### API REST
- **Activation** : Active l'accès API externe
- **Clé API** : Clé secrète pour authentification
- **Régénération** : Possibilité de régénérer la clé

#### Webhooks
- **Activation** : Notifications événements en temps réel
- **URL webhook** : Endpoint pour recevoir les notifications

#### Google Maps
- **Activation** : Intégration cartographie pour GPS
- **Clé API** : Clé Google Maps API

#### Export comptabilité
- **Activation** : Export automatique vers logiciel comptable
- **Format** : CSV, Excel, Format comptable standard

**Impact** : Permet l'intégration avec d'autres systèmes d'entreprise.

---

## Best Practices

### 1. Configuration initiale
1. Renseigner toutes les informations entreprise
2. Définir les intervalles de maintenance selon votre flotte
3. Configurer les prix carburant actuels
4. Activer les alertes essentielles

### 2. Maintenance régulière
- Mettre à jour les prix carburant mensuellement
- Réviser les budgets trimestriellement
- Vérifier les seuils d'alerte semestriellement
- Auditer les utilisateurs mensuellement

### 3. Sécurité
- Activer 2FA pour les administrateurs
- Réviser les permissions régulièrement
- Vérifier les logs d'activité hebdomadairement
- Tester les sauvegardes mensuellement

### 4. Optimisation
- Analyser les alertes pour ajuster les seuils
- Réviser les coûts moyens avec les données réelles
- Adapter les intervalles de maintenance selon l'usage
- Optimiser les géofences selon les sites réels

---

## Support et Assistance

Pour toute question sur la configuration :
- **Email** : support@dariholding.gn
- **Téléphone** : +224 XX XX XX XX
- **Documentation complète** : Voir README_FINAL.md

---

## Changelog des Paramètres

### Version 1.0 (Novembre 2025)
- Ajout de tous les paramètres de base
- Configuration complète pour 11 modules
- Gestion utilisateurs intégrée
- Plus de 80 paramètres configurables
