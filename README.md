# 📍 Proximity Intel

> **A high-performance, full-stack spatial intelligence engine and real-time dispatch dashboard.** Optimized for on-the-go geofenced service tracking, hyper-local marketing, and optimized fleet dispatch.

---

## 🚀 Overview

**Proximity Intel** is a location-intelligence platform designed to bridge the gap between real-time spatial calculations and real-world field operations. Built on a lightweight, high-performance Node.js backend using raw mathematical **Haversine coordinates**, the system calculates and delivers dynamic geofenced alerts directly to consuming applications, field technicians, or sales agents based on their immediate physical coordinates.

By centralizing and generalizing the underlying spatial engine, **Proximity Intel** can be instantly hot-swapped for any industry via a simple configuration file.

---

## 🎯 High-Impact Use Cases

This project is built to solve distinct operational and revenue challenges across several sectors:

### 1. 🏠 Localized Sales & Social Proof (e.g., Home Services, Pest Control)
* **The Scenario:** Sales representatives walking a neighborhood need immediate insights into nearby active accounts.
* **The Solution:** Representatives use the geofence to instantly identify adjacent properties with active service history, providing powerful, localized social proof ("We are treating your neighbor 2 doors down for termites today, so we can waive your initial setup fee").

### 2. ⚡ Proactive Municipal & Utility Maintenance (e.g., Smart Cities)
* **The Scenario:** Field crews driving between scheduled sites pass active maintenance hazards without knowing they are nearby.
* **The Solution:** The backend automatically broadcasts alerts when workers cross defined geographic radii, allowing technicians to resolve neighboring service issues on-the-go, dramatically reducing truck-rolls.

### 3. 📡 Logistics & Customer Concentration Discounts (e.g., Cable, Telco, Delivery)
* **The Scenario:** Serving isolated customers incurs massive logistical overhead.
* **The Solution:** Sales coordinators target prospective buyers in clusters with existing infrastructure, offering high-density area discounts to maximize route density and minimize operational margins.

---

## 🛠️ Key Technical Features

- **Raw Haversine Spatial Querying:** High-speed server-side calculations sorting coordinates by dynamic proximity thresholds without relying on costly third-party geospatial database extensions.
- **Dynamic Multi-Industry Config (`config.json`):** Decoupled terminology, color schemes, map symbols, and allowed telemetry ranges into a unified schema for instant re-branding and configuration.
- **Interactive Leaflet.js Mapping Matrix:** Lightweight, fluid front-end representing technician paths, geofenced boundaries, and live service clusters.
- **Resilient Redis & In-Memory Hybrid Storage:** Built with dual-mode storage to ensure enterprise-readiness while remaining extremely easy for anyone to clone and run locally.

---

## 💾 Storage Architecture & Redis Integration

**Proximity Intel** is designed for ultra-low latency reads and writes. To achieve this, it implements a **resilient hybrid storage architecture** utilizing **Redis** as its primary live memory-store:

```
  ┌─────────────────────────────────────────────────────────┐
  │                      REST API                           │
  └──────────────────────────┬──────────────────────────────┘
                             │ (Reads / Writes)
                             ▼
              ┌─────────────────────────────┐
              │    Dynamic Storage Router   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     [ Live Redis Host ]           [ Self-Healing Memory ]
     • High-throughput caching     • Active fallback sandbox
     • Production-grade speeds     • Zero-dependency sandbox
     • Persistent keyspace         • Auto-seeded on-the-fly
```

### Key Design Highlights:
1. **Production Redis Cache:** When a Redis instance is available (detected via `REDIS_URL` or default `localhost:6379`), the engine binds directly to Redis, serving pre-seeded geographic records with sub-millisecond lookups.
2. **Seamless In-Memory Failover:** If Redis is offline or connection attempts are refused, the server **automatically fails over to an internal in-memory spatial database mock**.
3. **Automatic Pre-Seeding:** Upon boot (either in Redis or local memory), the engine automatically seeds **100 high-accuracy geographic service alerts** across the Memphis, Cordova, and Germantown (TN) metro areas to provide immediate spatial data.

---

## ⚙️ Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configuration
Modify `src/config.json` to swap out service types, naming conventions, and visual markers:
```json
{
  "industry": "Multi-Industry Spatial Intelligence",
  "appName": "Proximity Intel",
  "appSubtitle": "Location-Based Dispatch & Sales Enablement Engine",
  "alertNameSingular": "Service Alert",
  "alertNamePlural": "Service Alerts",
  "allowedCategories": ["ServiceType 1", "ServiceType 2", "ServiceType 3", "ServiceType 4"]
}
```

### 3. Database & Caching Setup (Optional)
By default, the application **automatically uses the in-memory fallback engine** if Redis is not installed. 

To run with a live Redis container:
```bash
# Spin up Redis via Docker
docker run -d --name redis-proximity -p 6379:6379 redis:alpine
```
The server will auto-detect the live container and output:
`✅ [Proximity Intel Redis] Linked to live Redis host.`

### 4. Run Development Server
```bash
npm run dev
```
The application will boot at `http://localhost:3000` with simulated data pre-seeded in the Memphis, TN metropolitan area.
