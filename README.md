# 📍 Proximity Intel

<p align="center">
  <img src="./proximity-intel-banner.svg" alt="Proximity Intel Header Banner" width="560" height="280" />
</p>

> **A high-performance, full-stack spatial intelligence engine and real-time dispatch dashboard.** Optimized for on-the-go geofenced service tracking, hyper-local marketing, and optimized fleet dispatch.

---

## 🚀 Overview

**Proximity Intel** is a location-intelligence platform designed to bridge the gap between real-time spatial calculations and real-world field operations. Built on a lightweight, high-performance Node.js backend using raw mathematical **Haversine coordinates**, the system calculates and delivers dynamic geofenced alerts directly to consuming applications, field technicians, or sales agents based on their immediate physical coordinates.

## 🚀 System Architecture

**Proximity Intel** operates as a dual-layer location intelligence platform:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │               🛰️   PROXIMITY INTEL SPATIAL CONTROL PLANE                │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
   ┌──────────────────────┐                       ┌──────────────────────┐
   │ 💻 Web Control Panel │                       │ 📱 Mobile Operatives │
   │ (Admin/Branch Mgr)   │                       │ (Field App Pull)     │
   ├──────────────────────┤                       ├──────────────────────┤
   │ • Live Map View      │                       │ • Batch check uploads│
   │ • Active alerts list │  ◄──[REST Pull]───►   │ • 10-minute poll     │
   │ • Dispatch tracks    │                       │ • 500m offset alert  │
   │ • Config engine      │                       │ • Sales & Repair logs│
   └──────────────────────┘                       └──────────────────────┘
