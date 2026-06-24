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
- **High-Performance Redis Cache Architecture:** Configured for high-throughput with a robust, zero-dependency in-memory mock failover to guarantee immediate standalone local development.

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

### 3. Run Development Server
```bash
npm run dev
```
The application will boot at `http://localhost:3000` with simulated data pre-seeded in the Memphis, TN metropolitan area.
