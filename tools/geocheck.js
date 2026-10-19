'use strict';
/* Where is a WGS84 point? Used by tools/build.js to validate GeoMap places. */

const R = 6371.0088;
const rad = d => d * Math.PI / 180;

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inPolygon = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some(h => inRing(x, y, h));

/* distance (km) from a point to a ring's edges, local equirectangular approximation */
function ringDistanceKm(lat, lng, ring) {
  const kx = Math.cos(rad(lat)) * 111.32, ky = 110.57;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lng) * kx, ay = (ring[i][1] - lat) * ky;
    const bx = (ring[i + 1][0] - lng) * kx, by = (ring[i + 1][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

const polygonsOf = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

/*
  Returns { where, name, km }:
    province    inside a province polygon (mainland or coastal island)
    archipelago inside a Hoang Sa / Truong Sa island polygon
    feature     within `tolKm` of a named archipelago feature (reef, bank, island point)
    near        outside, but within `tolKm` of a coastline (coarse data tolerance)
    outside     further away -> error
*/
function locate(lat, lng, geo, tolKm = 5) {
  for (const f of geo.provinces.features)
    for (const poly of polygonsOf(f)) if (inPolygon(lng, lat, poly)) return { where: 'province', name: f.properties.name, km: 0 };
  for (const f of geo.archipelagos.features)
    for (const poly of polygonsOf(f)) if (inPolygon(lng, lat, poly)) return { where: 'archipelago', name: f.properties.archipelago, km: 0 };

  let best = { km: Infinity, name: '' };
  for (const p of geo.features) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < best.km) best = { km: d, name: p.name, archipelago: p.archipelago };
  }
  if (best.km <= tolKm) return { where: 'feature', name: best.name, archipelago: best.archipelago, km: best.km };

  let near = { km: Infinity, name: '' };
  for (const set of [geo.provinces, geo.archipelagos])
    for (const f of set.features)
      for (const poly of polygonsOf(f)) {
        const d = ringDistanceKm(lat, lng, poly[0]);
        if (d < near.km) near = { km: d, name: f.properties.name || f.properties.archipelago };
      }
  if (near.km <= tolKm) return { where: 'near', name: near.name, km: near.km };
  return { where: 'outside', name: near.name, km: Math.min(near.km, best.km) };
}

module.exports = { locate, haversineKm };
