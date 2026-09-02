# 📡 API DOCUMENTATION - SIGTB DARI HOLDING

## Vue d'ensemble

L'API SIGTB fournit un accès programmatique complet à toutes les fonctionnalités du système de gestion de flotte. Elle est construite sur Supabase et expose des endpoints REST sécurisés pour l'intégration avec des systèmes tiers (ERP, applications mobiles, IoT).

**Base URL**: `https://[YOUR-PROJECT].supabase.co`

**Version**: v1.0

**Protocol**: HTTPS uniquement

**Format**: JSON

---

## 🔐 Authentification

### Méthodes supportées

#### 1. API Key (Service Role)
```http
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

#### 2. JWT Token (User Session)
```http
Authorization: Bearer USER_JWT_TOKEN
```

#### 3. API Key Header
```http
apikey: YOUR_ANON_KEY
```

### Obtenir un token

```bash
# Login
POST /auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "user@dariholding.com",
  "password": "password"
}

# Response
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {...}
}
```

---

## 📊 Endpoints Principaux

### Véhicules

#### GET /rest/v1/vehicles
Récupère la liste des véhicules

**Query Parameters:**
- `status=eq.active` - Filtrer par statut
- `vehicle_type=eq.tipper` - Filtrer par type
- `site_id=eq.uuid` - Filtrer par site
- `select=*` - Colonnes à retourner
- `order=created_at.desc` - Tri
- `limit=50` - Limite résultats

**Response:**
```json
[
  {
    "id": "uuid",
    "registration": "GN0001TB",
    "brand_model": "Caterpillar 777D",
    "year": 2020,
    "capacity_tonnes": 100,
    "vehicle_type": "tipper",
    "current_km": 85000,
    "status": "active",
    "site_id": "uuid",
    "gps_device_id": "GPS000001",
    "gps_device_active": true
  }
]
```

#### POST /rest/v1/vehicles
Créer un nouveau véhicule

**Request Body:**
```json
{
  "registration": "GN0050TB",
  "brand_model": "Volvo A60H",
  "year": 2023,
  "capacity_tonnes": 70,
  "vehicle_type": "tipper",
  "chassis_number": "CH0012345678",
  "current_km": 0,
  "status": "active",
  "site_id": "uuid",
  "purchase_cost": 850000000,
  "current_value": 850000000,
  "insurance_expiry": "2025-12-31",
  "technical_inspection_expiry": "2025-06-30"
}
```

#### PATCH /rest/v1/vehicles?id=eq.{uuid}
Mettre à jour un véhicule

**Request Body:**
```json
{
  "current_km": 90000,
  "status": "maintenance"
}
```

---

### Chauffeurs

#### GET /rest/v1/drivers
Liste des chauffeurs

**Query Parameters:**
- `status=eq.active`
- `select=*`
- `license_expiry=gte.2025-01-01` - Permis valide

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Mamadou Diallo",
    "license_number": "DL000001",
    "license_category": "C, E",
    "license_expiry": "2026-12-31",
    "phone": "+224622123456",
    "email": "driver1@dari.gn",
    "status": "active",
    "total_tonnage": 150000,
    "total_km": 95000
  }
]
```

#### GET /rest/v1/driver_availability
Disponibilité des chauffeurs

**Query Parameters:**
- `available_from=gte.2025-11-01T08:00:00`
- `availability_status=eq.available`

**Response:**
```json
[
  {
    "id": "uuid",
    "driver_id": "uuid",
    "available_from": "2025-11-01T08:00:00Z",
    "available_until": "2025-11-01T18:00:00Z",
    "availability_status": "available"
  }
]
```

---

### Voyages / Missions

#### GET /rest/v1/trips
Liste des voyages

**Query Parameters:**
- `status=eq.completed`
- `planned_date=gte.2025-11-01`
- `select=*,vehicle:vehicles(*),driver:drivers(*),client:clients(*)`

