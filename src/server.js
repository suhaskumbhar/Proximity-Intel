/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import { promises as fs, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Redis from "ioredis";
import { getGridKey, getClusterKeys, calculateHaversineDistance } from "./geo.js";

// Load configuration if any
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Load active industry config synchronously on startup to guarantee availability
const configPath = path.join(__dirname, "config.json");
let appConfig;
try {
  appConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  console.log(`✅ [Config Engine] Loaded dynamic industry settings: ${appConfig.appName} (${appConfig.industry})`);
} catch (err) {
  console.error("⚠️ Failed to load config.json, using safe defaults:", err);
  appConfig = {
    industry: "Generic Operations",
    appName: "Service-Alert Core",
    appSubtitle: "Low-Latency Spatial Engine v2.4",
    alertNameSingular: "Service Alert",
    alertNamePlural: "Service Alerts",
    categoryLabel: "Service Type (Target Dispatch Category)",
    allowedCategories: ["ServiceType 1", "ServiceType 2", "ServiceType 3", "ServiceType 4"],
    categories: [
      { id: "ServiceType 1", name: "ServiceType 1", emoji: "🔧" },
      { id: "ServiceType 2", name: "ServiceType 2", emoji: "📦" },
      { id: "ServiceType 3", name: "ServiceType 3", emoji: "⚡" },
      { id: "ServiceType 4", name: "ServiceType 4", emoji: "💧" }
    ]
  };
}

// ==========================================
// HIGH-PERFORMANCE IN-MEMORY REDIS FALLBACK
// ==========================================
class InMemoryRedisMock {
  constructor() {
    this.store = new Map();     // key -> stringified JSON value
    this.expires = new Map();   // key -> expiration timestamp (ms)
    console.warn(`ℹ️ [${appConfig.appName}] Storage Initialized: High-Performance In-Memory Sandbox Mode.`);
  }

  async set(key, value) {
    this.store.set(key, value);
    return "OK";
  }

  async expire(key, seconds) {
    const expiryTime = Date.now() + (seconds * 1000);
    this.expires.set(key, expiryTime);
    return 1;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.expires.entries()) {
      if (now > expiry) {
        this.store.delete(key);
        this.expires.delete(key);
      }
    }
  }

  async keys(pattern) {
    this._cleanup();
    // Convert Redis glob pattern (e.g. "alert:43.65_-79.38:*") to a RegExp
    const regexPattern = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    const matched = [];
    for (const key of this.store.keys()) {
      if (regexPattern.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  async mget(keys) {
    this._cleanup();
    return keys.map(key => this.store.get(key) || null);
  }

  pipeline() {
    const self = this;
    const commands = [];
    return {
      keys(pattern) {
        commands.push(async () => {
          return self.keys(pattern);
        });
        return this;
      },
      async exec() {
        const results = [];
        for (const cmd of commands) {
          try {
            const res = await cmd();
            results.push([null, res]); // [err, res] format
          } catch (err) {
            results.push([err, null]);
          }
        }
        return results;
      }
    };
  }
}

// ==========================================
// REDIS CONNECTION & RESILIENCY ENGINE
// ==========================================
let redisClient;
let isFallbackMode = false;
const inMemoryStore = new InMemoryRedisMock();

// Seed 100 random alerts for Memphis, Cordova, and Germantown TN using active configuration
async function seedMemphisAlerts() {
  const allowedCategories = appConfig.allowedCategories;
  console.log(`🌱 [Seed Engine] Pre-loading 100 Memphis, Cordova, & Germantown alerts (${allowedCategories.join(" & ")})...`);
  const memphisAlerts = [];
  
  const severities = [1, 2, 3, 4];
  
  const regions = [
    {
      name: "Memphis",
      latMin: 35.1100, latMax: 35.1600,
      lonMin: -90.0600, lonMax: -89.9500,
      sources: [
        "Downtown Central Hub", "Main Water Canal", "Court Square Structural Maintenance",
        "Overton Park Grid Station", "Midtown Utility Pipeline", "Memphis Zoo Facility",
        "Stax Area Depot", "Cooper-Young District Operations", "Beale Street Event Point",
        "South Memphis Infrastructure", "Victorian Village Grid Check", "Mud Island Storage Yard"
      ]
    },
    {
      name: "Cordova",
      latMin: 35.1500, latMax: 35.1900,
      lonMin: -89.8200, lonMax: -89.7400,
      sources: [
        "Shelby Farms Service Trail", "Wolfchase Distribution Center", "Cordova Hub Site",
        "Fletcher Creek Drainage Station", "Appling Lake Substation", "Germantown Road Outlet",
        "Cordova Yard", "Sanger Road Maintenance Point", "Macon Road Facility", "Bert Johnston Area"
      ]
    },
    {
      name: "Germantown",
      latMin: 35.0600, latMax: 35.1100,
      lonMin: -89.8300, lonMax: -89.7500,
      sources: [
        "Farmington Substation", "Germantown Depot Timber Yard", "Poplar Avenue Junction",
        "Wolf River Nature Station", "Brierbrook Drainage Check", "Johnson Road Transformer",
        "Germantown Athletic Club Power", "Dogwood Site Junction", "Kimbrough Road Vault"
      ]
    }
  ];

  for (let i = 1; i <= 100; i++) {
    const region = regions[(i - 1) % regions.length];
    const lat = Number((region.latMin + Math.random() * (region.latMax - region.latMin)).toFixed(4));
    const lon = Number((region.lonMin + Math.random() * (region.lonMax - region.lonMin)).toFixed(4));
    
    const pestType = allowedCategories[(i - 1) % allowedCategories.length];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const sourceTemplate = region.sources[Math.floor(Math.random() * region.sources.length)];
    const id = `mem-alert-${String(i).padStart(3, '0')}`;
    
    memphisAlerts.push({
      id,
      lat,
      lon,
      pestType,
      severity,
      source: `${sourceTemplate} (Ref #${1000 + i})`
    });
  }

  const ttlSeconds = 2592000; // 30 days
  for (const alert of memphisAlerts) {
    const gridKey = getGridKey(alert.lat, alert.lon);
    const redisKey = `alert:${gridKey}:${alert.id}`;
    const alertData = {
      ...alert,
      gridKey,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };
    
    // Write to fallback inMemoryStore
    await inMemoryStore.set(redisKey, JSON.stringify(alertData));
    await inMemoryStore.expire(redisKey, ttlSeconds);

    // Write to Redis if online
    if (redisClient && !isFallbackMode) {
      try {
        await redisClient.set(redisKey, JSON.stringify(alertData));
        await redisClient.expire(redisKey, ttlSeconds);
      } catch (err) {
        // Silently capture any transient write error during initialization
      }
    }
  }
  console.log("✅ [Seed Engine] Successfully preloaded 100 Memphis, Cordova, & Germantown alerts!");
}

try {
  // Attempt to initialize Redis connection
  redisClient = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 1) {
        // Halt retries to prevent blocking startup
        isFallbackMode = true;
        return null;
      }
      return 100; // Retry once after 100ms
    }
  });

  redisClient.on("error", (err) => {
    if (!isFallbackMode) {
      console.warn(`⚠️ [${appConfig.appName} Redis] Offline or Refused: ${err.message}`);
      console.warn(`🔄 [${appConfig.appName} Engine] Seamlessly failed over to in-memory spatial database.`);
      isFallbackMode = true;
    }
  });

  redisClient.on("connect", () => {
    console.log(`✅ [${appConfig.appName} Redis] Linked to live Redis host.`);
    isFallbackMode = false;
    seedMemphisAlerts().catch(err => console.error("Failed to seed Redis on connect:", err));
  });
} catch (error) {
  console.warn("⚠️ Failed to boot standard ioredis client. Using in-memory fallback.");
  isFallbackMode = true;
}

