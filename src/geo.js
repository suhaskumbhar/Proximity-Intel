/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts standard coordinates (lat, lon) into a string grid key.
 * Rounds to nearest 1/50th (0.02) and formats to exactly 2 decimal places.
 * E.g., "43.65_-79.38"
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} The spatial grid key
 */
export function getGridKey(lat, lon) {
  const gridLat = (Math.round(Number(lat) * 50) / 50).toFixed(2);
  const gridLon = (Math.round(Number(lon) * 50) / 50).toFixed(2);
  return `${gridLat}_${gridLon}`;
}

/**
 * Accepts (lat, lon) and returns an array of the 9 unique grid keys
 * making up the 3x3 surrounding cluster centered on the coordinate's grid key.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string[]} Array of 9 unique grid keys
 */
export function getClusterKeys(lat, lon) {
  const keys = [];
  const step = 0.02; // 1 / 50
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const neighborLat = Number(lat) + dLat * step;
      const neighborLon = Number(lon) + dLon * step;
      keys.push(getGridKey(neighborLat, neighborLon));
    }
  }
  return Array.from(new Set(keys));
}

/**
 * Calculates the geodetic distance in kilometers between two coordinates.
 * Using the high-performance Haversine formula.
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
  const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

