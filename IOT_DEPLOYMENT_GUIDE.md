# 📡 GUIDE DE DÉPLOIEMENT IoT - CAPTEURS CARBURANT & GPS
## DARI HOLDING - Infrastructure Temps Réel

---

## 🎯 OBJECTIFS

Déployer un système complet de collecte de données temps réel pour :
- **Suivi GPS** : Position, vitesse, itinéraires
- **Monitoring carburant** : Niveau, consommation, anomalies
- **Télémétrie** : État véhicules, maintenance prédictive

---

## 🛠 MATÉRIEL RECOMMANDÉ

### **1. CAPTEURS GPS (par véhicule)**

#### **Teltonika FMB140** (Recommandé)
- **Prix** : ~150-200 USD
- **Features** :
  - GPS haute précision (2.5m)
  - Accéléromètre 3 axes
  - Batterie backup 380mAh
  - Bluetooth 4.0
  - 2G/3G/4G
  - Entrées digitales/analogiques
  - IP67 waterproof

#### **Alternative : Queclink GV300**
- **Prix** : ~120-150 USD
- Bonnes performances
- Support 2G/3G/4G

#### **Spécifications minimales** :
- ✅ GPS précision < 5m
- ✅ Update rate : 30 secondes minimum
- ✅ GSM/GPRS ou 3G/4G
- ✅ Alimentation 12V/24V
- ✅ Batterie backup
- ✅ IP67 (étanche)
- ✅ Température -40°C à +85°C

---

### **2. CAPTEURS CARBURANT (par véhicule)**

#### **Omnicomm LLS 20160** (Recommandé)
- **Prix** : ~250-350 USD
- **Features** :
  - Sonde capacitive haute précision
  - Longueur 160-2000mm
  - Précision ±1-2mm
  - Interface RS-485
  - Température -40°C à +85°C
  - Calibration automatique

#### **Alternative : Escort TD-120**
- **Prix** : ~200-280 USD
- Bonne fiabilité
- Calibration facile

#### **Spécifications minimales** :
- ✅ Précision ± 2%
- ✅ Longueur adaptée réservoir (160-200cm)
- ✅ Interface numérique (RS-485/CAN)
- ✅ Anti-vol / anti-fraude
- ✅ Résistant carburant/vibrations
- ✅ IP68 (immergeable)

---

### **3. UNITÉ TÉLÉMATIQUE (si non intégrée GPS)**

#### **CalAmp LMU-5530** (Optionnel)
- Hub central pour tous capteurs
- Connexion multiple capteurs
- Prix : ~180-250 USD

---

## 📦 QUANTITÉS ET BUDGET

| Équipement | Quantité | Prix unitaire | Total |
|------------|----------|---------------|-------|
| **Tracker GPS Teltonika FMB140** | 4 véhicules | 175 USD | 700 USD |
| **Capteur fuel Omnicomm LLS** | 4 véhicules | 300 USD | 1,200 USD |
| **Cartes SIM M2M (data)** | 4 véhicules | 5 USD/mois | 20 USD/mois |
| **Installation par véhicule** | 4 véhicules | 150 USD | 600 USD |
| **Calibration capteurs** | 4 véhicules | 50 USD | 200 USD |
| **Câblage et accessoires** | 4 véhicules | 80 USD | 320 USD |

### **TOTAL INVESTISSEMENT** : ~3,020 USD
### **COÛT RÉCURRENT** : ~20 USD/mois (cartes SIM)

---

## 🔧 INSTALLATION PHYSIQUE

### **ÉTAPE 1 : Préparation (par véhicule)**

1. **Audit véhicule** :
   - Identifier emplacement GPS (toit/tableau bord)
   - Mesurer réservoir carburant
   - Vérifier accès batterie 12/24V
   - Planifier passage câbles

2. **Outils nécessaires** :
   - Perceuse + mèches
   - Tournevis
   - Multimètre
   - Sertisseuse câbles
   - Ruban isolant
   - Colliers de serrage
   - Silicone étanche

---

### **ÉTAPE 2 : Installation GPS**

#### **Montage physique** :
```
1. Position antenne GPS :
   - Toit cabine (idéal)
   - Tableau de bord (acceptable)
   - Éviter surfaces métalliques
   - Vue dégagée ciel

2. Boîtier tracker :
   - Sous tableau de bord
   - Protégé de l'eau
   - Accès câblage facile
   - Éloigné moteur (chaleur)
```

#### **Connexions électriques** :
```
Câble ROUGE    → +12V permanent (batterie)
Câble NOIR     → Masse (châssis)
Câble ORANGE   → +12V après contact (optionnel)
Câble BLANC    → Entrée digitale (porte, etc.)
```

