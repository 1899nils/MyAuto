# MyAuto – Digitales Fahrtenbuch

Ein digitales Fahrtenbuch mit automatischer Bluetooth-Erkennung, Google Maps Integration und Apple Liquid Glass Design.

## Features

- **Automatisches Tracking** – Fahrt startet/stoppt automatisch wenn dein Handy sich mit dem Auto-Bluetooth verbindet
- **Google Maps** – Live-Route mit Verkehrsanzeige, Stauberechnung, Adress-Geocoding
- **Privat / Beruflich** – Zeitbasierte Regeln (z.B. Mo–Fr 7–19 Uhr = Beruflich), manuelle Überschreibung
- **Statistiken** – km, Dauer, Stauverzögerung, monatliche Aufschlüsselung
- **CSV Export** – Steuerkonformer Export des Fahrtenbuchs
- **Apple Liquid Glass Design** – Frosted-Glass UI, Dark Mode, responsive für Mobile + Desktop
- **PWA** – Installierbar auf iPhone/Android, offline-fähig
- **Docker** – Läuft als Container auf Unraid oder beliebigem Server

## Schnellstart mit Docker

```bash
# 1. Repository klonen
git clone <repo-url>
cd MyAuto

# 2. .env anpassen (optional)
cp .env.example .env

# 3. Starten
docker-compose up --build -d

# 4. App öffnen
open http://localhost:3000
```

### Unraid Konfiguration

Im Unraid Template:
- **Port:** 3000 (oder nach Wunsch anpassen)
- **Volume:** `/mnt/user/appdata/myauto` → `/app/data`

## Google Maps API Key einrichten

1. [Google Cloud Console](https://console.cloud.google.com) öffnen
2. Neues Projekt erstellen
3. Diese APIs aktivieren:
   - **Maps JavaScript API**
   - **Directions API**
   - **Geocoding API**
4. API Key erstellen
5. In der App unter **Einstellungen → Google Maps** eintragen

> **Kostenlos für private Nutzung**: Google gibt monatlich $200 Guthaben. Für einzelne Nutzer reicht das bei Weitem.

## Bluetooth Auto-Start einrichten

1. Chrome/Edge auf dem Smartphone öffnen (Safari unterstützt Web Bluetooth nicht)
2. App im Browser öffnen → **Dashboard → "Auto koppeln"**
3. Bluetooth des Autos im Menü auswählen
4. Ab sofort startet/stoppt die Fahrt automatisch

## Fahrt-Klassifizierung

**Zeitbasierte Regeln** (Standard):
- Mo–Fr 07:00–19:00 Uhr → Beruflich
- Alle anderen Zeiten → Privat (oder "Fragen")

**Manuell anpassen:**
- Nach jeder Fahrt erscheint ein Klassifizierungs-Dialog (wenn keine Regel greift)
- Jede Fahrt kann jederzeit in der History bearbeitet werden

**Regeln anpassen:** Einstellungen → Zeitbasierte Regeln

## Entwicklung (lokal)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (neues Terminal)
cd frontend && npm install && npm run dev
```

Frontend läuft auf http://localhost:5173, Backend auf http://localhost:3000

## Tech Stack

| Layer | Technologie |
|---|---|
| Frontend | Vite + React + TypeScript |
| State | Zustand |
| Maps | Google Maps JavaScript API |
| Backend | Node.js + Express + TypeScript |
| Datenbank | SQLite (better-sqlite3) |
| Container | Docker + docker-compose |
| PWA | vite-plugin-pwa + Workbox |

## iOS/Android App (Zukunft)

Der Code ist für [Capacitor.js](https://capacitorjs.com) vorbereitet:

```bash
npm install @capacitor/core @capacitor/ios @capacitor/android
npx cap init MyAuto com.example.myauto
npx cap add ios
npx cap add android
```

Capacitor-Plugins für native Funktionen:
- `@capacitor-community/bluetooth-le` – Natives Bluetooth (ersetzt Web Bluetooth API auf iOS)
- `@capacitor/geolocation` – GPS Tracking im Hintergrund
