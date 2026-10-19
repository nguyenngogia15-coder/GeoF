'use strict';
/*
  One-off preparation of the GeoMap boundary data (run only if the sources change):
    node tools/geo-prepare.js

  Inputs  (geodata/):
    source-geoBoundaries-VNM-ADM1.geojson   geoBoundaries gbOpen, Vietnam ADM1 (provinces + islands)
    source-wikidata-islands.json            Wikidata (CC0) features of the Paracel / Spratly groups
  Outputs (geodata/):
    vietnam-provinces.geo.json     provinces (mainland + coastal islands), simplified
    vietnam-archipelagos.geo.json  Hoang Sa / Truong Sa island polygons, NOT simplified
    archipelago-features.json      named islands / reefs / banks with real coordinates (Wikidata)
*/
const fs = require('fs');
const path = require('path');
const { topology } = require('topojson-server');
const { presimplify, simplify, quantile } = require('topojson-simplify');
const { feature } = require('topojson-client');
const d3 = require('d3');

const DIR = path.resolve(__dirname, '..', 'geodata');
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const write = (f, o) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(o));
// d3-geo expects clockwise exterior rings (the opposite of RFC 7946): reverse any polygon that d3 would read as 'everything except this shape'
const fixWinding = poly => d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI ? poly.map(r => r.slice().reverse()) : poly;
const round = (c, d) => Array.isArray(c[0]) ? c.map(x => round(x, d)) : c.map(v => +v.toFixed(d));

const src = read('source-geoBoundaries-VNM-ADM1.geojson');
const ISLAND_LON = 110; // anything east of this in Da Nang / Khanh Hoa is Hoang Sa / Truong Sa
const ARCH = { 'Đà Nẵng': 'Hoàng Sa', 'Khánh Hòa': 'Trường Sa' };

const provinces = [], islands = [];
for (const f of src.features) {
  const name = f.properties.shapeName;
  if (!ARCH[name]) { provinces.push({ type: 'Feature', properties: { name }, geometry: f.geometry }); continue; }
  const main = [], isl = [];
  for (const poly of f.geometry.coordinates) {
    const lon = poly[0].reduce((s, c) => s + c[0], 0) / poly[0].length;
    (lon > ISLAND_LON ? isl : main).push(poly);
  }
  provinces.push({ type: 'Feature', properties: { name }, geometry: { type: 'MultiPolygon', coordinates: main } });
  isl.forEach(poly => islands.push({
    type: 'Feature',
    properties: { province: name, archipelago: ARCH[name] },
    geometry: { type: 'Polygon', coordinates: fixWinding(round(poly, 4)) },
  }));
}

// simplify provinces with a shared topology so borders between provinces stay glued together
const topo = presimplify(topology({ p: { type: 'FeatureCollection', features: provinces } }));
const simp = simplify(topo, quantile(topo, 0.55));
const fc = feature(simp, simp.objects.p);
fc.features.forEach(f => {
  f.geometry.coordinates = round(f.geometry.coordinates, 3);
  if (f.geometry.type === 'Polygon') f.geometry.coordinates = fixWinding(f.geometry.coordinates);
  if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates = f.geometry.coordinates.filter(p => p[0].length >= 4).map(fixWinding);
});
const before = provinces.reduce((n, f) => n + f.geometry.coordinates.length, 0);
const after = fc.features.reduce((n, f) => n + f.geometry.coordinates.length, 0);
console.log(`provinces: ${provinces.length}, polygons ${before} -> ${after} (small islands kept)`);

write('vietnam-provinces.geo.json', fc);
write('vietnam-archipelagos.geo.json', { type: 'FeatureCollection', features: islands });
console.log(`archipelago polygons: ${islands.length} (Hoang Sa ${islands.filter(f => f.properties.archipelago === 'Hoàng Sa').length}, Truong Sa ${islands.filter(f => f.properties.archipelago === 'Trường Sa').length})`);

// named features from Wikidata (CC0)
const ARCH_Q = { Q274388: 'Hoàng Sa', Q215664: 'Trường Sa' };
const KINDS = [['island group', 'group'], ['atoll', 'atoll'], ['island', 'island'], ['reef', 'reef'], ['shoal', 'shoal'], ['bank', 'bank']];
// Luconia Shoals (off Sarawak) and Louisa Reef (no Vietnamese-language name in Wikidata) are left out;
// Q784397 is a battle, not a place.
const EXCLUDE = new Set(['Q890078', 'Q2405955', 'Q784397']);
const m = new Map();
for (const b of read('source-wikidata-islands.json').results.bindings) {
  const id = b.i.value.split('/').pop();
  if (!m.has(id)) m.set(id, { id, en: b.iLabel.value, vi: b.viLabel && b.viLabel.value, c: b.c.value, arch: ARCH_Q[b.arch.value.split('/').pop()], types: new Set() });
  if (b.tLabel) m.get(id).types.add(b.tLabel.value);
}
const feats = [];
for (const v of m.values()) {
  if (EXCLUDE.has(v.id)) continue;
  const ts = [...v.types].join(' ').toLowerCase() + ' ' + v.en.toLowerCase();
  const kind = (KINDS.find(([k]) => ts.includes(k)) || [])[1];
  if (!kind || !v.vi || v.vi === v.en || /^Q\d+$/.test(v.vi)) continue;
  const pt = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(v.c);
  feats.push({
    id: v.id, archipelago: v.arch, kind,
    name: v.vi.replace(/\s*\(đảo\)\s*$/i, ''), name_en: /^Q\d+$/.test(v.en) ? '' : v.en,
    lat: +(+pt[2]).toFixed(4), lng: +(+pt[1]).toFixed(4),
    source: `Wikidata ${v.id} (CC0)`,
  });
}
// a reef/atoll/group centred on the same spot as an island is the same place: keep the island
for (let i = feats.length - 1; i >= 0; i--) {
  const f = feats[i];
  if (['atoll', 'group', 'reef'].includes(f.kind) && feats.some(g => g !== f && g.kind === 'island' && Math.hypot(g.lat - f.lat, g.lng - f.lng) < 0.03)) feats.splice(i, 1);
}
feats.sort((a, b) => a.archipelago.localeCompare(b.archipelago) || b.lat - a.lat);
write('archipelago-features.json', feats);
console.log('named archipelago features:', feats.length);
for (const f of feats) console.log(' ', f.archipelago, f.kind.padEnd(6), f.name, '|', f.name_en, f.lat, f.lng);
for (const f of ['vietnam-provinces.geo.json', 'vietnam-archipelagos.geo.json', 'archipelago-features.json'])
  console.log(f, (fs.statSync(path.join(DIR, f)).size / 1024).toFixed(1) + ' KB');
