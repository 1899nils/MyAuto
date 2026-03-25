# MyAuto iOS Swift App — Architecture Guide

This document describes how to build a native iOS Swift app that connects to the MyAuto backend. It covers network connectivity, Swift data models, background location tracking, and trip sync strategy.

---

## Table of Contents

1. [Connecting to the Backend](#1-connecting-to-the-backend)
2. [Swift Data Models](#2-swift-data-models)
3. [API Client Layer](#3-api-client-layer)
4. [Background Location Tracking with CLLocationManager](#4-background-location-tracking-with-cllocationmanager)
5. [Authentication](#5-authentication)
6. [Trip Sync Strategy](#6-trip-sync-strategy)
7. [Bluetooth-Triggered Trip Start/Stop](#7-bluetooth-triggered-trip-startstop)
8. [Recommended App Architecture](#8-recommended-app-architecture)

---

## 1. Connecting to the Backend

### Server address

The MyAuto server runs on port `3000` (configurable via the `PORT` environment variable). It is a local network service — it has no authentication and should never be exposed to the public internet. The iOS app connects over the same Wi-Fi/LAN or via a VPN (e.g. Tailscale, WireGuard) when away from home.

Allow the user to configure the base URL from the app's settings screen and persist it with `UserDefaults`.

```swift
// UserDefaults key
extension UserDefaults {
    var myAutoBaseURL: URL? {
        get {
            guard let raw = string(forKey: "myAutoBaseURL"),
                  let url = URL(string: raw) else { return nil }
            return url
        }
        set { set(newValue?.absoluteString, forKey: "myAutoBaseURL") }
    }
}
```

Typical value: `http://192.168.1.50:3000` or `http://myauto.local:3000`

### App Transport Security (ATS)

Because the server uses plain HTTP (not HTTPS) on a local network, you must add an ATS exception in `Info.plist`. Scope the exception to the user-configured host, or use `NSAllowsLocalNetworking`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

If users access the server over a VPN with a domain name, also allow arbitrary loads for that domain or configure a proper TLS certificate.

### URLSession configuration

Use a shared `URLSession` with a reasonable timeout. The server supports gzip, so set the `Accept-Encoding` header:

```swift
let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 15
config.timeoutIntervalForResource = 60
// URLSession already adds Accept-Encoding: gzip by default
let session = URLSession(configuration: config)
```

---

## 2. Swift Data Models

All timestamps from the API are Unix milliseconds (Int64). The models below decode them as `Date` using a custom `JSONDecoder`.

### Shared Decoder / Encoder

```swift
extension JSONDecoder {
    static let myAuto: JSONDecoder = {
        let d = JSONDecoder()
        // API returns Unix milliseconds
        d.dateDecodingStrategy = .millisecondsSince1970
        return d
    }()
}

extension JSONEncoder {
    static let myAuto: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .millisecondsSince1970
        return e
    }()
}
```

---

### Trip

The API returns snake_case keys from SQLite. Use `CodingKeys` to map them to Swift conventions.

```swift
struct Trip: Codable, Identifiable {
    let id: Int
    let startTime: Date
    let endTime: Date?
    let startAddress: String?
    let endAddress: String?
    let startLat: Double?
    let startLng: Double?
    let endLat: Double?
    let endLng: Double?
    let distanceKm: Double?
    let durationSeconds: Int?
    let trafficDelaySeconds: Int
    let category: TripCategory
    let notes: String?
    let bluetoothDevice: String?
    let routePolyline: String?
    let createdAt: Date

    var isActive: Bool { endTime == nil }

    enum CodingKeys: String, CodingKey {
        case id
        case startTime         = "start_time"
        case endTime           = "end_time"
        case startAddress      = "start_address"
        case endAddress        = "end_address"
        case startLat          = "start_lat"
        case startLng          = "start_lng"
        case endLat            = "end_lat"
        case endLng            = "end_lng"
        case distanceKm        = "distance_km"
        case durationSeconds   = "duration_seconds"
        case trafficDelaySeconds = "traffic_delay_seconds"
        case category
        case notes
        case bluetoothDevice   = "bluetooth_device"
        case routePolyline     = "route_polyline"
        case createdAt         = "created_at"
    }
}

enum TripCategory: String, Codable, CaseIterable {
    case business     = "business"
    case `private`    = "private"
    case unclassified = "unclassified"
}
```

---

### TrackPoint

Track points arrive from the server in snake_case. When posting to the server the request body uses camelCase (`speedKmh`, `accuracy`).

```swift
/// Used when decoding GET /api/trips/:id/points response
struct TrackPoint: Codable, Identifiable {
    let id: Int
    let tripId: Int
    let lat: Double
    let lng: Double
    let timestamp: Date
    let speedKmh: Double?
    let accuracy: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case tripId   = "trip_id"
        case lat, lng
        case timestamp
        case speedKmh = "speed_kmh"
        case accuracy
    }
}

/// Used when uploading points to POST /api/trips/:id/points
struct TrackPointUpload: Encodable {
    let lat: Double
    let lng: Double
    let timestamp: Date      // encoded as ms by JSONEncoder.myAuto
    let speedKmh: Double?
    let accuracy: Double?
}
```

---

### Settings and ClassificationRule

```swift
struct AppSettings: Codable {
    var bluetoothDeviceName: String?
    var bluetoothDeviceId: String?
    var googleMapsApiKey: String
    var homeAddress: String
    var workAddress: String
    var defaultCategory: DefaultCategory
    var classificationRules: [ClassificationRule]

    enum CodingKeys: String, CodingKey {
        case bluetoothDeviceName  = "bluetoothDeviceName"
        case bluetoothDeviceId    = "bluetoothDeviceId"
        case googleMapsApiKey     = "googleMapsApiKey"
        case homeAddress          = "homeAddress"
        case workAddress          = "workAddress"
        case defaultCategory      = "defaultCategory"
        case classificationRules  = "classificationRules"
    }
}

enum DefaultCategory: String, Codable {
    case business     = "business"
    case `private`    = "private"
    case unclassified = "unclassified"
    case ask          = "ask"
}

struct ClassificationRule: Codable, Identifiable {
    var id: Int?
    var name: String
    var type: String           // currently always "time"
    var startHour: Int         // inclusive (0–23)
    var endHour: Int           // exclusive (0–23)
    var days: [Int]            // 0=Sun, 1=Mon … 6=Sat
    var category: TripCategory
    var priority: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name, type
        case startHour = "start_hour"
        case endHour   = "end_hour"
        case days, category, priority
    }
}
```

---

### FuelEntry

```swift
struct FuelEntry: Codable, Identifiable {
    let id: Int
    let date: Date
    let liters: Double
    let pricePerLiter: Double
    let totalCost: Double
    let odometerKm: Double?
    let notes: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, date, liters, notes
        case pricePerLiter = "price_per_liter"
        case totalCost     = "total_cost"
        case odometerKm    = "odometer_km"
        case createdAt     = "created_at"
    }
}

struct FuelStats: Codable {
    let totalLiters: Double
    let totalCost: Double
    let avgPrice: Double
    let avgConsumption: Double?
    let costPerKm: Double?
    let fillCount: Int
    let year: Int
}
```

---

### Trips List Response and Stats

```swift
struct TripsResponse: Codable {
    let trips: [Trip]
    let total: Int
}

struct TripStats: Codable {
    struct Window: Codable {
        let count: Int?
        let km: Double?
        let secs: Int?
    }
    struct CategoryStat: Codable {
        let category: TripCategory
        let count: Int
        let km: Double
    }
    let today: Window
    let week: Window
    let month: Window
    let byCategory: [CategoryStat]
    let activeTrip: Trip?
}
```

---

## 3. API Client Layer

Implement a single `MyAutoAPIClient` actor that wraps all network calls. Using `actor` ensures thread-safe access to mutable state (like the base URL) without manual locking.

```swift
actor MyAutoAPIClient {
    private let session: URLSession
    private var baseURL: URL

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func updateBaseURL(_ url: URL) {
        self.baseURL = url
    }

    // MARK: - Generic helpers

    private func url(_ path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }

    private func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: url(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        let (data, _) = try await session.data(from: components.url!)
        return try JSONDecoder.myAuto.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.myAuto.encode(body)
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder.myAuto.decode(T.self, from: data)
    }

    private func put<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.myAuto.encode(body)
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder.myAuto.decode(T.self, from: data)
    }

    private func delete(_ path: String) async throws {
        var req = URLRequest(url: url(path))
        req.httpMethod = "DELETE"
        _ = try await session.data(for: req)
    }

    // MARK: - Trips

    func listTrips(category: TripCategory? = nil, from: Date? = nil, to: Date? = nil,
                   limit: Int = 50, offset: Int = 0) async throws -> TripsResponse {
        var query: [String: String] = [
            "limit": "\(limit)",
            "offset": "\(offset)"
        ]
        if let c = category { query["category"] = c.rawValue }
        if let f = from { query["from"] = "\(Int64(f.timeIntervalSince1970 * 1000))" }
        if let t = to   { query["to"]   = "\(Int64(t.timeIntervalSince1970 * 1000))" }
        return try await get("/api/trips", query: query)
    }

    func getTrip(_ id: Int) async throws -> Trip {
        return try await get("/api/trips/\(id)")
    }

    func getStats() async throws -> TripStats {
        return try await get("/api/trips/stats")
    }

    func startTrip(startLat: Double, startLng: Double, bluetoothDevice: String?) async throws -> Trip {
        struct Body: Encodable {
            let startLat: Double
            let startLng: Double
            let bluetoothDevice: String?
        }
        return try await post("/api/trips", body: Body(startLat: startLat, startLng: startLng, bluetoothDevice: bluetoothDevice))
    }

    func endTrip(id: Int, endTime: Date, endLat: Double, endLng: Double,
                 endAddress: String?, distanceKm: Double?,
                 durationSeconds: Int?, trafficDelaySeconds: Int?,
                 routePolyline: String?) async throws -> Trip {
        struct Body: Encodable {
            let endTime: Date
            let endLat: Double
            let endLng: Double
            let endAddress: String?
            let distanceKm: Double?
            let durationSeconds: Int?
            let trafficDelaySeconds: Int?
            let routePolyline: String?
        }
        return try await put("/api/trips/\(id)", body: Body(
            endTime: endTime, endLat: endLat, endLng: endLng,
            endAddress: endAddress, distanceKm: distanceKm,
            durationSeconds: durationSeconds, trafficDelaySeconds: trafficDelaySeconds,
            routePolyline: routePolyline
        ))
    }

    func updateTrip(id: Int, category: TripCategory? = nil, notes: String? = nil) async throws -> Trip {
        struct Body: Encodable {
            let category: TripCategory?
            let notes: String?
        }
        return try await put("/api/trips/\(id)", body: Body(category: category, notes: notes))
    }

    func deleteTrip(_ id: Int) async throws {
        try await delete("/api/trips/\(id)")
    }

    // MARK: - Track Points

    func uploadPoints(_ points: [TrackPointUpload], tripId: Int) async throws -> Int {
        struct Response: Decodable { let inserted: Int }
        let result: Response = try await post("/api/trips/\(tripId)/points", body: points)
        return result.inserted
    }

    func getPoints(tripId: Int) async throws -> [TrackPoint] {
        return try await get("/api/trips/\(tripId)/points")
    }

    // MARK: - Settings

    func getSettings() async throws -> AppSettings {
        return try await get("/api/settings")
    }

    func updateSettings(_ settings: AppSettings) async throws {
        struct OkResponse: Decodable { let ok: Bool }
        let _: OkResponse = try await put("/api/settings", body: settings)
    }

    // MARK: - Fuel

    func listFuelEntries(year: Int? = nil, month: Int? = nil) async throws -> [FuelEntry] {
        struct Response: Decodable { let entries: [FuelEntry] }
        var query: [String: String] = [:]
        if let y = year  { query["year"]  = "\(y)" }
        if let m = month { query["month"] = "\(m)" }
        let result: Response = try await get("/api/fuel", query: query)
        return result.entries
    }

    func getFuelStats(year: Int? = nil) async throws -> FuelStats {
        var query: [String: String] = [:]
        if let y = year { query["year"] = "\(y)" }
        return try await get("/api/fuel/stats", query: query)
    }
}
```

---

## 4. Background Location Tracking with CLLocationManager

### Required Info.plist keys

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>MyAuto needs location access to track your trips.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>MyAuto needs background location access to automatically start and stop trip tracking.</string>

<!-- Enable background mode -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

### LocationManager class

```swift
import CoreLocation
import Combine

@MainActor
final class LocationManager: NSObject, ObservableObject {

    // MARK: - Published state

    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published private(set) var currentLocation: CLLocation?
    @Published private(set) var isTracking: Bool = false

    // MARK: - Internal buffer

    /// Points accumulated since the last sync
    private var pendingPoints: [TrackPointUpload] = []
    private let pendingQueue = DispatchQueue(label: "com.myauto.pendingPoints")

    // MARK: - Dependencies

    private let clManager = CLLocationManager()

    override init() {
        super.init()
        clManager.delegate = self
        clManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        clManager.distanceFilter = 10           // update every 10 metres
        clManager.pausesLocationUpdatesAutomatically = false
        clManager.allowsBackgroundLocationUpdates = true
        clManager.showsBackgroundLocationIndicator = true
    }

    // MARK: - Authorization

    func requestAlwaysAuthorization() {
        clManager.requestAlwaysAuthorization()
    }

    // MARK: - Tracking control

    func startTracking() {
        guard !isTracking else { return }
        pendingPoints.removeAll()
        clManager.startUpdatingLocation()
        isTracking = true
    }

    func stopTracking() -> [TrackPointUpload] {
        guard isTracking else { return [] }
        clManager.stopUpdatingLocation()
        isTracking = false
        let captured = pendingPoints
        pendingPoints.removeAll()
        return captured
    }

    /// Returns and clears the current buffer of unsent points
    func drainPendingPoints() -> [TrackPointUpload] {
        let drained = pendingPoints
        pendingPoints.removeAll()
        return drained
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationManager: CLLocationManagerDelegate {

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let points = locations
            .filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 100 } // discard bad fixes
            .map { loc in
                TrackPointUpload(
                    lat: loc.coordinate.latitude,
                    lng: loc.coordinate.longitude,
                    timestamp: loc.timestamp,
                    speedKmh: loc.speed >= 0 ? loc.speed * 3.6 : nil,
                    accuracy: loc.horizontalAccuracy
                )
            }

        guard !points.isEmpty else { return }

        Task { @MainActor in
            self.pendingPoints.append(contentsOf: points)
            self.currentLocation = locations.last
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Log error; do not crash. CLError.locationUnknown is transient and safe to ignore.
    }
}
```

### Significant Location Changes (battery-efficient wake)

For automatic trip detection without continuous GPS drain, also use significant-location-change monitoring:

```swift
// Call once on app launch (even before authorization prompt)
clManager.startMonitoringSignificantLocationChanges()
```

The system will wake your app in the background when the device moves significantly. In `application(_:didFinishLaunchingWithOptions:)`, check for a location key in the options to handle background wakes:

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    if launchOptions?[.location] != nil {
        // App was woken by a location event — restart monitoring
        locationManager.startMonitoringSignificantLocationChanges()
    }
    return true
}
```

---

## 5. Authentication

**The current backend has no authentication layer.** All API endpoints are open to anyone who can reach the server on port 3000.

### Recommendations for production use

1. **Keep the server on a private network.** The primary security boundary is network isolation (home LAN, VLAN, or VPN).

2. **VPN access when remote.** Use Tailscale, WireGuard, or a similar solution to reach the server securely from outside the home network. The iOS app needs no special auth logic — it connects to the VPN-assigned IP/hostname.

3. **If you add a token in the future**, the API client can be extended to attach a header:
   ```swift
   req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
   ```

4. **Do not hard-code credentials or API keys** (including the Google Maps API key returned in `GET /api/settings`) in the app binary. Fetch them from the server at runtime.

---

## 6. Trip Sync Strategy

### Overview

The app must handle the case where the server is unreachable (e.g. phone is away from home Wi-Fi with no VPN). Track points should accumulate locally and be uploaded in batches when the server is available.

### Local buffer

Use a local store (e.g. an in-memory array during an active trip, flushed to `UserDefaults` or a local SQLite/Core Data store for durability across app restarts) to buffer `TrackPointUpload` values before syncing.

```swift
// Minimal persistence using UserDefaults (suitable for short trips)
// For production, prefer Core Data or SQLite for the pending point queue.

struct PendingPointStore {
    private static let key = "pendingTrackPoints"

    static func save(_ points: [TrackPointUpload]) {
        let data = try? JSONEncoder.myAuto.encode(points)
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> [TrackPointUpload] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder.myAuto.decode([TrackPointUpload].self, from: data)) ?? []
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
```

### Periodic sync during an active trip

Use a `Timer` that fires every 30 seconds while tracking is active. On each tick, drain the location buffer and POST the points to the server.

```swift
actor TripSyncManager {
    private var syncTimer: Timer?
    private var activeTripId: Int?
    private let api: MyAutoAPIClient
    private let locationManager: LocationManager
    private var failedPoints: [TrackPointUpload] = [] // retry accumulator

    init(api: MyAutoAPIClient, locationManager: LocationManager) {
        self.api = api
        self.locationManager = locationManager
    }

    // Call this after successfully creating a trip on the server
    func beginSync(tripId: Int) {
        self.activeTripId = tripId
        syncTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { await self?.syncNow() }
        }
    }

    func stopSync() {
        syncTimer?.invalidate()
        syncTimer = nil
        activeTripId = nil
    }

    private func syncNow() async {
        guard let tripId = activeTripId else { return }
        let newPoints = await locationManager.drainPendingPoints()
        let toUpload = failedPoints + newPoints

        guard !toUpload.isEmpty else { return }

        do {
            _ = try await api.uploadPoints(toUpload, tripId: tripId)
            failedPoints.removeAll()
        } catch {
            // Server unreachable — keep points for next attempt
            failedPoints = toUpload
            PendingPointStore.save(failedPoints)
        }
    }

    // Call this just before ending the trip to flush remaining points
    func flushAndStop() async {
        await syncNow()
        stopSync()
    }
}
```

### Trip lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  User taps "Start Trip" (or Bluetooth connects)         │
│  1. GET current GPS fix from LocationManager            │
│  2. POST /api/trips  → receive Trip with id             │
│  3. locationManager.startTracking()                     │
│  4. syncManager.beginSync(tripId: trip.id)              │
└────────────────────────────┬────────────────────────────┘
                             │  (every 30 s)
                             ▼
              POST /api/trips/:id/points  [batch]
                             │
                             │  User taps "End Trip"
                             ▼
┌─────────────────────────────────────────────────────────┐
│  1. syncManager.flushAndStop()  (flush remaining pts)   │
│  2. let finalPoints = locationManager.stopTracking()    │
│  3. Upload finalPoints if non-empty                     │
│  4. Calculate distance from all track points            │
│  5. PUT /api/trips/:id  with endTime, endLat/Lng,       │
│     distanceKm, durationSeconds, routePolyline          │
└─────────────────────────────────────────────────────────┘
```

### Distance calculation

The server stores distance but does not calculate it. Compute it client-side from the track points:

```swift
import CoreLocation

func calculateDistance(from points: [CLLocation]) -> Double {
    guard points.count >= 2 else { return 0 }
    var totalMetres = 0.0
    for i in 1..<points.count {
        totalMetres += points[i].distance(from: points[i - 1])
    }
    return totalMetres / 1000.0 // return km
}
```

### Handling background app termination

iOS may terminate the app while tracking. To survive this:

1. Save `activeTripId` and `failedPoints` to `UserDefaults` whenever they change.
2. On next app launch, check for a persisted `activeTripId`. If found, offer the user an option to end or discard the interrupted trip.
3. Re-register `CLLocationManager` with `allowsBackgroundLocationUpdates = true` and call `startUpdatingLocation()` — iOS will re-deliver buffered locations.

---

## 7. Bluetooth-Triggered Trip Start/Stop

The backend stores a `bluetooth_device` name per trip. The iOS app can use `CoreBluetooth` to detect when the user's car Bluetooth device connects or disconnects and automatically start/stop tracking.

### Setup

```swift
import CoreBluetooth

final class BluetoothTripTrigger: NSObject, CBCentralManagerDelegate {
    private var centralManager: CBCentralManager!
    private let targetDeviceName: String
    var onDeviceConnected: (() -> Void)?
    var onDeviceDisconnected: (() -> Void)?

    init(deviceName: String) {
        self.targetDeviceName = deviceName
        super.init()
        // Restore state if previously connected
        let options: [String: Any] = [CBCentralManagerOptionRestoreIdentifierKey: "myauto-bt"]
        centralManager = CBCentralManager(delegate: self, queue: nil, options: options)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            // Scan for the target device by name
            centralManager.scanForPeripherals(withServices: nil, options: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi: NSNumber) {
        guard peripheral.name == targetDeviceName else { return }
        centralManager.stopScan()
        centralManager.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        onDeviceConnected?()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral,
                        error: Error?) {
        onDeviceDisconnected?()
        // Reconnect for next time
        centralManager.connect(peripheral, options: nil)
    }

    // State restoration
    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
            peripherals.forEach { central.connect($0, options: nil) }
        }
    }
}
```

Add to `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>MyAuto uses Bluetooth to automatically detect when you enter your car.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>bluetooth-central</string>
</array>
```

The `bluetoothDeviceId` stored in settings is intended for identifying the device. On iOS, Core Bluetooth uses a UUID (not a MAC address) per device per app install, so store the `CBPeripheral.identifier.uuidString` as `bluetoothDeviceId` for persistence.

---

## 8. Recommended App Architecture

### Layer structure

```
┌──────────────────────────────────────────────────────┐
│  SwiftUI Views (Trips list, Trip detail, Fuel log,   │
│  Settings, Stats dashboard)                          │
└─────────────────────┬────────────────────────────────┘
                      │ @ObservedObject / @StateObject
┌─────────────────────▼────────────────────────────────┐
│  ViewModels (one per major screen)                   │
│  - TripsViewModel                                    │
│  - ActiveTripViewModel                               │
│  - FuelViewModel                                     │
│  - SettingsViewModel                                 │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
┌──────────▼──────┐   ┌───────────▼──────────────────┐
│ MyAutoAPIClient │   │ LocationManager               │
│ (actor)         │   │ (CLLocationManager wrapper)   │
└─────────────────┘   └──────────────────────────────┘
           │
┌──────────▼──────┐
│ TripSyncManager │
│ (actor)         │
└─────────────────┘
```

### Key design decisions

- **`actor` for API and sync** — prevents data races when background tasks and UI tasks both access the same state.
- **`@MainActor` on `LocationManager`** — all `@Published` property updates happen on the main thread as required by SwiftUI.
- **ViewModels as `@MainActor` classes** — safe to bind directly to SwiftUI views.
- **No third-party networking libraries** — `URLSession` with `async/await` is sufficient for this API's simplicity.
- **Offline-first point buffering** — never drop GPS samples; retry delivery on next sync tick.

### Minimum iOS version

Requires **iOS 16** or later to use `async/await` with `URLSession`, `actor` types, and modern SwiftUI features.

### Required capabilities (Xcode project settings)

| Capability | Purpose |
|------------|---------|
| Background Modes → Location updates | Continuous GPS when app is backgrounded |
| Background Modes → Uses Bluetooth LE accessories | Auto-detect car BT connection |
| Location: Always and When In Use | Background trip detection |
