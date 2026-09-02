# 🎯 GUIDE - GÉNÉRATION AUTOMATIQUE DE PAIE

## ✅ SYSTÈME 100% AUTOMATIQUE

**Aucune saisie manuelle requise !** Toutes les données sont chargées automatiquement depuis les autres modules.

---

## 🚀 COMMENT UTILISER

### Étape 1: Ouvrir le module Paie
1. Menu → **Gestion de la Paie**
2. Clic sur bouton **"Générer Paie"**

### Étape 2: Sélectionner employé et période
1. **Choisir l'employé** dans la liste déroulante
2. **Définir les dates** (début et fin de période)
3. Clic sur **"Calculer Automatiquement"** 🧮

### Étape 3: Valider et enregistrer
1. Vérifier les montants calculés
2. Choisir statut (Brouillon/En attente/Approuvé/Payé)
3. Clic sur **"Créer Fiche de Paie"**

**C'est tout !** Aucune saisie manuelle de salaire, primes ou déductions.

---

## 📊 DONNÉES CHARGÉES AUTOMATIQUEMENT

### 1️⃣ **Depuis Module EMPLOYÉS** 👤
```
✅ Salaire de base
✅ Poste/Position
✅ Nom complet
✅ Matricule
```

**Exemple** :
- Employé: DIALLO Mamadou (MAT-001)
- Poste: Chauffeur Poids Lourd
- Salaire de base: 3,000,000 GNF

---

### 2️⃣ **Depuis Module PRÉSENCES** ✓
```
✅ Jours présents
✅ Jours absents
✅ Heures travaillées totales
✅ Heures régulières (8h/jour)
✅ Heures supplémentaires
✅ Retards
```

**Calcul automatique** :
- Heures régulières = Min(heures totales, jours ouvrables × 8h)
- Heures supplémentaires = Max(0, heures totales - heures régulières)
- Taux horaire supp = Taux normal × 1.5 (150%)

**Exemple** :
- Période: 1-30 novembre 2025 (22 jours ouvrables)
- Jours présents: 21 jours
- Heures totales: 180h
- Heures régulières: 176h (22 × 8h)
- Heures supplémentaires: 4h
- Paye heures supp: 4h × 17,045 GNF/h × 1.5 = 102,270 GNF

---

### 3️⃣ **Depuis Module MISSIONS (Chauffeurs uniquement)** 🚛
```
✅ Nombre de missions complétées
✅ Prime par mission (50,000 GNF)
✅ Total primes missions
```

**Calcul automatique** :
- Prime missions = Nombre missions × 50,000 GNF

**Exemple** :
- Missions complétées: 12
- Prime par mission: 50,000 GNF
- Total primes: 12 × 50,000 = 600,000 GNF

**Affiché comme** :
```
┌─────────────────────────────────┐
│ Missions Complétées             │
├─────────────────────────────────┤
│ Nombre: 12 missions             │
│ Prime unitaire: 50,000 GNF      │
│ TOTAL: 600,000 GNF             │
└─────────────────────────────────┘
```

---

### 4️⃣ **DÉDUCTIONS AUTOMATIQUES** 💸

#### A. Sécurité Sociale (8%)
```
Calcul: Salaire de base × 8%
Exemple: 3,000,000 × 0.08 = 240,000 GNF
```

#### B. Impôts (5%)
```
Calcul: (Salaire brut - Sécurité sociale) × 5%
Exemple: (3,702,270 - 240,000) × 0.05 = 173,113 GNF
```

#### C. Pénalités Retards
```
Calcul: Nombre retards × 5,000 GNF
Exemple: 2 retards × 5,000 = 10,000 GNF
```

#### D. Déduction Absences
```
Calcul: Jours absents × Salaire journalier
Salaire journalier = Salaire de base / Jours ouvrables
Exemple: 1 absence × 136,364 GNF = 136,364 GNF
```

---

## 🧮 FORMULE DE CALCUL COMPLÈTE

### Étape par étape :

#### 1. **Salaire Brut**
```
= Salaire de base
+ Heures supplémentaires
+ Primes missions
```

**Exemple** :
```
= 3,000,000 GNF (base)
+ 102,270 GNF (4h supp)
+ 600,000 GNF (12 missions)
= 3,702,270 GNF
```

#### 2. **Déductions Totales**
```
= Sécurité sociale (8%)
+ Impôts (5%)
+ Pénalités retards
+ Absences
```