**Response:**
```json
[
  {
    "id": "uuid",
    "reference": "TRIP000001",
    "planned_date": "2025-11-01",
    "vehicle_id": "uuid",
    "driver_id": "uuid",
    "departure_site_id": "uuid",
    "arrival_site_id": "uuid",
    "estimated_distance_km": 180,
    "actual_departure_time": "2025-11-01T08:00:00Z",
    "actual_arrival_time": "2025-11-01T13:30:00Z",
    "gross_weight": 95000,
    "tare_weight": 25000,
    "net_weight": 70000,
    "status": "completed",
    "vehicle": { "registration": "GN0001TB" },
    "driver": { "name": "Mamadou Diallo" }
  }
]
```

#### POST /rest/v1/trips
Créer un nouveau voyage

**Request Body:**
```json
{
  "reference": "TRIP000500",
  "planned_date": "2025-11-02",
  "vehicle_id": "uuid",
  "driver_id": "uuid",
  "departure_site_id": "uuid",
  "arrival_site_id": "uuid",
  "estimated_distance_km": 200,
  "gross_weight": 98000,
  "tare_weight": 25000,
  "net_weight": 73000,
  "status": "planned",
  "client_id": "uuid"
}
```

---

### Suivi GPS (IoT)

#### GET /rest/v1/iot_gps_readings
Positions GPS temps réel

**Query Parameters:**
- `timestamp=gte.2025-11-01T00:00:00`
- `device_id=eq.GPS000001`
- `order=timestamp.desc`
- `limit=1` - Dernière position

**Response:**
```json
[
  {
    "id": "uuid",
    "device_id": "GPS000001",
    "vehicle_id": "uuid",
    "timestamp": "2025-11-01T14:23:45Z",
    "latitude": 10.6822,
    "longitude": -14.7644,
    "altitude": 45.2,
    "speed_kmh": 65.5,
    "heading": 87.3,
    "satellites": 12,
    "accuracy_meters": 3.2
  }
]
```

#### POST /functions/v1/iot-ingestion
Ingestion données IoT (Edge Function)

**Request Body:**
```json
{
  "device_id": "GPS000001",
  "device_type": "gps_tracker",
  "timestamp": "2025-11-01T14:25:00Z",
  "data": {
    "latitude": 10.6850,
    "longitude": -14.7620,
    "speed_kmh": 70.2,
    "heading": 90.0,
    "satellites": 11
  }
}
```

---

### Carburant

#### GET /rest/v1/fuel_transactions
Transactions carburant

**Query Parameters:**
- `transaction_date=gte.2025-11-01`
- `vehicle_id=eq.uuid`
- `select=*,vehicle:vehicles(registration)`

**Response:**
```json
[
  {
    "id": "uuid",
    "reference": "FUEL000001",
    "transaction_date": "2025-11-01T08:15:00Z",
    "vehicle_id": "uuid",
    "driver_id": "uuid",
    "volume_liters": 350,
    "unit_price": 11500,
    "total_cost": 4025000,
    "transaction_type": "purchase",
    "supplier": "Total Energies",
    "odometer_reading": 85000,
    "vehicle": {
      "registration": "GN0001TB"
    }
  }
]
```

#### POST /rest/v1/fuel_transactions
Enregistrer transaction carburant

**Request Body:**
```json
{
  "reference": "FUEL000100",
  "transaction_date": "2025-11-01T10:30:00Z",
  "vehicle_id": "uuid",
  "driver_id": "uuid",
  "volume_liters": 400,
  "unit_price": 11500,
  "total_cost": 4600000,
  "transaction_type": "purchase",
  "supplier": "Oryx",
  "odometer_reading": 85200
}
```

---

### Maintenance

#### GET /rest/v1/maintenance_orders
Ordres de maintenance

**Query Parameters:**
- `status=eq.scheduled`
- `scheduled_date=gte.2025-11-01`
- `select=*,vehicle:vehicles(*)`

