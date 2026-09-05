# ⚡ SIGTB - Démarrage Rapide

## 🔐 Comptes et identifiants

Aucun mot de passe n'est stocké dans le dépôt. Les identifiants sont remis
par l'administrateur du système (DARI HOLDING) par un canal sécurisé.

Si vous administrez le projet Supabase :

1. Ouvrez le [Supabase Dashboard](https://supabase.com) > projet SIGTB
2. **Authentication** > **Users** : c'est ici que les mots de passe sont
   définis ou réinitialisés
3. Le compte administrateur historique (`admin@dariholding.gn`) doit avoir
   son mot de passe révoqué puis redéfini s'il a pu être exposé (voir
   [SECURITY.md](SECURITY.md))

## 🚀 Se Connecter

1. Lancez l'application (`npm run dev`)
2. Saisissez votre adresse email professionnelle et votre mot de passe
   dans le formulaire de connexion
3. En cas d'échec, contactez l'administrateur ; ne stockez jamais les
   identifiants dans le code ou la documentation

## 🔧 Créer un Nouvel Utilisateur

1. [Supabase Dashboard](https://supabase.com) > projet SIGTB
2. **Authentication** > **Users** > **Add user**
3. Cochez **"Auto Confirm User"**, choisissez un mot de passe temporaire
   communiqué au nouvel utilisateur
4. Dans **SQL Editor**, créez le profil associé :

```sql
-- Récupérer l'ID du nouvel utilisateur
SELECT id, email FROM auth.users WHERE email = 'nouveau@sigtb.gn';

-- Créer le profil (remplacez 'VOTRE-UUID' par l'ID ci-dessus)
INSERT INTO profiles (id, full_name, role, phone)
VALUES (
  'VOTRE-UUID',
  'Mohamed Camara',
  'fleet_manager',
  '+224 622 333 333'
);
```

## 📋 Rôles Disponibles

| Rôle | Description | Modules Accessibles |
|------|-------------|-------------------|
| **admin** | Administrateur | Tous |
| **director** | Directeur général | Vue d'ensemble + rapports |
| **operations_manager** | Dir. opérations | Gestion quotidienne |
| **fleet_manager** | Resp. flotte | Véhicules, chauffeurs, maintenance |
| **maintenance_chief** | Chef mécanicien | Maintenance, stock pièces |
| **logistician** | Logisticien | Planification voyages |
| **accountant** | Comptable | Facturation, finances |
| **driver** | Chauffeur | Consultation missions |

## 🆘 Problèmes Courants

### ❌ "Échec de la connexion"
1. L'utilisateur existe dans **Authentication** > **Users**
2. L'email est confirmé (ou "Auto Confirm" coché lors de la création)
3. Le mot de passe est correct (réinitialisez-le depuis le dashboard)

### ❌ Connexion OK mais aucun module accessible
Le profil n'existe pas dans la table `profiles` (ou le rôle est invalide) :

```sql
SELECT id, full_name, role FROM profiles;
```

Rôles valides : `admin`, `director`, `operations_manager`, `fleet_manager`,
`maintenance_chief`, `logistician`, `accountant`, `driver`