```

1. **The Admin & Branch Manager Control Panel (Web Application):**
   A comprehensive web interface displaying current active spatial alerts and tracking real-time telemetry from field operatives. Admins can visual map boundaries, dispatch routes, create service alerts, and instantly hot-swap the entire application's industry template (e.g. pest control, utility maintenance) in one click.

2. **The Field Operative Mobile Pull Architecture (Mobile Applications):**
   To keep battery and network overhead low, field client apps do not require expensive persistent WebSockets or push channels. Instead, they use a highly resilient **Pull-On-Move model**:
   * **Time-Based Pull:** The mobile client automatically fetches nearby alerts every **10 minutes**.
   * **Movement-Based Pull:** If the on-device GPS detects the operative has traveled **500 meters** or more from their last fetch coordinates, it triggers an immediate local query.
   * **Upload & Correlate:** Operatives upload their current coordinates to the dynamic `/v1/alerts/batch-check` endpoint, returning immediate, Haversine-filtered surrounding customer sales or work orders.

### 💡 Enterprise Architectural Review: Why "Pull-on-Move" Outperforms Push

When deploying real-world location-intelligence products to thousands of field operatives, standard push notification networks (FCM/APNs) or persistent real-time sockets (WebSockets) introduce severe operational failure modes. **Proximity Intel’s hybrid 10m/500m Pull-on-Move model represents a battle-tested enterprise solution pattern.**

Here is the technical architectural analysis of why this strategy is superior:

#### 1. 🔋 Battery Preservation & Radio Power States (DRX)
Keeping a persistent TCP/WebSocket connection active forces the mobile device’s cellular baseband processor to remain in a high-power state (`Continuous RX/TX`), rapidly draining battery. By grouping spatial checks into periodic pulls, the mobile OS can place the cellular radio into **DRX (Discontinuous Reception) sleep modes**. 
* GPS checks are handled via low-power hardware geocells (e.g., standard iOS `Significant Location Change` API or Android `FusedLocationProvider`), which only wakes the application container when the device registers physical movement past the 500-meter threshold, saving up to **70% of daily battery consumption**.

#### 2. 📴 Dead-Zone Tolerance & Local Offline Resilience
Field service technicians and local utility crews constantly work in building basements, remote rural nodes, or dense concrete downtown canyons with spotty coverage.
* **The Push Failure:** Push messages are "fire-and-forget". If an operative enters a dead zone, push triggers are permanently lost.
* **The Pull Solution:** With a client-side database (such as SQLite on-device), the mobile client caches the last-known state. When connectivity drops, the app enqueues its coordinates. Once the baseband radio re-establishes a connection, it performs an HTTP Pull retry with exponential backoff—ensuring that dynamic alerts are *never* missed.

#### 3. 🛡️ Bypassing Mobile OS Geofencing Limitations
Modern mobile operating systems place severe constraints on native geofencing:
* **iOS & Android Constraints:** The OS limits applications to a maximum of **20 active geofences** at any given time, and updates are often throttled or delayed by up to 10 minutes to protect battery life.
* **Proximity Intel’s Advantage:** By moving the spatial computations server-side to the `/v1/alerts/batch-check` endpoint, the mobile app only needs to send its current location. The server queries an infinite list of nearby active alerts in a single call using high-speed spatial indexing, bypassing OS limits entirely and achieving sub-second spatial precision.

#### 4. 📈 High-Throughput Server Scalability & Edge Caching
Maintaining 50,000 concurrent WebSockets requires expensive load-balancers, complex stateful socket servers, and substantial memory footprint per connection.
* By using REST-based HTTP pulling, requests are stateless. This allows enterprise deployment structures to place spatial query results behind an edge layer (like Cloudflare or Fastly) or use lightweight server-side Redis clustering, reducing server workloads to standard, dirt-cheap, highly-cacheable API requests.

---

## 🎯 Supported Alert Profiles & Industry Applications

**Proximity Intel** supports custom telemetry alerts including:
* **City Maintenance Reports:** Blocked drains, active road repair pits, or utility main failures.
* **Service Provider Enquiries:** Pending service tickets, active fiber/cable upgrade requests.
* **Home Services & Repair:** Major appliance repairs, local HVAC replacements, or plumbing interventions.
* **Pest Control Sales & Treatments:** Major local sales made, structural pest control barriers deployed, or localized treatment reports.

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

## 🔌 API & Integration Guide

Mobile clients and external dispatch applications integrate with the **Proximity Intel** spatial engine via a standard REST API.

### 1. Retrieve Active Multi-Industry Configuration
* **Endpoint:** `GET /v1/config`
* **Response:** Returns the active terminology, branding assets, allowed categories, and symbols configured by the administrator.

```json
{
  "industry": "Multi-Industry Spatial Intelligence",
  "appName": "Proximity Intel",
  "alertNameSingular": "Service Alert",
  "allowedCategories": ["City Maintenance", "Cable TV Enquiry", "Pest Control Sale", "Home Repair"]
}
```

### 2. Fetch All Global Active Alerts
* **Endpoint:** `GET /v1/alerts`
* **Response:** Returns all active geographic warnings, including metadata, severity, and geofence lifespans.

### 3. Ingest/Report New Service Alert
* **Endpoint:** `POST /v1/alerts`
* **Payload:**
```json
{
  "lat": 35.1436,
  "lon": -89.9812,
  "pestType": "City Maintenance",
  "severity": 3,
  "source": "Technician Mobile App Upload",
  "customDuration": 86400
}
```

### 4. Dynamic Spatial Batch-Check (Client Coordinates Upload)
Consuming mobile clients upload coordinate batches to retrieve a prioritized array of alerts sorted by exact Haversine distance, matching the dynamic **10-minute/500-meter** polling threshold.

* **Endpoint:** `POST /v1/alerts/batch-check`
* **Payload:**
```json
{
  "appointments": [
    { "id": "tech-current-pos", "lat": 35.1492, "lon": -89.9721 }
  ],
  "maxDistanceKm": 1.5
}
```
* **Response:** The system maps the coordinates to a high-speed spatial grid cell, queries all 9 surrounding adjacent cells (a 3x3 grid cluster) in Redis, calculates the exact Haversine distance for each item, and returns filtered matches:
```json
{
  "success": true,
  "queryTimestamp": "2026-07-05T19:17:17.000Z",
  "globalMaxDistanceKm": 1.5,
  "engine": "RedisLive",
  "appointments": [
    {
      "id": "tech-current-pos",
      "lat": 35.1492,
      "lon": -89.9721,
      "gridKey": "35.15_-89.97",
      "cluster": ["35.15_-89.97", "35.15_-89.98", "35.15_-89.96", "35.16_-89.97", "35.14_-89.97", "35.16_-89.98", "35.16_-89.96", "35.14_-89.98", "35.14_-89.96"],
      "maxDistanceKm": 1.5,
      "alerts": [
        {
          "id": "alert-8b29f9",
          "lat": 35.1481,
          "lon": -89.9743,
          "pestType": "City Maintenance",
          "severity": 3,
          "source": "Downtown Sewer Main Report",
          "distanceKm": 0.23,
          "distanceM": 230
        }
      ]
    }
  ]
}
```

---

## 📱 Interactive Mobile Operative Simulator 

To verify the **Pull-on-Move & Offline Queuing** architecture ,included a completely self-contained **Mobile Client Simulator** at `/assets/mobile_simulator.html`.

This simulation sandbox operates independently of the core server code but communicates directly with the active backend REST API endpoints.

### How to use it for your Screen Recording:
1. **Open the Simulator:** Open `/assets/mobile_simulator.html` in any web browser.
2. **Configure Host:** The client automatically detects the current server host. If running locally or on a custom domain, simply paste your server address (e.g., `http://localhost:3000` or your Cloud Run URL) into the target bar and click **Set Target**.
3. **Simulate Metro Hubs:** Click **Memphis Core**, **Cordova Sector**, or **Germantown** to instant-warp the simulated agent to pre-seeded hotzones.
4. **Demonstrate Pull-on-Move:** 
   * Click on the Leaflet map or use the **GPS directional joystick (▲ ▼ ◀ ▶)** to move the technician.
   * Moving **over 500 meters** will trigger an automatic, server-side Haversine search, highlighting dynamic polling.
5. **Demonstrate Dead-Zone Resilience:**
   * Toggle **Live Connection** to **Simulation Offline**.
   * Move the agent. The logs will show coordinates caching locally.
   * Toggle back to **Live Connection**. The queue immediately flushes, pulling newly matched alerts from the server!
6. **Evaluate Payload:** Inspect the **Real-time Telemetry console** to see the exact JSON payload sent to `/v1/alerts/batch-check` and parsed JSON response streams.

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