**Exemple** :
```
= 240,000 GNF (sécurité sociale)
+ 173,113 GNF (impôts)
+ 10,000 GNF (2 retards)
+ 136,364 GNF (1 absence)
= 559,477 GNF
```

#### 3. **Salaire Net**
```
= Salaire Brut - Déductions Totales
```

**Exemple** :
```
= 3,702,270 GNF - 559,477 GNF
= 3,142,793 GNF
```

---

## 📱 INTERFACE UTILISATEUR

### Écran de calcul automatique :

```
┌───────────────────────────────────────────────┐
│ Étape 1: Sélectionner employé et période     │
├───────────────────────────────────────────────┤
│ Employé: [DIALLO Mamadou (Chauffeur)      ▼] │
│ Début:   [2025-11-01]  Fin: [2025-11-30]     │
│ [🧮 Calculer Automatiquement]                 │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ ✓ Présences & Heures (module Attendance)     │
├───────────────────────────────────────────────┤
│ Jours présents: 21      Jours ouvrables: 22  │
│ Heures régulières: 176h  Heures supp: 4h     │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ 🚛 Missions Complétées (module Trips)        │
├───────────────────────────────────────────────┤
│ Nombre de missions: 12                        │
│ Prime par mission: 50,000 GNF                 │
│ TOTAL PRIMES: 600,000 GNF                     │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ 💰 Calcul du Salaire                          │
├───────────────────────────────────────────────┤
│ Salaire de base:         3,000,000 GNF        │
│ Heures supplémentaires:    102,270 GNF        │
│ Primes missions:           600,000 GNF        │
│ Déductions totales:       -559,477 GNF        │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ SALAIRE NET À PAYER                           │
│ 3,142,793 GNF                                 │
└───────────────────────────────────────────────┘
```

---

## 🎨 COULEURS & AFFICHAGE

### Codes couleurs :
- 🟢 **Vert** : Primes, missions, salaire net
- 🟠 **Orange** : Heures supplémentaires
- 🔴 **Rouge** : Déductions, absences, retards
- 🔵 **Bleu** : Informations générales
- ⚫ **Gris** : Salaire de base

### Badges statut :
- 📝 **Brouillon** (gris) : En cours d'édition
- ⏳ **En attente** (orange) : Attend approbation
- ✅ **Approuvé** (bleu) : Validé, prêt à payer
- 💰 **Payé** (vert) : Paiement effectué

---

## 📝 NOTES DE CALCUL AUTOMATIQUES

Chaque fiche de paie inclut des notes explicatives :

**Exemple de note** :
```
Salaire de base: 3000000 GNF | Heures supp: 4h × 25568 = 102270 GNF
| Missions: 12 × 50000 = 600000 GNF | Jours présents: 21/22
| Absences: -136364 GNF | Retards: -10000 GNF
```

Ces notes sont automatiquement générées et enregistrées.

---

## ⚙️ FONCTION SQL BACKEND

La magie opère via la fonction PostgreSQL :

```sql
calculate_employee_payroll(
  employee_id UUID,
  period_start DATE,
  period_end DATE
)
```

### Ce qu'elle fait :
1. ✅ Charge salaire de base depuis `employees`
2. ✅ Compte présences depuis `employee_attendance`
3. ✅ Calcule heures supplémentaires
4. ✅ Compte missions complétées depuis `trips`
5. ✅ Calcule toutes les déductions
6. ✅ Retourne résultat JSON complet

### Structure retournée :
```json
{
  "employee": { "id", "name", "number", "position" },
  "period": { "start", "end", "working_days" },
  "attendance": { "days_present", "overtime_hours", ... },
  "missions": { "completed_trips", "total_bonus", ... },
  "salary": { "base", "overtime_pay", "gross", ... },
  "deductions": { "social_security", "tax", ... },
  "final": { "net_salary" }
}
```

---

## 🔄 WORKFLOW COMPLET

```
1. USER: Sélectionne employé + période
          ↓
2. CLICK: "Calculer Automatiquement"
          ↓
3. SQL: Fonction calculate_employee_payroll()
          ├─→ Query employees table
          ├─→ Query employee_attendance table
          ├─→ Query trips table (if driver)
          └─→ Calculate all values
          ↓
4. FRONTEND: Affiche résultats détaillés
          ├─→ Présences & heures
          ├─→ Missions (si chauffeur)
          ├─→ Salaire brut
          ├─→ Déductions
          └─→ Salaire net
          ↓
5. USER: Vérifie et valide
          ↓
6. SAVE: Enregistre dans payroll_records
          ├─→ + payroll_bonuses
          └─→ + payroll_deductions
```

