# 🚛 SIGTB - Système Intégré de Gestion du Transport de Bauxite

> Plateforme complète de gestion de flotte pour le transport de bauxite en Guinée

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![React](https://img.shields.io/badge/React-18.3-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)]()
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)]()

---

## 🎯 Aperçu Rapide

SIGTB est une solution complète de gestion de transport comprenant:

- ✅ **13 Modules Principaux** + 23 sous-modules
- ✅ **7 Rôles Utilisateurs** avec permissions granulaires
- ✅ **34 Tables Database** avec Row Level Security
- ✅ **Données de Démonstration** réalistes pré-chargées
- ✅ **Interface Moderne** responsive et intuitive

---

## ⚡ Démarrage Ultra-Rapide (5 minutes)

### Vous voyez l'erreur "Invalid login credentials" ?

**C'est normal !** Les utilisateurs démo doivent être créés. Suivez ces 3 étapes:

### 📝 Étape 1: Créer les Utilisateurs (2 min)

Allez sur [Supabase Dashboard](https://supabase.com) > **Authentication** > **Users**

Créez ces 7 utilisateurs (**Cochez "Auto Confirm User"** !):

```
1. admin@sigtb.gn         / admin123
2. manager@sigtb.gn       / manager123
3. fleet@sigtb.gn         / fleet123
4. dispatcher@sigtb.gn    / dispatch123
5. mechanic@sigtb.gn      / mechanic123
6. accountant@sigtb.gn    / account123
7. hr@sigtb.gn            / hr123
```

### 🔧 Étape 2: Créer les Profils (1 min)

Allez dans **SQL Editor** et exécutez:

```sql
SELECT * FROM setup_demo_profiles();
```

### ✅ Étape 3: Connexion

Retournez sur l'application SIGTB et cliquez sur un profil pour vous connecter !

---

## 📚 Documentation Complète

Pour plus de détails, consultez **[SETUP.md](./SETUP.md)** qui contient:
- Instructions détaillées pas-à-pas
- Scripts SQL complets
- Guide de dépannage
- Documentation des permissions

---

## 🎭 Les 7 Profils Utilisateurs

| Profil | Email | Rôle | Accès Principal |
|--------|-------|------|-----------------|
| 🛡️ **Admin** | admin@sigtb.gn | Administrateur | Tous les modules |
| 💼 **Manager** | manager@sigtb.gn | Directrice Ops | Gestion quotidienne |
| 🚛 **Fleet Manager** | fleet@sigtb.gn | Resp. Flotte | Véhicules & Maintenance |
| 📋 **Dispatcher** | dispatcher@sigtb.gn | Dispatcher | Planification voyages |
| 🔧 **Mechanic** | mechanic@sigtb.gn | Mécanicien | Réparations & Stock |
| 💰 **Accountant** | accountant@sigtb.gn | Comptable | Finance & Facturation |
| 👔 **HR Manager** | hr@sigtb.gn | Resp. RH | Personnel & Paie |

---

## 🏗️ Architecture Technique

### Stack Technologique
- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Icons**: Lucide React
- **Build**: Vite 5

### Modules Implémentés

#### 📊 Gestion Opérationnelle
- Dashboard temps réel avec KPIs
- Gestion du parc automobile (véhicules, pneus, documents)
- Gestion des chauffeurs
- Planification et suivi des voyages
- GPS tracking et géofencing
- Historique des trajets

#### ⛽ Approvisionnement
- Gestion du carburant (stock, distribution)
- Capteurs IoT (infrastructure prête)
- Inventaire des pièces détachées
- Bons de commande
- Gestion des fournisseurs

#### 🔧 Maintenance
- Ordres de réparation
- Maintenance préventive
- Gestion des pièces
- Historique des interventions

#### 💼 Finance & Administration
- Facturation clients
- Suivi des coûts d'exploitation
- Gestion des employés
- Présences et absences
- Paie et bulletins de salaire

#### 📈 Analytics & Rapports
- Rapports de production
- Analyses de consommation
- Tableaux de bord personnalisés
- Export PDF/Excel

---

## 🗄️ Base de Données (34 Tables)

### Principales Tables
```
✓ profiles              - Profils utilisateurs avec rôles
✓ role_permissions      - Système de permissions
✓ vehicles              - Parc automobile (15 véhicules démo)
✓ drivers               - Chauffeurs (20 démo)
✓ trips                 - Voyages (50 démo)
✓ vehicle_tracking      - Télémétrie GPS
✓ geofences            - Zones géographiques (5 démo)
✓ fuel_stock           - Stock carburant
✓ fuel_transactions    - Distributions
✓ maintenance_orders   - Ordres de réparation
✓ tires                - Gestion des pneus
✓ stock_items          - Inventaire pièces
✓ suppliers            - Fournisseurs (6 démo)
✓ purchase_orders      - Bons de commande
✓ customers            - Clients (3 démo)
✓ invoices             - Factures
✓ expenses             - Dépenses
✓ employees            - Employés (15 démo)
✓ attendance           - Présences
✓ payroll              - Bulletins de paie
... et 14 autres tables
```

---

## 🔐 Sécurité

### Row Level Security (RLS)
- ✅ Activé sur toutes les 34 tables
- ✅ Policies restrictives par défaut
- ✅ Contrôle d'accès basé sur les rôles
- ✅ Vérification auth.uid() sur chaque requête

### Permissions Granulaires
Chaque rôle dispose de permissions spécifiques:
- `can_view` - Visualisation
- `can_create` - Création
- `can_edit` - Modification
- `can_delete` - Suppression
- `can_approve` - Approbation

---

## 📦 Installation & Développement

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Supabase

### Installation Locale
```bash
# Cloner le projet
git clone [votre-repo]
cd sigtb

# Installer les dépendances
npm install

# Configurer .env (voir .env.example)
VITE_SUPABASE_URL=votre_url
VITE_SUPABASE_ANON_KEY=votre_key

# Démarrer en développement
npm run dev

# Build production
npm run build
```

---

## 🎯 Données de Démonstration

Le système est pré-chargé avec des données réalistes:

- **15 Véhicules**: Volvo FMX, Mercedes Actros, MAN TGS, Scania R730
- **20 Chauffeurs**: Noms guinéens authentiques
- **15 Employés**: Répartis dans 4 départements
- **50 Voyages**: Entre mines, ports et dépôts
- **6 Fournisseurs**: TotalEnergies, Michelin, Bosch, etc.
- **3 Clients**: CBG, SMB, AMR
- **5 Géofences**: Mines, ports, dépôts
- **8 Catégories de coûts**: Classification complète

---

## 🚀 Fonctionnalités Clés

### Interface Adaptative
Chaque utilisateur voit une interface différente selon son rôle. La navigation s'adapte automatiquement pour n'afficher que les modules autorisés.

### Temps Réel
- Tracking GPS des véhicules
- Alertes automatiques
- Notifications push
- Mise à jour instantanée des données

### Multi-Langues
- Interface en français
- Support d'autres langues préparé

### Responsive Design
- Desktop, tablette, mobile
- Design moderne et professionnel
- Accessibilité optimisée

---

## 📞 Support & Contribution

### Documentation
- **Guide Complet**: [SETUP.md](./SETUP.md)
- **Architecture**: Voir section Architecture ci-dessus
- **API Docs**: Documentation Supabase intégrée

### Dépannage Courant

**Problème**: "Invalid login credentials"
- **Solution**: Créer les utilisateurs dans Supabase Auth (voir Étape 1)

**Problème**: Modules ne s'affichent pas
- **Solution**: Vérifier que le profil existe avec le bon rôle

**Problème**: Erreur de permissions
- **Solution**: Exécuter `SELECT * FROM demo_users_status;` pour diagnostiquer

---

## 🎓 Formation & Déploiement

### Prochaines Étapes Recommandées

1. **Intégration GPS Réelle**: Connecter Traccar/Wialon
2. **Capteurs IoT**: Implémenter MQTT pour le carburant
3. **Application Mobile**: Version pour les chauffeurs
4. **BI & Analytics**: Tableaux de bord Power BI
5. **Export Automatique**: PDF des rapports
6. **Notifications SMS**: Intégration service SMS
7. **Backup Automatique**: Système de sauvegarde

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

---

## 🙏 Remerciements

Développé pour optimiser la gestion du transport de bauxite en Guinée.

**Technologies utilisées**:
- React Team
- Supabase Team
- TailwindCSS
- Lucide Icons
- Vite

---

## 📬 Contact

Pour toute question ou support:
- 📧 Email: support@sigtb.gn
- 🌐 Web: [Votre site]
- 📱 Tél: +224 XXX XXX XXX

---

<div align="center">

**⭐ Si ce projet vous aide, n'oubliez pas de mettre une étoile ! ⭐**

Made with ❤️ in Guinea 🇬🇳

</div>