**Response:**
```json
[
  {
    "id": "uuid",
    "work_order_number": "MAINT000001",
    "vehicle_id": "uuid",
    "maintenance_type": "preventive",
    "title": "Révision moteur",
    "description": "Révision complète moteur 10000h",
    "scheduled_date": "2025-11-05",
    "estimated_cost": 5000000,
    "status": "scheduled",
    "assigned_to": "Technicien 1",
    "vehicle": {
      "registration": "GN0001TB"
    }
  }
]
```

---

### Facturation

#### GET /rest/v1/invoices
Liste des factures

**Query Parameters:**
- `payment_status=eq.pending`
- `customer_id=eq.uuid`
- `select=*,customer:customers(*),items:invoice_items(*)`

**Response:**
```json
[
  {
    "id": "uuid",
    "invoice_number": "INV202400001",
    "customer_id": "uuid",
    "invoice_date": "2025-10-30",
    "due_date": "2025-11-29",
    "period_start": "2025-10-01",
    "period_end": "2025-10-30",
    "subtotal": 25000000,
    "tax_amount": 4500000,
    "total_amount": 29500000,
    "payment_status": "pending",
    "customer": {
      "company_name": "CBG Guinée"
    },
    "items": [
      {
        "description": "Transport bauxite",
        "quantity": 500,
        "unit_price": 50000,
        "total_price": 25000000
      }
    ]
  }
]
```

#### POST /rest/v1/invoices
Créer facture

**Request Body:**
```json
{
  "invoice_number": "INV202400150",
  "customer_id": "uuid",
  "invoice_date": "2025-11-01",
  "due_date": "2025-12-01",
  "period_start": "2025-11-01",
  "period_end": "2025-11-30",
  "subtotal": 30000000,
  "tax_amount": 5400000,
  "total_amount": 35400000,
  "payment_status": "draft",
  "status": "draft"
}
```

---

### Reporting & Analytics

#### GET /rest/v1/rpc/get_fleet_statistics
Statistiques flotte (RPC function)

**Request Body:**
```json
{
  "start_date": "2025-10-01",
  "end_date": "2025-10-31"
}
```

**Response:**
```json
{
  "total_vehicles": 54,
  "active_vehicles": 48,
  "total_trips": 507,
  "completed_trips": 480,
  "total_tonnage": 34000,
  "total_km": 86400,
  "fuel_consumed": 36000,
  "average_consumption": 41.67
}
```

---

## 🔔 Webhooks

### Configuration

Les webhooks permettent de recevoir des notifications temps réel sur des événements système.

#### Événements disponibles:

- `trip.created` - Nouveau voyage créé
- `trip.completed` - Voyage terminé
- `vehicle.maintenance_due` - Maintenance échue
- `alert.created` - Nouvelle alerte
- `invoice.paid` - Facture payée
- `fuel.low_stock` - Stock carburant faible
- `iot.device_offline` - Dispositif IoT hors ligne

#### Format webhook:

```json
{
  "event": "trip.completed",
  "timestamp": "2025-11-01T15:30:00Z",
  "data": {
    "trip_id": "uuid",
    "reference": "TRIP000123",
    "vehicle_registration": "GN0001TB",
    "driver_name": "Mamadou Diallo",
    "tonnage": 70,
    "distance_km": 185
  }
}
```

---

## 📱 Intégration Mobile

### Endpoints spécifiques app mobile chauffeur

#### POST /rest/v1/rpc/driver_check_in
Check-in chauffeur début journée

**Request:**
```json
{
  "driver_id": "uuid",
  "location": {
    "latitude": 10.6822,
    "longitude": -14.7644
  }
}
```

#### GET /rest/v1/rpc/driver_active_trips
Missions actives du chauffeur

**Parameters:**
```json
{
  "driver_id": "uuid"
}
```

#### POST /rest/v1/rpc/trip_start
Démarrer un voyage

