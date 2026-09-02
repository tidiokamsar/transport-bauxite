# APPLICATION MOBILE CHAUFFEUR - DARI HOLDING
## Spécifications techniques et guide de déploiement

---

## 📱 OVERVIEW

Application mobile native pour les chauffeurs de la flotte DARI HOLDING permettant :
- Réception et gestion des missions
- Check-lists pré-départ et post-arrivée
- Signalement incidents en temps réel
- Suivi GPS automatique
- Communication avec dispatch

---

## 🛠 STACK TECHNIQUE

### **Framework recommandé : React Native (Expo)**
- **Avantages** : Code partagé iOS/Android, développement rapide, communauté active
- **Alternative** : Flutter pour performances natives supérieures

### **Backend** : Supabase
- API REST déjà configurée
- Authentification intégrée
- Realtime subscriptions
- Storage pour photos

### **Packages essentiels** :
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "react-native": "0.72.x",
    "expo": "~49.0.0",
    "expo-location": "~16.1.0",
    "expo-camera": "~13.4.0",
    "expo-image-picker": "~14.3.0",
    "expo-notifications": "~0.20.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "react-native-maps": "1.7.1"
  }
}
```

---

## 📂 STRUCTURE DE L'APP

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── MissionsScreen.tsx
│   │   ├── MissionDetailsScreen.tsx
│   │   ├── ChecklistScreen.tsx
│   │   ├── IncidentScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/
│   │   ├── MissionCard.tsx
│   │   ├── ChecklistItem.tsx
│   │   ├── GPSIndicator.tsx
│   │   └── EmergencyButton.tsx
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── gps.ts
│   │   ├── notifications.ts
│   │   └── storage.ts
│   ├── hooks/
│   │   ├── useLocation.ts
│   │   ├── useMissions.ts
│   │   └── useAuth.ts
│   └── types/
│       └── index.ts
├── App.tsx
└── package.json
```

---

## 🔑 FONCTIONNALITÉS PRINCIPALES

### **1. AUTHENTIFICATION**
```typescript
// Login avec email + password
const { data, error } = await supabase.auth.signInWithPassword({
  email: driver.email,
  password: driver.password
});

// Récupération profil chauffeur
const { data: profile } = await supabase
  .from('drivers')
  .select('*')
  .eq('email', email)
  .single();
```

### **2. GESTION MISSIONS**
```typescript
// Liste missions assignées
const { data: missions } = await supabase
  .from('dispatch_assignments')
  .select(`
    *,
    trips(*, departure_site_id, arrival_site_id),
    vehicles(*)
  `)
  .eq('driver_id', driverId)
  .eq('status', 'assigned')
  .order('assignment_date', { ascending: false });

// Accepter une mission
const { data } = await supabase
  .from('dispatch_assignments')
  .update({ status: 'accepted' })
  .eq('id', missionId);
```

### **3. CHECK-LISTS**
```typescript
// Checklist pré-départ
const preStartChecklist = [
  { id: 1, item: 'Niveau huile moteur', checked: false },
  { id: 2, item: 'Pression pneus', checked: false },
  { id: 3, item: 'Feux fonctionnels', checked: false },
  { id: 4, item: 'Rétroviseurs', checked: false },
  { id: 5, item: 'Niveau carburant', checked: false },
  { id: 6, item: 'Documents bord', checked: false },
];

// Enregistrement
await supabase
  .from('trip_checklists')
  .insert({
    trip_id: tripId,
    checklist_type: 'pre_start',
    items: JSON.stringify(checklist),
    completed_at: new Date(),
    driver_signature: signatureBase64
  });
```

### **4. SUIVI GPS TEMPS RÉEL**
```typescript
// Background location tracking
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];

    // Envoyer au serveur
    await supabase.rpc('ingest_gps_data', {
      p_device_id: deviceId,
      p_latitude: location.coords.latitude,
      p_longitude: location.coords.longitude,
      p_speed: location.coords.speed * 3.6, // m/s to km/h
      p_heading: location.coords.heading,
      p_odometer: currentOdometer
    });
  }
});

// Démarrer tracking
await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: Location.Accuracy.High,
  timeInterval: 30000, // 30 secondes
  distanceInterval: 100, // 100 mètres
  foregroundService: {
    notificationTitle: 'SIGTB - Mission en cours',
    notificationBody: 'Position GPS suivie'
  }
});
```