#### **Sécurité** :
- Fusible 2A sur +12V
- Câbles protégés gaine
- Fixation solide anti-vibrations
- Test avant finalisation

---

### **ÉTAPE 3 : Installation Capteur Carburant**

#### **Préparation réservoir** :
```
1. Vidanger carburant (sécurité)
2. Nettoyer réservoir
3. Percer trou diamètre sonde (55-60mm)
4. Ébavurer soigneusement
```

#### **Installation sonde** :
```
1. Insérer sonde Omnicomm dans réservoir
2. Fixer bride étanche avec joints
3. Serrer boulons (couple 15-20 Nm)
4. Vérifier étanchéité (savon)
5. Remettre carburant
```

#### **Câblage** :
```
Sonde Omnicomm → Tracker GPS (RS-485)

PIN 1 (Rouge)  → +12V
PIN 2 (Noir)   → Masse
PIN 3 (Vert)   → RS485-A
PIN 4 (Blanc)  → RS485-B
```

---

### **ÉTAPE 4 : Configuration Capteurs**

#### **Configuration GPS Teltonika** :
```
1. Télécharger logiciel "Configurator"
   https://teltonika-gps.com/downloads

2. Connecter tracker via USB

3. Paramètres essentiels :
   - APN opérateur GSM
   - Serveur : [SUPABASE_URL]/functions/v1/iot-ingestion/gps
   - Protocol : HTTP POST
   - Interval : 30 secondes
   - Codec : Codec 8 Extended

4. Configurer I/O :
   - Digital Input 1 : Ignition
   - Analog Input 1 : Fuel Sensor
```

#### **Calibration Capteur Carburant** :
```
1. Utiliser logiciel Omnicomm
   https://www.omnicomm-online.com/downloads

2. Process de calibration :
   - Réservoir vide : noter valeur
   - Ajouter 50L : noter valeur
   - Ajouter 50L : noter valeur
   - Continuer jusqu'à plein
   - Créer table de calibration

3. Télécharger table dans tracker
```

---

## 🌐 CONFIGURATION BACKEND

### **API Endpoints disponibles**

#### **1. Ingestion GPS** :
```bash
POST https://[PROJECT].supabase.co/functions/v1/iot-ingestion/gps

Headers:
  Content-Type: application/json
  X-Api-Key: [DEVICE_API_KEY]

Body:
{
  "device_id": "GPS-ABC123",
  "latitude": -10.698745,
  "longitude": -13.256234,
  "speed": 65.5,
  "heading": 180,
  "odometer": 125678.5,
  "timestamp": "2025-11-01T14:30:00Z"
}

Response:
{
  "success": true,
  "reading_id": "uuid",
  "timestamp": "2025-11-01T14:30:05Z"
}
```

#### **2. Ingestion Carburant** :
```bash
POST https://[PROJECT].supabase.co/functions/v1/iot-ingestion/fuel

Headers:
  Content-Type: application/json
  X-Api-Key: [DEVICE_API_KEY]

Body:
{
  "device_id": "FUEL-ABC123",
  "fuel_level": 285.5,
  "tank_capacity": 400,
  "latitude": -10.698745,
  "longitude": -13.256234,
  "timestamp": "2025-11-01T14:30:00Z"
}

Response:
{
  "success": true,
  "reading_id": "uuid",
  "timestamp": "2025-11-01T14:30:05Z"
}
```

#### **3. Télémétrie Générique** :
```bash
POST https://[PROJECT].supabase.co/functions/v1/iot-ingestion/telemetry

Headers:
  Content-Type: application/json
  X-Device-Id: GPS-ABC123

Body:
{
  "type": "health_check",
  "battery": 12.8,
  "signal": -75,
  "temperature": 42
}
```

---

## 🔐 SÉCURITÉ

### **API Keys par dispositif**

Chaque capteur a une clé unique générée automatiquement :
```sql
-- Récupérer API keys
SELECT device_id, api_key, vehicle_id
FROM iot_devices
WHERE status = 'active';
```

### **Configuration Tracker** :
```
1. Stocker API key dans mémoire tracker
2. Envoyer dans header X-Api-Key
3. Rotation keys tous les 6 mois
4. Logs tentatives accès non autorisés
```

---

## 📊 DONNÉES COLLECTÉES

### **GPS (toutes les 30 secondes)** :
- ✅ Position (lat/lng)
- ✅ Vitesse
- ✅ Cap
- ✅ Altitude
- ✅ Précision
- ✅ Nombre satellites
- ✅ Kilométrage
- ✅ État contact

