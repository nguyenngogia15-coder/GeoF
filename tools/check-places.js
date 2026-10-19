'use strict';
/*
  Check every GeoMap place: is it inside Vietnam (mainland or islands)?
  Run:  node tools/check-places.js
  (publish.bat runs the same check automatically through tools/build.js)
*/
const { build } = require('./build');
build({ quiet: true }).then(r => {
  if (!r.ok) {
    console.log('\n⛔ Có lỗi, chưa thể đăng. Hãy sửa rồi chạy lại:\n');
    r.errors.forEach(e => console.log(e + '\n'));
    process.exit(1);
  }
  const label = { province: 'trong tỉnh', archipelago: 'trên quần đảo', feature: 'sát đảo/đá', near: 'sát bờ biển' };
  console.log('\nKiểm tra tọa độ các điểm GeoMap:\n');
  r.placeReport.forEach(p => console.log(`  ✅ ${p.name}\n     (${p.lat}, ${p.lng}) ${label[p.where]} ${p.in}${p.km ? ` (~${p.km} km)` : ''}`));
  r.warnings.forEach(w => console.log('\n' + w));
  console.log(`\n✔ ${r.placeReport.length}/${r.placeReport.length} điểm nằm trong lãnh thổ Việt Nam.`);
});