/**
 * Resolves the active database client based on connection health.
 */
function getDb() {
  if (isFallbackMode || !redisClient) {
    return inMemoryStore;
  }
  return redisClient;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Calculates Redis TTL (seconds) based on alert severity.
 */
function getTTL(severity, customDuration) {
  const sev = Number(severity);
  if (sev === 1 || sev === 2) {
    return 2592000; // 30 days
  }
  if (sev === 3) {
    return 1209600; // 14 days
  }
  if (sev === 4) {
    return Number(customDuration) || 604800; // Custom duration or 7 days default
  }
  return 2592000; // Fallback to 30 days
}

/**
 * Sets basic CORS headers to handle cross-origin requests.
 */
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Helper to parse the request stream as JSON.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk.toString();
    });
    req.on("end", () => {
      if (!rawBody.trim()) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(rawBody);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

// ==========================================
// CORE HTTP SERVER
// ==========================================
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL pathname
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = reqUrl.pathname;

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  // ROUTE: GET / or GET /index.html
  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    try {
      const pagePath = path.join(process.cwd(), "public", "index.html");
      const html = await fs.readFile(pagePath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      console.error("Failed to serve dashboard HTML:", err);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error: Dashboard file public/index.html is missing or corrupted.");
    }
    return;
  }

  // ROUTE: GET /assets/mobile_simulator.html (Serve mobile client simulator for testing & demos)
  if (req.method === "GET" && pathname === "/assets/mobile_simulator.html") {
    try {
      const pagePath = path.join(process.cwd(), "assets", "mobile_simulator.html");
      const html = await fs.readFile(pagePath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      console.error("Failed to serve mobile simulator:", err);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found: Mobile simulator file is missing.");
    }
    return;
  }

  // ROUTE: GET /proximity-intel-banner.svg or /assets/proximity-intel-banner.svg
  if (req.method === "GET" && (pathname === "/proximity-intel-banner.svg" || pathname === "/assets/proximity-intel-banner.svg")) {
    try {
      const pagePath = path.join(process.cwd(), pathname.startsWith("/assets/") ? "assets" : "", "proximity-intel-banner.svg");
      const svg = await fs.readFile(pagePath);
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(svg);
    } catch (err) {
      console.error("Failed to serve banner SVG:", err);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found: Banner SVG file is missing.");
    }
    return;
  }

  // ROUTE: GET /v1/config (Get active industry configurations)
  if (req.method === "GET" && pathname === "/v1/config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(appConfig));
    return;
  }

  // ROUTE: GET /v1/alerts (Get all available alerts)
  if (req.method === "GET" && pathname === "/v1/alerts") {
    try {
      const db = getDb();
      const keys = await db.keys("alert:*");
      const alerts = [];
      if (keys && keys.length > 0) {
        const values = await db.mget(keys);
        for (let i = 0; i < keys.length; i++) {
          const rawVal = values[i];
          if (rawVal) {
            try {
              alerts.push(JSON.parse(rawVal));
            } catch (err) {
              // Ignore corrupt entries
            }
          }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        engine: isFallbackMode ? "InMemorySandbox" : "RedisLive",
        alerts
      }));
    } catch (err) {
      console.error("Failed to retrieve all alerts:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to fetch all available alerts.", message: err.message }));
    }
    return;
  }

  // ROUTE: POST /v1/alerts (Ingestion)
  if (req.method === "POST" && pathname === "/v1/alerts") {
    try {
      const body = await parseJsonBody(req);
      if (!body) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid payload. Body must be non-empty JSON." }));
        return;
      }

      const { lat, lon, pestType, severity, source, customDuration } = body;

      // Validate required inputs
      if (lat === undefined || lon === undefined || !pestType || !severity) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required properties: lat, lon, pestType, severity." }));
        return;
      }

      // Validate coordinates
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid coordinates. Latitude must be -90 to 90, Longitude -180 to 180." }));
        return;
      }

      // Validate dynamic Category Enum from active configuration
      const allowedCategories = appConfig.allowedCategories;
      if (!allowedCategories.includes(pestType)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Invalid ${appConfig.categoryLabel}. Permitted options: ${allowedCategories.join(", ")}` }));
        return;
      }

      // Validate Severity (1 to 4)
      const sevNum = Number(severity);
      if (isNaN(sevNum) || sevNum < 1 || sevNum > 4) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Severity must be an integer score from 1 to 4." }));
        return;
      }

      // Calculate spatial grid
      const gridKey = getGridKey(latNum, lonNum);
      const uniqueId = Math.random().toString(36).substring(2, 10) + Date.now().toString().slice(-4);
      const redisKey = `alert:${gridKey}:${uniqueId}`;
      const ttlSeconds = getTTL(sevNum, customDuration);

      const alertData = {
        id: uniqueId,
        gridKey,
        lat: latNum,
        lon: lonNum,
        pestType,
        severity: sevNum,
        source: source || "Field Technician Input",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };

      const db = getDb();
      await db.set(redisKey, JSON.stringify(alertData));
      await db.expire(redisKey, ttlSeconds);

      res.writeHead(211, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: "Alert ingested successfully",
        alert: alertData,
        storageKey: redisKey,
        ttl: ttlSeconds,
        engine: isFallbackMode ? "InMemorySandbox" : "RedisLive"
      }));
    } catch (err) {
      console.error("Ingestion failed:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Malformed JSON payload or schema mismatch.", message: err.message }));
    }
    return;
  }

  // ROUTE: POST /v1/alerts/batch-check (Batch Check for Appointments with Haversine Filter)
  if (req.method === "POST" && pathname === "/v1/alerts/batch-check") {
    try {
      const body = await parseJsonBody(req);
      let appointments = [];
      let globalMaxDistanceKm = 1.0; // Default 1.0 km threshold if none specified

      if (Array.isArray(body)) {
        appointments = body;
      } else if (body && typeof body === "object") {
        if (Array.isArray(body.appointments)) {
          appointments = body.appointments;
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Payload must be a JSON array of appointments, or an object: { appointments: [...], maxDistanceKm: 1.0 }" }));
          return;
        }
        if (body.maxDistanceKm !== undefined && !isNaN(Number(body.maxDistanceKm))) {
          globalMaxDistanceKm = Number(body.maxDistanceKm);
        }
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload must be a JSON array of appointments, or an object: { appointments: [...], maxDistanceKm: 1.0 }" }));
        return;
      }

      // 1. Gather coordinates & pre-compute 3x3 surrounding keys to search
      const uniqueGridKeysToQuery = new Set();
      const processedAppointments = [];

      for (const appt of appointments) {
        const { id, lat, lon, maxDistanceKm } = appt;
        if (lat === undefined || lon === undefined) {
          continue;
        }
        const latNum = Number(lat);
        const lonNum = Number(lon);
        if (isNaN(latNum) || isNaN(lonNum)) {
          continue;
        }

        const cluster = getClusterKeys(latNum, lonNum);
        processedAppointments.push({
          id: id || `appt-${Math.random().toString(36).substring(2, 6)}`,
          lat: latNum,
          lon: lonNum,
          gridKey: getGridKey(latNum, lonNum),
          maxDistanceKm: maxDistanceKm !== undefined ? Number(maxDistanceKm) : undefined,
          cluster
        });

        for (const k of cluster) {
          uniqueGridKeysToQuery.add(k);
        }
      }

      // 2. Query Redis in a pipeline for all needed grid keys
      const db = getDb();
      const pipeline = db.pipeline();
      const uniqueKeysList = Array.from(uniqueGridKeysToQuery);

      for (const gridKey of uniqueKeysList) {
        pipeline.keys(`alert:${gridKey}:*`);
      }

      const pipelineResults = await pipeline.exec();
      const allAlertKeysToFetch = [];
      const gridKeyToRedisKeys = new Map();

      for (let i = 0; i < uniqueKeysList.length; i++) {
        const gridKey = uniqueKeysList[i];
        const [err, matchedKeys] = pipelineResults[i];
        
        if (!err && matchedKeys && matchedKeys.length > 0) {
          allAlertKeysToFetch.push(...matchedKeys);
          gridKeyToRedisKeys.set(gridKey, matchedKeys);
        } else {
          gridKeyToRedisKeys.set(gridKey, []);
        }
      }

      // 3. Batch MGET to retrieve parsed alerts content
      const alertRegistry = new Map(); // redisKey -> parsed alert object

      if (allAlertKeysToFetch.length > 0) {
        const values = await db.mget(allAlertKeysToFetch);
        for (let i = 0; i < allAlertKeysToFetch.length; i++) {
          const redisKey = allAlertKeysToFetch[i];
          const rawVal = values[i];
          if (rawVal) {
            try {
              const alertObj = JSON.parse(rawVal);
              alertRegistry.set(redisKey, alertObj);
            } catch (parseErr) {
              console.error(`Failed parsing stored key ${redisKey}:`, parseErr);
            }
          }
        }
      }

      // 4. Map matching alerts from clusters back to each appointment using Haversine Formula distance filtering
      const resultAppointments = processedAppointments.map(appt => {
        const matchedAlerts = [];
        const uniqueAlertIds = new Set();
        const threshold = appt.maxDistanceKm !== undefined && !isNaN(Number(appt.maxDistanceKm))
          ? Number(appt.maxDistanceKm)
          : globalMaxDistanceKm;

        for (const clusterGridKey of appt.cluster) {
          const redisKeys = gridKeyToRedisKeys.get(clusterGridKey) || [];
          for (const rKey of redisKeys) {
            const alert = alertRegistry.get(rKey);
            if (alert && !uniqueAlertIds.has(alert.id)) {
              // Exact geodetic distance in kilometers
              const distance = calculateHaversineDistance(appt.lat, appt.lon, alert.lat, alert.lon);
              
              if (distance <= threshold) {
                uniqueAlertIds.add(alert.id);
                matchedAlerts.push({
                  ...alert,
                  distanceKm: Number(distance.toFixed(3)),
                  distanceM: Number((distance * 1000).toFixed(0))
                });
              }
            }
          }
        }

        // Sort alerts: nearest first
        matchedAlerts.sort((a, b) => a.distanceKm - b.distanceKm);

        return {
          id: appt.id,
          lat: appt.lat,
          lon: appt.lon,
          gridKey: appt.gridKey,
          cluster: appt.cluster,
          maxDistanceKm: threshold,
          alerts: matchedAlerts
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        queryTimestamp: new Date().toISOString(),
        globalMaxDistanceKm,
        engine: isFallbackMode ? "InMemorySandbox" : "RedisLive",
        appointments: resultAppointments
      }));
    } catch (err) {
      console.error("Batch check failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error during spatial aggregation.", message: err.message }));
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end(`404 Not Found: Path does not exist in ${appConfig.appName} API.`);
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`🚀 [${appConfig.appName} System] Backend running at http://${HOST}:${PORT}`);
  console.log(`📁 Serve dashboard at: http://localhost:3000/`);
  seedMemphisAlerts().catch(err => console.error("Initial database seeding failed:", err));
});