---

## 💡 AVANTAGES

### ✅ Gain de temps
- **Avant** : 15 minutes par fiche (saisie manuelle)
- **Maintenant** : 30 secondes (3 clics)
- **Pour 99 employés** : Économie de 24 heures !

### ✅ Zéro erreur
- Aucun oubli de prime
- Aucune erreur de calcul
- Déductions exactes

### ✅ Traçabilité complète
- Notes de calcul automatiques
- Détails de chaque élément
- Source des données visible

### ✅ Transparence
- Employé voit d'où viennent les chiffres
- "12 missions × 50,000 = 600,000 GNF"
- Pas de surprise, tout est clair

---

## 📊 EXEMPLE COMPLET RÉEL

### Chauffeur : DIALLO Mamadou
**Période** : 1-30 novembre 2025

#### Données sources :
- **Employees** : Salaire base 3,000,000 GNF
- **Attendance** : 21 jours présents / 22 ouvrables, 180h travaillées, 2 retards
- **Trips** : 12 missions complétées

#### Calcul automatique :
```
SALAIRE BRUT
├─ Base:             3,000,000 GNF
├─ Heures supp (4h):   102,270 GNF
└─ Missions (12):      600,000 GNF
                     ─────────────
                     3,702,270 GNF

DÉDUCTIONS
├─ Sécurité sociale:  -240,000 GNF
├─ Impôts:            -173,113 GNF
├─ Retards (2):        -10,000 GNF
└─ Absences (1j):     -136,364 GNF
                     ─────────────
                      -559,477 GNF

SALAIRE NET          3,142,793 GNF
```

#### Temps requis :
- ⏱️ Sélection employé : 5 secondes
- ⏱️ Sélection période : 5 secondes
- ⏱️ Calcul automatique : 2 secondes
- ⏱️ Validation : 10 secondes
- **TOTAL : 22 secondes**

---

## 🎯 CAS D'USAGE

### Cas 1 : Employé administratif (pas de missions)
- ✅ Salaire de base chargé
- ✅ Présences comptées
- ✅ Heures supp calculées
- ❌ Pas de primes missions (non chauffeur)
- ✅ Déductions appliquées

### Cas 2 : Chauffeur avec beaucoup de missions
- ✅ Salaire de base chargé
- ✅ Présences comptées
- ✅ Heures supp calculées
- ✅ **15 missions = 750,000 GNF de primes !**
- ✅ Déductions appliquées

### Cas 3 : Employé avec absences
- ✅ Salaire de base chargé
- ✅ 5 absences détectées
- ✅ Déduction automatique : 5 × salaire journalier
- ✅ Montant exact calculé
- ✅ Affiché clairement

---

## 🏆 RÉSULTAT FINAL

**AVANT (Manuel)** :
```
❌ Saisir salaire manuellement
❌ Compter les missions à la main
❌ Calculer les heures supp
❌ Calculer les déductions
❌ Risque d'erreur
❌ 15 minutes par employé
❌ Notes incomplètes
```

**MAINTENANT (Automatique)** :
```
✅ Tout chargé automatiquement
✅ Missions comptées par SQL
✅ Heures supp calculées précisément
✅ Déductions exactes
✅ Zéro erreur
✅ 30 secondes par employé
✅ Notes complètes générées
```

---

## 📞 SUPPORT

Si une donnée semble incorrecte :

1. **Vérifier module source** :
   - Présences → Module Attendance
   - Missions → Module Trips
   - Salaire base → Module Employees

2. **Corriger à la source** :
   - Les corrections se reflètent immédiatement
   - Recalculer la paie après correction

3. **Recalculer** :
   - Ouvrir la fiche de paie
   - Clic "Calculer Automatiquement" à nouveau
   - Nouvelles données chargées

---

## 🎉 CONCLUSION

**Le système de paie est maintenant 100% automatique !**

- ✅ Sélectionner employé + période
- ✅ Clic "Calculer"
- ✅ Valider
- ✅ Terminé !

**Aucune saisie manuelle. Aucune erreur. Gain de temps colossal !**