### **Carburant (toutes les 30 secondes)** :
- ✅ Niveau litres
- ✅ Niveau pourcentage
- ✅ Température carburant
- ✅ Taux consommation
- ✅ Détection anomalies
- ✅ Détection vols

### **Calculé automatiquement** :
- ✅ Distance parcourue
- ✅ Consommation L/100km
- ✅ Temps moteur allumé/éteint
- ✅ Arrêts prolongés
- ✅ Excès de vitesse
- ✅ Conduite agressive

---

## 🧪 TESTS DE VALIDATION

### **Checklist par véhicule** :

#### **Test 1 : GPS** :
```
□ Antenne capte signal (15+ satellites)
□ Position affichée correctement sur carte
□ Précision < 5 mètres
□ Update toutes les 30 secondes
□ Vitesse cohérente
□ Kilométrage s'incrémente
```

#### **Test 2 : Carburant** :
```
□ Niveau affiché cohérent jauge
□ Calibration précise (±2%)
□ Pas de fluctuations anormales
□ Détection ravitaillement
□ Alerte bas niveau (< 20%)
□ Courbe consommation réaliste
```

#### **Test 3 : Connexion** :
```
□ Données reçues sur serveur
□ Latence < 5 secondes
□ Pas de perte messages
□ Reconnexion auto après coupure
□ Batterie backup fonctionne
```

---

## 📈 MONITORING SANTÉ CAPTEURS

### **Dashboard IoT (déjà implémenté)** :

Accès : Administration → IoT Devices

**Indicateurs** :
- ✅ Statut en ligne/hors ligne
- ✅ Dernière communication
- ✅ Niveau batterie
- ✅ Force signal GSM
- ✅ Nombre messages 24h
- ✅ Taux erreurs

**Alertes automatiques** :
- 🔴 Dispositif hors ligne > 30 min
- 🟠 Batterie < 20%
- 🟠 Signal faible
- 🔴 Anomalie détectée
- 🟠 Calibration nécessaire

---

## 🔄 MAINTENANCE PRÉVENTIVE

### **Mensuel** :
- Vérifier fixations (vibrations)
- Nettoyer antennes GPS
- Contrôler câblages
- Vérifier étanchéité capteur fuel

### **Trimestriel** :
- Test précision GPS
- Recalibration capteur fuel si besoin
- Mise à jour firmware
- Vérification batterie backup

### **Annuel** :
- Calibration complète fuel
- Remplacement joints étanchéité
- Audit complet système
- Renouvellement contrats SIM

---

## 💰 RETOUR SUR INVESTISSEMENT

### **Économies attendues** :

| Bénéfice | Économie annuelle |
|----------|-------------------|
| **Réduction vol carburant** | ~15-20% = 12,000 USD |
| **Optimisation itinéraires** | ~10% carburant = 8,000 USD |
| **Maintenance prédictive** | ~25% coûts = 15,000 USD |
| **Productivité chauffeurs** | ~15% temps = 10,000 USD |
| **Réduction accidents** | Assurances = 5,000 USD |

### **TOTAL ÉCONOMIES** : ~50,000 USD/an
### **ROI** : < 1 mois ! 🎉

---

## 📞 FOURNISSEURS RECOMMANDÉS (Guinée)

### **Matériel** :
- **MTN Business** : Cartes SIM M2M
- **Orange Pro** : Connectivité IoT
- **Importateurs locaux** : Trackers GPS

### **Installation** :
- Électriciens automobiles certifiés
- Formation technique disponible
- Support à distance possible

---

## 🚀 PLANNING DE DÉPLOIEMENT

### **Semaine 1** :
- Commande matériel
- Formation équipe technique
- Préparation documentation

### **Semaine 2-3** :
- Réception matériel
- Tests en laboratoire
- Configuration backend

### **Semaine 4** :
- Installation véhicule pilote
- Tests terrain 1 semaine
- Ajustements

### **Semaine 5-8** :
- Installation 3 véhicules restants
- Formation chauffeurs
- Monitoring intensif

### **Semaine 9+** :
- Déploiement flotte complète
- Optimisation continue

---

## ✅ CONCLUSION

L'infrastructure **SIGTB** est **100% prête** pour recevoir les données IoT :

✅ **6 tables** IoT créées
✅ **Edge Function** d'ingestion déployée
✅ **API endpoints** opérationnels
✅ **Alertes automatiques** configurées
✅ **Dashboard monitoring** disponible
✅ **Fonctions SQL** optimisées

**Le système peut recevoir des données dès maintenant !** 📡

Pour toute question : support@dari-holding.gn