### **5. SIGNALEMENT INCIDENTS**
```typescript
// Capture photo + description
import * as ImagePicker from 'expo-image-picker';

// Prendre photo
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  quality: 0.8
});

// Upload sur Supabase Storage
const { data: uploadData } = await supabase.storage
  .from('incidents')
  .upload(`${tripId}/${Date.now()}.jpg`, photo);

// Créer incident
await supabase.from('incidents').insert({
  trip_id: tripId,
  driver_id: driverId,
  incident_type: type,
  description: description,
  location: { lat, lng },
  photos: [uploadData.path],
  severity: severity,
  reported_at: new Date()
});
```

### **6. NOTIFICATIONS PUSH**
```typescript
import * as Notifications from 'expo-notifications';

// Configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Réception notification (nouvelle mission)
Notifications.addNotificationReceivedListener(notification => {
  const data = notification.request.content.data;
  if (data.type === 'new_mission') {
    // Rafraîchir liste missions
    fetchMissions();
  }
});
```

---

## 🎨 ÉCRANS PRINCIPAUX

### **1. Login Screen**
- Email + Password
- Option "Rester connecté"
- Logo DARI HOLDING

### **2. Home Screen**
- Statut mission actuelle
- Indicateur GPS
- Bouton urgence
- Navigation rapide

### **3. Missions Screen**
- Liste missions assignées
- Filtres (acceptées, en cours, terminées)
- Card par mission avec :
  - Départ → Arrivée
  - Distance estimée
  - Tonnage
  - Heure prévue

### **4. Mission Details**
- Détails complets
- Boutons : Accepter / Démarrer / Terminer
- Checklist pré-départ
- Checklist arrivée
- Upload photos chargement/déchargement

### **5. Incident Report**
- Type incident (panne, accident, autre)
- Description texte
- Photos multiples
- Position auto-capturée
- Envoyer au dispatch

### **6. Profile Screen**
- Infos chauffeur
- Statistiques (missions complétées, km parcourus)
- Score performance
- Paramètres
- Déconnexion

---

## 🚀 DÉPLOIEMENT

### **Phase 1 : Développement (2-3 semaines)**
1. Setup projet React Native / Expo
2. Configuration Supabase client
3. Développement écrans principaux
4. Intégration GPS background
5. Tests iOS + Android

### **Phase 2 : Beta Test (1-2 semaines)**
1. Déploiement TestFlight (iOS) + Internal Testing (Android)
2. Test avec 3-5 chauffeurs pilotes
3. Collecte feedback
4. Corrections bugs

### **Phase 3 : Production**
1. Soumission App Store + Google Play
2. Validation (1-2 semaines)
3. Déploiement progressif
4. Formation chauffeurs

---

## 📋 CHECKLIST TECHNIQUE

### **Backend (Supabase) ✅**
- [x] Tables missions/drivers configurées
- [x] Fonctions GPS/carburant créées
- [x] RLS policies configurées
- [x] Storage bucket incidents créé
- [x] Realtime activé

### **Mobile App 📱**
- [ ] Projet Expo initialisé
- [ ] Authentification implémentée
- [ ] Écrans principaux développés
- [ ] GPS background fonctionnel
- [ ] Notifications configurées
- [ ] Tests iOS/Android réalisés
- [ ] Soumission stores effectuée

---

## 💡 COMMANDES DE DÉMARRAGE

```bash
# Créer projet Expo
npx create-expo-app dari-driver-app
cd dari-driver-app

# Installer dépendances
npm install @supabase/supabase-js
npx expo install expo-location expo-camera expo-image-picker
npx expo install expo-notifications react-native-maps
npm install @react-navigation/native @react-navigation/bottom-tabs

# Lancer en développement
npx expo start

# Build pour production
eas build --platform android
eas build --platform ios
```

---

## 🔐 SÉCURITÉ

- ✅ Authentification JWT via Supabase
- ✅ RLS activé sur toutes tables
- ✅ API keys sécurisées (variables env)
- ✅ Photos stockées dans buckets privés
- ✅ HTTPS obligatoire
- ✅ Données sensibles chiffrées

---

## 📊 MÉTRIQUES À TRACKER

- Nombre d'utilisateurs actifs
- Missions complétées par jour
- Temps moyen par mission
- Taux incidents signalés
- Score moyen check-lists
- Précision GPS moyenne
- Uptime app

---

## 🆘 SUPPORT

Pour toute question technique :
- Documentation Supabase : https://supabase.com/docs
- React Native : https://reactnative.dev
- Expo : https://docs.expo.dev

---

**L'infrastructure backend est 100% prête pour l'app mobile !** 🎉
