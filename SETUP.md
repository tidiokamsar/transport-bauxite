# Configuration SIGTB - Guide Complet

## ⚠️ IMPORTANT: Création des utilisateurs de démonstration

**Le message "Invalid login credentials" signifie que les utilisateurs n'existent pas encore dans Supabase Auth.**

Les utilisateurs de démonstration doivent être créés manuellement dans Supabase Auth car la création d'utilisateurs via SQL n'est pas supportée. Cette procédure prend environ 5 minutes.

## 🚀 Configuration en 3 Étapes Simples

### Étape 1: Accéder au Dashboard Supabase

1. Connectez-vous à [https://supabase.com](https://supabase.com)
2. Sélectionnez votre projet SIGTB
3. Allez dans **Authentication** > **Users**
4. Gardez cette fenêtre ouverte

### Étape 2: Créer les 7 Utilisateurs (Copier-Coller Rapide)

Pour chaque utilisateur ci-dessous, cliquez sur **Add user** > **Create new user** et:
- ✅ **Cochez "Auto Confirm User"** (IMPORTANT!)
- ✅ Copiez-collez l'email et le mot de passe
- ✅ Cliquez sur "Create user"

#### 👤 Utilisateur 1: Administrateur
- **Email**: `admin@sigtb.gn`
- **Password**: `admin123`
- **Auto Confirm User**: ✅ OUI (important!)

#### 👤 Utilisateur 2: Manager
- **Email**: `manager@sigtb.gn`
- **Password**: `manager123`
- **Auto Confirm User**: ✅ OUI

#### 👤 Utilisateur 3: Responsable de Flotte
- **Email**: `fleet@sigtb.gn`
- **Password**: `fleet123`
- **Auto Confirm User**: ✅ OUI

#### 👤 Utilisateur 4: Dispatcher
- **Email**: `dispatcher@sigtb.gn`
- **Password**: `dispatch123`
- **Auto Confirm User**: ✅ OUI

#### 👤 Utilisateur 5: Mécanicien
- **Email**: `mechanic@sigtb.gn`
- **Password**: `mechanic123`
- **Auto Confirm User**: ✅ OUI

#### 👤 Utilisateur 6: Comptable
- **Email**: `accountant@sigtb.gn`
- **Password**: `account123`
- **Auto Confirm User**: ✅ OUI

#### 👤 Utilisateur 7: Responsable RH
- **Email**: `hr@sigtb.gn`
- **Password**: `hr123`
- **Auto Confirm User**: ✅ OUI

### 3. Créer les profils correspondants

Allez dans **Table Editor** > **profiles** et pour CHAQUE utilisateur créé:

1. Cliquez sur **Insert** > **Insert row**
2. Copiez l'UUID de l'utilisateur depuis **Authentication** > **Users**
3. Remplissez les champs:

**Profile Admin:**
```
id: [UUID de admin@sigtb.gn]
full_name: Abdoulaye Diallo
role: admin
phone: +224 622 111 111
department: Direction
```

**Profile Manager:**
```
id: [UUID de manager@sigtb.gn]
full_name: Fatoumata Sow
role: manager
phone: +224 622 222 222
department: Operations
```

**Profile Fleet Manager:**
```
id: [UUID de fleet@sigtb.gn]
full_name: Mohamed Camara
role: fleet_manager
phone: +224 622 333 333
department: Flotte
```

**Profile Dispatcher:**
```
id: [UUID de dispatcher@sigtb.gn]
full_name: Ibrahim Bah
role: dispatcher
phone: +224 622 444 444
department: Operations
```

**Profile Mechanic:**
```
id: [UUID de mechanic@sigtb.gn]
full_name: Thierno Diakité
role: mechanic
phone: +224 622 666 666
department: Maintenance
```

**Profile Accountant:**
```
id: [UUID de accountant@sigtb.gn]
full_name: Kadiatou Condé
role: accountant
phone: +224 622 888 888
department: Finance
```

**Profile HR Manager:**
```
id: [UUID de hr@sigtb.gn]
full_name: Mariama Keita
role: hr_manager
phone: +224 622 999 999
department: Ressources Humaines
```

### Étape 3: Créer les Profils Automatiquement

Après avoir créé les 7 utilisateurs, allez dans **SQL Editor** et exécutez ce script:

```sql
-- Récupérer les IDs des utilisateurs et créer les profils
DO $$
DECLARE
  admin_id uuid;
  manager_id uuid;
  fleet_id uuid;
  dispatcher_id uuid;
  mechanic_id uuid;
  accountant_id uuid;
  hr_id uuid;
BEGIN
  -- Récupérer les IDs depuis auth.users
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@sigtb.gn';
  SELECT id INTO manager_id FROM auth.users WHERE email = 'manager@sigtb.gn';
  SELECT id INTO fleet_id FROM auth.users WHERE email = 'fleet@sigtb.gn';
  SELECT id INTO dispatcher_id FROM auth.users WHERE email = 'dispatcher@sigtb.gn';
  SELECT id INTO mechanic_id FROM auth.users WHERE email = 'mechanic@sigtb.gn';
  SELECT id INTO accountant_id FROM auth.users WHERE email = 'accountant@sigtb.gn';
  SELECT id INTO hr_id FROM auth.users WHERE email = 'hr@sigtb.gn';

  -- Insérer les profils
  INSERT INTO profiles (id, full_name, role, phone, department) VALUES
    (admin_id, 'Abdoulaye Diallo', 'admin', '+224 622 111 111', 'Direction'),
    (manager_id, 'Fatoumata Sow', 'manager', '+224 622 222 222', 'Operations'),
    (fleet_id, 'Mohamed Camara', 'fleet_manager', '+224 622 333 333', 'Flotte'),
    (dispatcher_id, 'Ibrahim Bah', 'dispatcher', '+224 622 444 444', 'Operations'),
    (mechanic_id, 'Thierno Diakité', 'mechanic', '+224 622 666 666', 'Maintenance'),
    (accountant_id, 'Kadiatou Condé', 'accountant', '+224 622 888 888', 'Finance'),
    (hr_id, 'Mariama Keita', 'hr_manager', '+224 622 999 999', 'Ressources Humaines')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    department = EXCLUDED.department;

  RAISE NOTICE 'Profils créés avec succès!';
END $$;
```

---

## ✅ Vérification et Test

### Méthode 1: Via SQL (Rapide)
Exécutez dans **SQL Editor**:
```sql
SELECT * FROM demo_users_status;
```

Vous devriez voir les 7 utilisateurs avec le statut "Ready".

### Méthode 2: Via l'Application
1. Retournez sur la page de connexion SIGTB
2. Cliquez sur "Voir les comptes de démonstration"
3. Vous devriez voir 7 cartes de profils colorées
4. Cliquez sur une carte pour vous connecter
5. ✅ **Succès!** Vous êtes maintenant connecté

### Méthode 3: Vérification Manuelle
Dans **Table Editor** > **profiles**, vous devriez voir 7 lignes avec les rôles:
- admin
- manager
- fleet_manager
- dispatcher
- mechanic
- accountant
- hr_manager

## 🔐 Rôles et Accès

| Rôle | Identifiants | Modules Accessibles |
|------|-------------|-------------------|
| **Admin** | admin@sigtb.gn / admin123 | Tous les modules |
| **Manager** | manager@sigtb.gn / manager123 | Véhicules, Chauffeurs, Voyages, Carburant, Maintenance, Rapports |
| **Fleet Manager** | fleet@sigtb.gn / fleet123 | Véhicules, Chauffeurs, Maintenance, GPS |
| **Dispatcher** | dispatcher@sigtb.gn / dispatch123 | Voyages, Carburant, Dashboard |
| **Mechanic** | mechanic@sigtb.gn / mechanic123 | Maintenance, Stock, Véhicules (lecture) |
| **Accountant** | accountant@sigtb.gn / account123 | Facturation, Coûts, Rapports |
| **HR Manager** | hr@sigtb.gn / hr123 | Employés, Présences, Paie |

## 🗄️ Données de Démonstration

Les migrations ont automatiquement généré:
- ✅ 15 véhicules (Volvo, Mercedes, MAN, Scania)
- ✅ 20 chauffeurs avec noms guinéens réalistes
- ✅ 15 employés dans différents départements
- ✅ 50 voyages avec données complètes
- ✅ 6 fournisseurs (TotalEnergies, Michelin, Bosch, etc.)
- ✅ 4 entrepôts (Principal, Garage, Station, Dépôt)
- ✅ 6 catégories de stock
- ✅ 5 articles en stock
- ✅ 3 clients majeurs (CBG, SMB, AMR)
- ✅ 5 géofences (mines, ports, dépôts)
- ✅ 8 catégories de coûts

## 🚀 Démarrage Rapide

1. **Créer les 7 utilisateurs** dans Supabase Auth (cocher "Auto Confirm")
2. **Exécuter le script SQL** ci-dessus pour créer les profils
3. **Rafraîchir la page de connexion**
4. **Cliquer sur un profil** pour se connecter
5. **Explorer les modules** selon votre rôle

## 🎯 Permissions par Module

### Admin (Tous accès)
- ✅ Création, modification, suppression, approbation sur tous les modules

### Manager
- ✅ Vue: Dashboard, Véhicules, Chauffeurs, Voyages, Carburant, Maintenance, Rapports
- ✅ Actions: Créer, modifier, approuver

### Fleet Manager
- ✅ Vue: Véhicules, Chauffeurs, Maintenance, GPS
- ✅ Actions: Gestion complète de la flotte

### Dispatcher
- ✅ Vue: Voyages, Carburant, Dashboard
- ✅ Actions: Planifier et suivre les missions

### Mechanic
- ✅ Vue: Maintenance, Stock, Véhicules (lecture seule)
- ✅ Actions: Créer et modifier les réparations

### Accountant
- ✅ Vue: Facturation, Coûts, Rapports
- ✅ Actions: Gestion financière complète

### HR Manager
- ✅ Vue: Employés, Présences, Paie
- ✅ Actions: Gestion RH complète

## 📞 Dépannage

### Problème: "Invalid login credentials"
- **Solution**: Les utilisateurs n'ont pas été créés dans Supabase Auth
- Suivez les étapes 1 et 2 ci-dessus

### Problème: Connexion réussie mais erreur de profil
- **Solution**: Le profil n'existe pas dans la table `profiles`
- Suivez l'étape 3 ou exécutez le script SQL de l'étape 4

### Problème: Modules ne s'affichent pas
- **Solution**: Vérifiez que le rôle dans la table `profiles` correspond exactement aux rôles définis
- Rôles valides: `admin`, `manager`, `fleet_manager`, `dispatcher`, `mechanic`, `accountant`, `hr_manager`

## 📚 Documentation Technique

### Architecture
- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Sécurité**: Row Level Security (RLS) sur toutes les tables
- **Permissions**: Système granulaire basé sur les rôles

### Tables Principales (34 au total)
- Profils et permissions
- Parc automobile (véhicules, pneus, documents)
- Personnel (chauffeurs, employés)
- Opérations (voyages, GPS, géofencing)
- Approvisionnement (carburant, maintenance, stock)
- Finance (factures, coûts, paie)
- Analytics (alertes, notifications, rapports)

## 🎓 Pour aller plus loin

Consultez la documentation Supabase:
- [Authentication](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