**Request:**
```json
{
  "trip_id": "uuid",
  "actual_departure_time": "2025-11-01T08:00:00Z",
  "km_start": 85000,
  "departure_location": {
    "latitude": 10.6822,
    "longitude": -14.7644
  }
}
```

---

## ⚙️ Rate Limiting

- **Anonyme**: 100 requêtes/heure
- **Authentifié**: 1000 requêtes/heure
- **Service Role**: Illimité

Headers de réponse:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 985
X-RateLimit-Reset: 1730467200
```

---

## 🔄 Pagination

Utiliser les headers `Range` et `Prefer`:

```http
GET /rest/v1/trips
Range: 0-99
Prefer: count=exact
```

Response headers:
```http
Content-Range: 0-99/507
```

---

## ❌ Gestion des erreurs

### Codes HTTP standards

- `200 OK` - Succès
- `201 Created` - Ressource créée
- `204 No Content` - Succès sans contenu
- `400 Bad Request` - Requête invalide
- `401 Unauthorized` - Non authentifié
- `403 Forbidden` - Non autorisé
- `404 Not Found` - Ressource introuvable
- `409 Conflict` - Conflit (duplicate, constraint)
- `422 Unprocessable Entity` - Validation échouée
- `429 Too Many Requests` - Rate limit dépassé
- `500 Internal Server Error` - Erreur serveur

### Format erreur

```json
{
  "code": "PGRST116",
  "details": "The result contains 0 rows",
  "hint": null,
  "message": "JSON object requested, multiple (or no) rows returned"
}
```

---

## 📋 Exemples d'intégration

### Python

```python
import requests

SUPABASE_URL = "https://your-project.supabase.co"
API_KEY = "your-anon-key"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Get vehicles
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/vehicles",
    headers=headers,
    params={"status": "eq.active"}
)

vehicles = response.json()
print(f"Found {len(vehicles)} active vehicles")
```

### JavaScript/Node.js

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Get trips with related data
const { data: trips, error } = await supabase
  .from('trips')
  .select(`
    *,
    vehicle:vehicles(registration),
    driver:drivers(name)
  `)
  .eq('status', 'in_progress');

console.log('Active trips:', trips);
```

### cURL

```bash
# Get fuel transactions
curl -X GET 'https://your-project.supabase.co/rest/v1/fuel_transactions?limit=10' \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"

# Create new trip
curl -X POST 'https://your-project.supabase.co/rest/v1/trips' \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "TRIP999",
    "planned_date": "2025-11-02",
    "vehicle_id": "uuid",
    "driver_id": "uuid",
    "status": "planned"
  }'
```

---

## 🔐 Sécurité

### Best Practices

1. **Ne jamais exposer la Service Role Key** côté client
2. **Utiliser HTTPS** uniquement
3. **Implémenter RLS** (Row Level Security) sur toutes les tables
4. **Valider toutes les entrées** côté serveur
5. **Utiliser des JWT** pour l'authentification utilisateur
6. **Rotate les API keys** régulièrement
7. **Monitor les accès** via logs Supabase
8. **Limiter les permissions** par rôle utilisateur

### RLS Examples

```sql
-- Users can only see their own trips
CREATE POLICY "Users can view own trips"
ON trips FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- Only admins can delete vehicles
CREATE POLICY "Only admins delete vehicles"
ON vehicles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

---

## 📖 Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgREST Docs**: https://postgrest.org/en/stable/
- **API Status**: https://status.supabase.com
- **Support**: support@dariholding.gn

---

## 🎯 OpenAPI Specification

Une spécification OpenAPI 3.0 complète est disponible:

```bash
GET /rest/v1/
Accept: application/openapi+json
```

Import dans Postman, Insomnia, ou SwaggerUI pour une documentation interactive complète.

---

**Version**: 1.0.0
**Last Updated**: 2025-11-01
**Contact**: tech@dariholding.gn
