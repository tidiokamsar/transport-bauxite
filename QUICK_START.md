# ⚡ SIGTB - Connexion Immédiate !

## ✅ 2 Comptes Déjà Disponibles

Le système dispose de **2 comptes fonctionnels** prêts à l'emploi :

### 🛡️ Compte Administrateur
- **Email**: `admin@sigtb.gn`
- **Mot de passe**: `admin123`
- **Accès**: Tous les modules du système

### 👤 Compte Logisticien
- **Email**: `bah@sigtb.gn`
- **Mot de passe**: `bah123`
- **Accès**: Planification et suivi des voyages

---

## 🚀 Se Connecter (10 secondes)

1. Ouvrez l'application SIGTB
2. Vous verrez **2 cartes colorées** sur la page de connexion
3. Cliquez sur l'une d'elles
4. ✅ **Vous êtes connecté !**

Ou utilisez le formulaire classique avec les identifiants ci-dessus.

---

## 🎯 Tester le Système

### Compte Admin
- Connectez-vous avec `admin@sigtb.gn`
- Explorez **tous les 12 modules**
- Créez des véhicules, chauffeurs, voyages, etc.

### Compte Logisticien
- Connectez-vous avec `bah@sigtb.gn`
- Accès restreint aux modules logistiques
- Testez le système de permissions

---

## 🔧 Ajouter Plus d'Utilisateurs (Optionnel)

Si vous souhaitez tester d'autres rôles disponibles :
- `director` - Directeur général
- `operations_manager` - Directeur des opérations
- `fleet_manager` - Responsable de flotte
- `maintenance_chief` - Chef mécanicien
- `accountant` - Comptable
- `driver` - Chauffeur

### Procédure Rapide (3 minutes)

#### Étape 1: Créer un Utilisateur

1. Allez sur [Supabase Dashboard](https://supabase.com)
2. Ouvrez votre projet SIGTB
3. **Authentication** > **Users** > **Add user**
4. ✅ Cochez **"Auto Confirm User"**
5. Entrez email et mot de passe (ex: `fleet@sigtb.gn` / `fleet123`)

#### Étape 2: Créer le Profil

Dans **SQL Editor**, exécutez (remplacez l'ID):

```sql
-- Récupérer l'ID du nouvel utilisateur
SELECT id, email FROM auth.users WHERE email = 'fleet@sigtb.gn';

-- Créer le profil (remplacez 'VOTRE-UUID' par l'ID ci-dessus)
INSERT INTO profiles (id, full_name, role, phone)
VALUES (
  'VOTRE-UUID',
  'Mohamed Camara',
  'fleet_manager',
  '+224 622 333 333'
);
```

#### Étape 3: Se Connecter

Retournez sur SIGTB et connectez-vous avec le nouveau compte !

---

## 📋 Rôles Disponibles

| Rôle | Description | Modules Accessibles |
|------|-------------|-------------------|
| **admin** | Administrateur | Tous (12 modules) |
| **director** | Directeur général | Vue d'ensemble + rapports |
| **operations_manager** | Dir. opérations | Gestion quotidienne |
| **fleet_manager** | Resp. flotte | Véhicules, chauffeurs, maintenance |
| **maintenance_chief** | Chef mécanicien | Maintenance, stock pièces |
| **logistician** | Logisticien | Planification voyages |
| **accountant** | Comptable | Facturation, finances |
| **driver** | Chauffeur | Consultation missions |

---

## 🆘 Problèmes Courants

### ❌ "Invalid login credentials"
**Solution**: Vérifiez que:
1. L'utilisateur existe dans **Authentication** > **Users**
2. L'email est confirmé (ou "Auto Confirm" coché lors de la création)
3. Le mot de passe est correct

### ❌ "No profile found"
**Solution**: Le profil n'existe pas dans la table `profiles`.
Exécutez dans SQL Editor:
```sql
SELECT * FROM auth.users WHERE email = 'votre@email.com';
-- Notez l'ID, puis créez le profil
```

### ❌ Page blanche après connexion
**Solution**: Vérifiez que le rôle dans `profiles` est valide:
```sql
SELECT id, full_name, role FROM profiles;
```

Rôles valides: `admin`, `director`, `operations_manager`, `fleet_manager`, `maintenance_chief`, `logistician`, `accountant`, `driver`

---

## ✅ Vérification Rapide

Pour vérifier l'état des comptes, exécutez dans **SQL Editor**:

```sql
-- Voir tous les utilisateurs et leurs profils
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL as confirmed,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email LIKE '%@sigtb.gn'
ORDER BY u.email;
```

Vous devriez voir au minimum 2 lignes (admin et bah) avec `confirmed = true` et un rôle défini.

---

## 📚 Documentation Complète

- **README.md** - Vue d'ensemble du projet et architecture
- **SETUP.md** - Guide détaillé avec scripts SQL
- **Supabase Docs** - [supabase.com/docs](https://supabase.com/docs)

---

## 💡 Astuce Pro

Une fois connecté, regardez la **sidebar gauche**.

Les modules affichés dépendent de votre rôle :
- **Admin** voit **12 sections** (Dashboard, Véhicules, Chauffeurs, Voyages, GPS, Carburant, Maintenance, Pneus, Stock, Fournisseurs, Factures, RH)
- **Logisticien** voit environ **4-5 sections** (Dashboard, Voyages, Suivi, Rapports limités)

C'est le système de **Row Level Security** en action ! 🎯

---

<div align="center">

## 🚀 Prêt à Explorer SIGTB !

**Commencez maintenant** avec `admin@sigtb.gn` / `admin123`

</div>
