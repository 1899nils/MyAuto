# MyAuto Backend API Reference

**Base URL:** `http://<host>:3000`
**API prefix:** `/api`
**Content-Type:** `application/json` (all request bodies and responses unless noted)
**Authentication:** None — the API is unauthenticated. Deploy behind a local network or VPN.
**Body size limit:** 10 MB
**Compression:** gzip/deflate supported (server sends `Content-Encoding: gzip` when appropriate)

All timestamps are **Unix milliseconds** (Int64) throughout the API.

---

## Table of Contents

1. [Trips](#1-trips)
2. [Track Points](#2-track-points)
3. [Settings](#3-settings)
4. [Fuel Entries](#4-fuel-entries)
5. [Data Types Reference](#5-data-types-reference)
6. [Error Responses](#6-error-responses)

---

## 1. Trips

A *Trip* represents a single drive from start to end. Trips can be started live (no end data yet) or created as complete historical records in one call.

### 1.1 List Trips

```
GET /api/trips
```

**Query parameters:**

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `category` | String | No       | Filter by category: `business`, `private`, `unclassified` |
| `from`     | Int64  | No       | Earliest `start_time` to include (Unix ms) |
| `to`       | Int64  | No       | Latest `start_time` to include (Unix ms) |
| `limit`    | Int    | No       | Max records to return (default: `50`) |
| `offset`   | Int    | No       | Records to skip for pagination (default: `0`) |

**Response `200 OK`:**

```json
{
  "trips": [ <Trip>, ... ],
  "total": 142
}
```

`total` is the unfiltered count of all trips in the database (ignoring the query filters). Use `limit`/`offset` against the filtered result set for true pagination — note that `total` does not reflect the filtered count, so iterate until the returned `trips` array length is less than `limit`.

---

### 1.2 Get Trip

```
GET /api/trips/:id
```

**Response `200 OK`:** A single `Trip` object.
**Response `404 Not Found`:** `{ "error": "Not found" }`

---

### 1.3 Create Trip (Start or Manual)

```
POST /api/trips
```

Used for two workflows:

- **Live trip start:** Send only `startLat`, `startLng`, and optionally `bluetoothDevice`. The trip is saved without `end_time` (active/in-progress state).
- **Manual/historical trip:** Send all fields including `endTime`. The trip is saved as complete immediately.

**Request body (all fields optional):**

```json
{
  "startLat": 48.1374,
  "startLng": 11.5755,
  "bluetoothDevice": "My Car Audio",
  "startTime": 1711360800000,
  "endTime": 1711364400000,
  "startAddress": "Marienplatz, Munich",
  "endAddress": "Odeonsplatz, Munich",
  "endLat": 48.1423,
  "endLng": 11.5775,
  "distanceKm": 3.7,
  "durationSeconds": 900,
  "category": "business",
  "notes": "Client visit"
}
```

**Field notes:**

| Field | Type | Description |
|-------|------|-------------|
| `startLat` / `startLng` | Double | Starting coordinates |
| `bluetoothDevice` | String | Name of connected Bluetooth device at trip start |
| `startTime` | Int64 (ms) | Trip start timestamp. Defaults to server `now` if omitted |
| `endTime` | Int64 (ms) | If provided, trip is stored as complete |
| `startAddress` / `endAddress` | String | Human-readable addresses |
| `endLat` / `endLng` | Double | End coordinates |
| `distanceKm` | Double | Distance in kilometres |
| `durationSeconds` | Int | Duration in seconds. Auto-calculated from `endTime - startTime` if omitted but both timestamps are provided |
| `category` | String | `business`, `private`, `unclassified`. Auto-classified from time-based rules if omitted |
| `notes` | String | Free-text notes |

**Response `201 Created`:** The complete `Trip` object as stored (with server-assigned `id` and `created_at`).

---

### 1.4 Update Trip

```
PUT /api/trips/:id
```

All fields are optional. Only the fields provided are updated (partial update semantics).

**Request body:**

```json
{
  "endTime": 1711364400000,
  "endLat": 48.1423,
  "endLng": 11.5775,
  "endAddress": "Odeonsplatz, Munich",
  "startAddress": "Marienplatz, Munich",
  "distanceKm": 3.7,
  "durationSeconds": 900,
  "trafficDelaySeconds": 120,
  "category": "private",
  "notes": "Updated notes",
  "routePolyline": "encodedPolylineString..."
}
```

**Field notes:**

| Field | Type | Description |
|-------|------|-------------|
| `endTime` | Int64 (ms) | Marks the trip as complete |
| `trafficDelaySeconds` | Int | Traffic delay in seconds |
| `routePolyline` | String | Google Maps encoded polyline for the full route |

**Response `200 OK`:** The updated `Trip` object.
**Response `400 Bad Request`:** `{ "error": "No fields to update" }` if body is empty.

---

### 1.5 Delete Trip

```
DELETE /api/trips/:id
```

Deletes the trip and all its associated track points (via `ON DELETE CASCADE`).

**Response `204 No Content`:** Empty body on success.

---

### 1.6 Get Statistics

```
GET /api/trips/stats
```

Returns aggregated statistics for today, the current week (Mon–Sun), the current month, and the active (in-progress) trip if one exists. All time windows are computed relative to the server's local clock.

**Response `200 OK`:**

```json
{
  "today": {
    "count": 2,
    "km": 18.4,
    "secs": 2700
  },
  "week": {
    "count": 11,
    "km": 94.2,
    "secs": 15300
  },
  "month": {
    "count": 38,
    "km": 421.0,
    "secs": 57600
  },
  "byCategory": [
    { "category": "business", "count": 25, "km": 310.5 },
    { "category": "private", "count": 13, "km": 110.5 }
  ],
  "activeTrip": null
}
```

`activeTrip` is either `null` or a full `Trip` object where `end_time` is `null`.
`count`, `km`, and `secs` fields may be `null` if no completed trips exist in that window.

---

### 1.7 Export CSV

```
GET /api/trips/export/csv
```

Returns all trips as a semicolon-delimited CSV file (UTF-8 with BOM for Excel compatibility). Column headers are in German. Intended for download, not programmatic use from the app.

**Response `200 OK`:**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="fahrtenbuch.csv"
```

---

## 2. Track Points

Track points are GPS location samples associated with a trip, stored in chronological order.

### 2.1 Add Track Points (Batch)

```
POST /api/trips/:tripId/points
```

Inserts one or more track points for the given trip in a single atomic transaction.

**Request body:** An array of point objects (must be non-empty):

```json
[
  {
    "lat": 48.1374,
    "lng": 11.5755,
    "timestamp": 1711360800000,
    "speedKmh": 42.5,
    "accuracy": 5.0
  },
  {
    "lat": 48.1380,
    "lng": 11.5760,
    "timestamp": 1711360830000,
    "speedKmh": 38.0,
    "accuracy": 4.5
  }
]
```

**Field notes:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | Double | Yes | Latitude in decimal degrees |
| `lng` | Double | Yes | Longitude in decimal degrees |
| `timestamp` | Int64 (ms) | Yes | When this location was recorded (Unix ms) |
| `speedKmh` | Double | No | Speed in km/h at this point |
| `accuracy` | Double | No | Horizontal accuracy in metres |

**Response `201 Created`:**

```json
{ "inserted": 2 }
```

**Response `400 Bad Request`:** `{ "error": "points must be a non-empty array" }`

---

### 2.2 Get Track Points for a Trip

```
GET /api/trips/:tripId/points
```

Returns all track points for a trip, ordered by `timestamp` ascending.

**Response `200 OK`:**

```json
[
  {
    "id": 1,
    "trip_id": 42,
    "lat": 48.1374,
    "lng": 11.5755,
    "timestamp": 1711360800000,
    "speed_kmh": 42.5,
    "accuracy": 5.0
  }
]
```

Note: response fields use `snake_case` (as stored in SQLite), while request bodies for the POST use `camelCase`.

---

## 3. Settings

Global application settings and classification rules.

### 3.1 Get Settings

```
GET /api/settings
```

**Response `200 OK`:**

```json
{
  "bluetoothDeviceName": "My Car Audio",
  "bluetoothDeviceId": "AA:BB:CC:DD:EE:FF",
  "googleMapsApiKey": "AIza...",
  "homeAddress": "Musterstrasse 1, Munich",
  "workAddress": "Maximilianstrasse 4, Munich",
  "defaultCategory": "ask",
  "classificationRules": [
    {
      "id": 1,
      "name": "Arbeitszeit Mo-Fr",
      "type": "time",
      "start_hour": 7,
      "end_hour": 19,
      "days": [1, 2, 3, 4, 5],
      "category": "business",
      "priority": 0
    }
  ]
}
```

**Field notes:**

| Field | Type | Description |
|-------|------|-------------|
| `bluetoothDeviceName` | String? | Display name of the paired car Bluetooth device |
| `bluetoothDeviceId` | String? | MAC address or UUID of the Bluetooth device |
| `googleMapsApiKey` | String | Google Maps API key for geocoding/routing |
| `homeAddress` | String | Home address for reference |
| `workAddress` | String | Work address for reference |
| `defaultCategory` | String | Default trip category: `business`, `private`, `unclassified`, or `ask` |
| `classificationRules` | Array | Time-based auto-classification rules (see below) |

**ClassificationRule fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Server-assigned ID |
| `name` | String | Human-readable label |
| `type` | String | Currently always `"time"` |
| `start_hour` | Int | Start of the time window (0–23, inclusive) |
| `end_hour` | Int | End of the time window (0–23, exclusive) |
| `days` | [Int] | Days of week: 0=Sunday, 1=Monday, …, 6=Saturday |
| `category` | String | Category assigned when rule matches: `business` or `private` |
| `priority` | Int | Higher priority rules are evaluated first |

---

### 3.2 Update Settings

```
PUT /api/settings
```

All fields are optional. Only provided fields are updated. If `classificationRules` is provided, all existing rules are **replaced** (the array is not merged).

**Request body:**

```json
{
  "bluetoothDeviceName": "My Car Audio",
  "bluetoothDeviceId": "AA:BB:CC:DD:EE:FF",
  "googleMapsApiKey": "AIza...",
  "homeAddress": "Musterstrasse 1, Munich",
  "workAddress": "Maximilianstrasse 4, Munich",
  "defaultCategory": "ask",
  "classificationRules": [
    {
      "name": "Weekday business",
      "type": "time",
      "start_hour": 8,
      "end_hour": 18,
      "days": [1, 2, 3, 4, 5],
      "category": "business",
      "priority": 10
    }
  ]
}
```

**Response `200 OK`:** `{ "ok": true }`

---

## 4. Fuel Entries

Records of fuel fill-ups for cost and consumption tracking.

### 4.1 List Fuel Entries

```
GET /api/fuel
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year`    | Int  | No       | Filter to a specific year (e.g. `2026`) |
| `month`   | Int  | No       | Filter to a specific month within `year` (1–12). Requires `year` |

**Response `200 OK`:**

```json
{
  "entries": [
    {
      "id": 1,
      "date": 1711360800000,
      "liters": 45.2,
      "price_per_liter": 1.799,
      "total_cost": 81.32,
      "odometer_km": 87500.0,
      "notes": "Shell Autobahn A9",
      "created_at": 1711360900000
    }
  ]
}
```

---

### 4.2 Get Fuel Statistics

```
GET /api/fuel/stats
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year`    | Int  | No       | Year for aggregation (defaults to current year) |

**Response `200 OK`:**

```json
{
  "totalLiters": 312.4,
  "totalCost": 561.83,
  "avgPrice": 1.798,
  "avgConsumption": 7.2,
  "costPerKm": 0.129,
  "fillCount": 7,
  "year": 2026
}
```

**Field notes:**

| Field | Type | Description |
|-------|------|-------------|
| `totalLiters` | Double | Total litres fuelled in the year |
| `totalCost` | Double | Total cost in the local currency |
| `avgPrice` | Double | Weighted average price per litre |
| `avgConsumption` | Double? | Average litres per 100 km. `null` if fewer than 2 entries have `odometer_km` set |
| `costPerKm` | Double? | Total cost divided by km driven. `null` if odometer data is insufficient |
| `fillCount` | Int | Number of fill-ups |

---

### 4.3 Create Fuel Entry

```
POST /api/fuel
```

**Request body:**

```json
{
  "date": 1711360800000,
  "liters": 45.2,
  "price_per_liter": 1.799,
  "total_cost": 81.32,
  "odometer_km": 87500.0,
  "notes": "Shell Autobahn A9"
}
```

**Required fields:** `date`, `liters`, `price_per_liter`, `total_cost`
**Optional fields:** `odometer_km`, `notes`

**Response `201 Created`:** The created `FuelEntry` object.
**Response `400 Bad Request`:** `{ "error": "date, liters, price_per_liter, total_cost required" }`

---

### 4.4 Update Fuel Entry

```
PUT /api/fuel/:id
```

All fields are sent and all are overwritten (full replacement semantics — unlike trips/settings which are partial).

**Request body:** Same shape as Create.

**Response `200 OK`:** The updated `FuelEntry` object.

---

### 4.5 Delete Fuel Entry

```
DELETE /api/fuel/:id
```

**Response `204 No Content`:** Empty body on success.

---

## 5. Data Types Reference

### Trip Object

The Trip object returned from the server uses `snake_case` keys as stored in SQLite.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | Int | No | Auto-incremented primary key |
| `start_time` | Int64 (ms) | No | Trip start timestamp |
| `end_time` | Int64 (ms) | Yes | Trip end timestamp. `null` = trip in progress |
| `start_address` | String | Yes | Geocoded start address |
| `end_address` | String | Yes | Geocoded end address |
| `start_lat` | Double | Yes | Start latitude |
| `start_lng` | Double | Yes | Start longitude |
| `end_lat` | Double | Yes | End latitude |
| `end_lng` | Double | Yes | End longitude |
| `distance_km` | Double | Yes | Total distance in kilometres |
| `duration_seconds` | Int | Yes | Trip duration in seconds |
| `traffic_delay_seconds` | Int | No | Traffic delay in seconds (default `0`) |
| `category` | String | No | `business`, `private`, or `unclassified` |
| `notes` | String | Yes | Free-text notes |
| `bluetooth_device` | String | Yes | Bluetooth device name at trip start |
| `route_polyline` | String | Yes | Google Maps encoded polyline for the route |
| `created_at` | Int64 (ms) | No | When the record was created server-side |

### TrackPoint Object (response)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | Int | No | Auto-incremented primary key |
| `trip_id` | Int | No | Foreign key to `trips.id` |
| `lat` | Double | No | Latitude |
| `lng` | Double | No | Longitude |
| `timestamp` | Int64 (ms) | No | When this sample was recorded |
| `speed_kmh` | Double | Yes | Speed in km/h |
| `accuracy` | Double | Yes | Horizontal accuracy in metres |

### FuelEntry Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | Int | No | Auto-incremented primary key |
| `date` | Int64 (ms) | No | Date/time of fill-up |
| `liters` | Double | No | Volume fuelled |
| `price_per_liter` | Double | No | Price per litre |
| `total_cost` | Double | No | Total cost |
| `odometer_km` | Double | Yes | Odometer reading at fill-up |
| `notes` | String | Yes | Free-text notes |
| `created_at` | Int64 (ms) | No | Record creation timestamp |

### ClassificationRule Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | Int | No | Auto-incremented primary key |
| `name` | String | No | Display name |
| `type` | String | No | Currently always `"time"` |
| `start_hour` | Int | No | Hour window start (inclusive, 0–23) |
| `end_hour` | Int | No | Hour window end (exclusive, 0–23) |
| `days` | [Int] | No | Days of week array (0=Sun … 6=Sat) |
| `category` | String | No | `business` or `private` |
| `priority` | Int | No | Evaluation order — higher = first |

### Settings Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `bluetoothDeviceName` | String | Yes | Car BT device name |
| `bluetoothDeviceId` | String | Yes | Car BT device MAC/UUID |
| `googleMapsApiKey` | String | No | Google Maps key (empty string if unset) |
| `homeAddress` | String | No | Home address (empty string if unset) |
| `workAddress` | String | No | Work address (empty string if unset) |
| `defaultCategory` | String | No | `business`, `private`, `unclassified`, or `ask` |
| `classificationRules` | [ClassificationRule] | No | Array, may be empty |

---

## 6. Error Responses

The API does not use a consistent error envelope for all cases. The patterns observed are:

| HTTP Status | Body | When |
|-------------|------|------|
| `400` | `{ "error": "message" }` | Invalid input (missing required fields, wrong type) |
| `404` | `{ "error": "Not found" }` | Requested resource does not exist |
| `204` | *(empty)* | Successful deletion |

Unhandled server errors will return a `500` with an Express default error page or JSON body depending on the request headers.

---

## Auto-Classification Logic

When `category` is not provided in `POST /api/trips`, the server evaluates classification rules against the trip's `start_time`:

1. Rules are sorted by `priority` descending (highest first).
2. For each rule, the trip's local hour and day-of-week are checked against `start_hour`/`end_hour` and `days`.
3. The first matching rule's `category` is used.
4. If no rule matches, `defaultCategory` from settings is used. If `defaultCategory` is `"ask"`, the category is set to `"unclassified"`.
