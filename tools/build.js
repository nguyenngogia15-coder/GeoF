'use strict';
/*
  GEOF website build script.
  Reads everything in content/, compresses images into assets/, writes data.js.
  If anything is wrong it prints the problem (in Vietnamese) and leaves the
  currently published website untouched.

  Run:  node tools/build.js
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const ASSETS = path.join(ROOT, 'assets');
const DATA_JS = path.join(ROOT, 'data.js');
const INDEX_HTML = path.join(ROOT, 'index.html');

const MAX_SIDE = 1600;
const QUALITY = 82;
const IMG_EXT = /\.(jpe?g|png|webp|tiff?|bmp)$/i;
const STATUSES = ['doing', 'done', 'plan'];

/* ------------------------------------------------------------ helpers */
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
const stem = f => f.replace(/\.[^.]+$/, '');
const naturalSort = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

// Allow // and block comments in .json files, and tolerate trailing commas.
function stripComments(t) {
  let out = '', i = 0, inStr = false;
  while (i < t.length) {
    const c = t[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += t[i + 1] || ''; i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && t[i + 1] === '*') {
      out += '  '; i += 2;
      while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) { out += t[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}
function dropTrailingCommas(t) {
  let out = '', inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += t[++i] || ''; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === ',') {
      let j = i + 1;
      while (j < t.length && /\s/.test(t[j])) j++;
      if (t[j] === ']' || t[j] === '}') { out += ' '; continue; }
    }
    out += c;
  }
  return out;
}

/* ------------------------------------------------------------ build */
async function build(opts = {}) {
  const log = opts.quiet ? () => {} : console.log;
  const errors = [], warnings = [], jobs = [], used = new Set();
  const E = m => errors.push(m);
  const W = m => warnings.push(m);

  function readJson(file, required = true) {
    if (!fs.existsSync(file)) {
      if (required) E(`❌ Không tìm thấy file "${rel(file)}".\n   Cách sửa: tạo file này (copy từ file mẫu hoặc từ HUONG-DAN.md).`);
      return undefined;
    }
    const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
    if (!raw.trim()) { E(`❌ File "${rel(file)}" đang trống.\n   Cách sửa: điền nội dung vào file (xem file mẫu trong thư mục _mau).`); return undefined; }
    const clean = dropTrailingCommas(stripComments(raw));
    try {
      return JSON.parse(clean);
    } catch (e) {
      let line, col;
      const lm = /line (\d+) column (\d+)/.exec(e.message), pm = /position (\d+)/.exec(e.message);
      if (lm) { line = +lm[1]; col = +lm[2]; }
      else if (pm) { const before = clean.slice(0, +pm[1]); line = before.split('\n').length; col = +pm[1] - before.lastIndexOf('\n'); }
      const smart = raw.split('\n').findIndex(l => /[“”‘’]/.test(l));
      let msg = `❌ File "${rel(file)}" bị sai cú pháp`;
      if (line) msg += ` ở dòng ${line}, cột ${col}:\n   > ${(clean.split('\n')[line - 1] || '').trim().slice(0, 120)}`;
      msg += `\n   Cách sửa: kiểm tra dòng đó (và dòng ngay phía trên) xem có bị: thiếu dấu phẩy giữa hai mục,`
        + `\n   thiếu dấu ngoặc kép " ở đầu/cuối chữ, hoặc thiếu dấu ] } ở cuối.`;
      if (smart >= 0) msg += `\n   Lưu ý: dòng ${smart + 1} có dấu nháy cong “ ” (do copy từ Word). Hãy thay bằng dấu nháy thẳng ".`;
      E(msg);
      return undefined;
    }
  }

  const str = v => (v === undefined || v === null) ? '' : String(v).trim().replace(/</g, '&lt;');
  const strList = v => Array.isArray(v) ? v.map(str).filter(Boolean) : (v ? [str(v)] : []);
  function need(obj, field, file, ctx = '') {
    if (obj[field] === undefined || obj[field] === null || String(obj[field]).trim() === '') {
      E(`❌ File "${rel(file)}"${ctx}: thiếu trường bắt buộc "${field}".\n   Cách sửa: mở file và thêm dòng  "${field}": "..."  (nhớ có dấu phẩy ở dòng trước).`);
      return false;
    }
    return true;
  }
  function needList(v, file, what) {
    if (!Array.isArray(v)) { E(`❌ File "${rel(file)}": ${what} phải là một danh sách, bắt đầu bằng [ và kết thúc bằng ].\n   Cách sửa: xem file mẫu trong HUONG-DAN.md.`); return false; }
    return true;
  }
  const listDir = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [];
  const isHidden = n => n.startsWith('_') || n.startsWith('.') || n.startsWith('~$');

  /* Register an image to be compressed; returns the URL the website will use. */
  function image(srcAbs, outRel, keepAlpha) {
    if (!srcAbs) return '';
    let outPath = outRel;
    if (keepAlpha && /\.png$/i.test(srcAbs)) outPath = outRel.replace(/\.[^.]+$/, '.png');
    else outPath = outRel.replace(/\.[^.]+$/, '.jpg');
    const out = path.join(ASSETS, outPath);
    if (used.has(outPath)) {
      let n = 2; const base = outPath.replace(/\.[^.]+$/, ''), ext = path.extname(outPath);
      while (used.has(`${base}-${n}${ext}`)) n++;
      outPath = `${base}-${n}${ext}`;
    }
    used.add(outPath);
    const st = fs.statSync(srcAbs);
    const v = crypto.createHash('md5').update(`${st.size}:${Math.floor(st.mtimeMs)}`).digest('hex').slice(0, 8);
    jobs.push({ src: srcAbs, out: path.join(ASSETS, outPath), alpha: outPath.endsWith('.png') });
    return `assets/${outPath}?v=${v}`;
  }
  function findImages(dir) {
    return listDir(dir).filter(e => e.isFile() && !isHidden(e.name) && IMG_EXT.test(e.name)).map(e => e.name).sort(naturalSort);
  }
  function pickImage(dir, stems) {
    const files = findImages(dir);
    for (const s of stems) { const f = files.find(x => stem(x).toLowerCase() === s); if (f) return path.join(dir, f); }
    return null;
  }
  function warnUnsupported(dir) {
    for (const e of listDir(dir)) {
      if (e.isFile() && /\.(heic|heif|gif|svg|avif|jfif)$/i.test(e.name))
        W(`⚠️  Bỏ qua "${rel(path.join(dir, e.name))}": định dạng chưa hỗ trợ. Hãy đổi sang .jpg hoặc .png.`);
    }
  }

  /* ---- site.json */
  const site = readJson(path.join(CONTENT, 'site.json')) || {};
  const SITE = path.join(CONTENT, 'site.json');
  if (site.pillars !== undefined) needList(site.pillars, SITE, '"pillars"');
  if (site.join !== undefined) needList(site.join, SITE, '"join"');
  if (site.contact && typeof site.contact === 'object') need(site.contact, 'email', SITE, ' (mục contact)');
  else if (Object.keys(site).length) E(`❌ File "${rel(SITE)}": thiếu mục "contact" (email, lab, address).`);
  if (Object.keys(site).length) need(site, 'description', SITE);
  const pillars = (site.pillars || []).map((p, i) => {
    if (need(p, 'title', SITE, ` (pillars #${i + 1})`)) return { t: str(p.title), d: str(p.text) };
  }).filter(Boolean);
  const joinList = (site.join || []).map((j, i) => {
    if (need(j, 'title', SITE, ` (join #${i + 1})`)) return { t: str(j.title), d: str(j.text), btn: str(j.button) || 'Contact us', subject: str(j.emailSubject) || 'GEOF' };
  }).filter(Boolean);
  const contact = site.contact || {};

  const heroSrc = pickImage(CONTENT, ['hero']);
  const hero = { image: image(heroSrc, 'hero.jpg') };

  /* ---- leader */
  const LD = path.join(CONTENT, 'leader');
  const leader = readJson(path.join(LD, 'leader.json')) || {};
  const LF = path.join(LD, 'leader.json');
  if (Object.keys(leader).length) need(leader, 'name', LF);
  const mentor = {
    name: str(leader.name), role: str(leader.role), bio: str(leader.bio),
    photo: image(pickImage(LD, ['portrait', 'photo', 'leader']), 'leader/portrait.jpg'),
    links: { scholar: str(leader.scholar), orcid: str(leader.orcid), email: str(leader.email) },
  };
  warnUnsupported(LD);

  /* ---- directions */
  const DF = path.join(CONTENT, 'directions.json');
  const dirsRaw = readJson(DF) || [];
  const directions = [];
  if (needList(dirsRaw, DF, 'toàn bộ nội dung')) {
    dirsRaw.forEach((d, i) => {
      const ok = ['id', 'name', 'color'].map(f => need(d, f, DF, ` (mục #${i + 1})`)).every(Boolean);
      if (ok) {
        if (!/^#[0-9a-fA-F]{3,8}$/.test(str(d.color))) E(`❌ File "${rel(DF)}" (mục #${i + 1}): màu "${d.color}" không đúng.\n   Cách sửa: dùng mã màu dạng #ff6a3d.`);
        directions.push({ id: str(d.id), name: str(d.name), color: str(d.color) });
      }
    });
  }
  const dirIds = new Set(directions.map(d => d.id));

  /* ---- projects */
  const topics = [];
  const PR = path.join(CONTENT, 'projects');
  const projDirs = listDir(PR).filter(e => e.isDirectory() && !isHidden(e.name)).map(e => e.name).sort(naturalSort);
  projDirs.forEach((name, idx) => {
    const dir = path.join(PR, name), file = path.join(dir, 'info.json');
    const info = readJson(file);
    if (!info) return;
    const ok = ['title', 'direction', 'status', 'year'].map(f => need(info, f, file)).every(Boolean);
    if (!ok) return;
    if (!dirIds.has(str(info.direction))) { E(`❌ File "${rel(file)}": direction "${info.direction}" không có trong directions.json.\n   Cách sửa: dùng một trong: ${[...dirIds].join(', ')}.`); return; }
    if (!STATUSES.includes(str(info.status))) { E(`❌ File "${rel(file)}": status "${info.status}" không hợp lệ.\n   Cách sửa: chỉ dùng "doing" (đang làm), "done" (xong) hoặc "plan" (dự kiến).`); return; }
    if (!/^\d{4}$/.test(String(info.year))) { E(`❌ File "${rel(file)}": year "${info.year}" phải là số năm 4 chữ số, ví dụ 2026.`); return; }
    const files = findImages(dir);
    const coverName = files.find(f => stem(f).toLowerCase() === 'cover') || files[0];
    const ps = slug(name);
    const cover = coverName ? image(path.join(dir, coverName), `projects/${ps}/cover.jpg`) : '';
    const others = files.filter(f => f !== coverName).map(f => image(path.join(dir, f), `projects/${ps}/${slug(stem(f))}.jpg`));
    warnUnsupported(dir);
    topics.push({
      id: idx + 1, dir: str(info.direction), title: str(info.title), status: str(info.status), year: +info.year,
      image: cover, summary: str(info.summary), problem: str(info.problem), method: str(info.method), outcome: str(info.outcome),
      members: strList(info.members), tags: strList(info.tags), images: others,
    });
  });

  /* ---- gallery */
  const GD = path.join(CONTENT, 'gallery');
  const capsRaw = readJson(path.join(GD, 'captions.json'), false) || {};
  const capsLower = {};
  Object.keys(capsRaw).forEach(k => { if (k !== 'placeholders') capsLower[k.toLowerCase()] = str(capsRaw[k]); });
  const niceName = f => {
    const n = stem(f).replace(/^\d+[-_. ]+/, '').replace(/[-_]+/g, ' ').trim();
    if (!n || /^(img|dsc|dscn|pxl|image|photo|screenshot|wa)\b/i.test(n) || /^\d+$/.test(n)) return '';
    return n.charAt(0).toUpperCase() + n.slice(1);
  };
  let gallery = findImages(GD).map(f => ({
    img: image(path.join(GD, f), `gallery/${slug(stem(f))}.jpg`),
    cap: capsLower[f.toLowerCase()] ?? capsLower[stem(f).toLowerCase()] ?? niceName(f),
  }));
  warnUnsupported(GD);
  if (!gallery.length) gallery = (Array.isArray(capsRaw.placeholders) ? capsRaw.placeholders : []).map(c => ({ img: '', cap: str(c) }));

  /* ---- people */
  const PD = path.join(CONTENT, 'people');
  const people = [];
  listDir(PD).filter(e => e.isFile() && /\.json$/i.test(e.name) && !isHidden(e.name)).map(e => e.name).sort(naturalSort).forEach(f => {
    const file = path.join(PD, f), p = readJson(file);
    if (!p || !need(p, 'name', file)) return;
    if (p.direction && !dirIds.has(str(p.direction))) { E(`❌ File "${rel(file)}": direction "${p.direction}" không có trong directions.json.\n   Cách sửa: dùng một trong: ${[...dirIds].join(', ')} (hoặc để trống).`); return; }
    const s = stem(f);
    const photo = findImages(PD).find(x => stem(x).toLowerCase() === s.toLowerCase());
    people.push({ n: str(p.name), r: str(p.role) || 'Researcher', dir: str(p.direction), photo: photo ? image(path.join(PD, photo), `people/${slug(s)}.jpg`) : '' });
  });

  /* ---- publications / news / milestones */
  const pubsFile = path.join(CONTENT, 'publications.json');
  const pubsRaw = readJson(pubsFile) || [];
  const pubs = [];
  if (needList(pubsRaw, pubsFile, 'toàn bộ nội dung')) pubsRaw.forEach((p, i) => {
    const ctx = ` (bài #${i + 1})`;
    if (['year', 'title'].map(f => need(p, f, pubsFile, ctx)).every(Boolean)) {
      if (!/^\d{4}$/.test(String(p.year))) { E(`❌ File "${rel(pubsFile)}"${ctx}: year "${p.year}" phải là số năm, ví dụ 2026.`); return; }
      pubs.push({ y: +p.year, t: str(p.title), a: str(p.authors), v: str(p.venue), doi: str(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, '') });
    }
  });
  pubs.sort((a, b) => b.y - a.y);

  const newsFile = path.join(CONTENT, 'news.json');
  const newsRaw = readJson(newsFile) || [];
  const news = [];
  if (needList(newsRaw, newsFile, 'toàn bộ nội dung')) newsRaw.forEach((n, i) => {
    if (['date', 'title'].map(f => need(n, f, newsFile, ` (tin #${i + 1})`)).every(Boolean)) news.push({ d: str(n.date), t: str(n.title), tag: str(n.tag) });
  });

  const msFile = path.join(CONTENT, 'milestones.json');
  const msRaw = readJson(msFile) || [];
  const milestones = [];
  if (needList(msRaw, msFile, 'toàn bộ nội dung')) msRaw.forEach((m, i) => {
    if (['year', 'text'].map(f => need(m, f, msFile, ` (mốc #${i + 1})`)).every(Boolean)) milestones.push({ y: str(m.year), t: str(m.text) });
  });

  /* ---- partners */
  const PA = path.join(CONTENT, 'partners');
  const paFile = path.join(PA, 'partners.json');
  const paRaw = readJson(paFile, false) || [];
  const partners = [];
  if (needList(paRaw, paFile, 'toàn bộ nội dung')) paRaw.forEach((p, i) => {
    if (!need(p, 'name', paFile, ` (đối tác #${i + 1})`)) return;
    let logo = '';
    if (p.logo) {
      const f = path.join(PA, str(p.logo));
      if (fs.existsSync(f) && IMG_EXT.test(f)) logo = image(f, `partners/${slug(stem(str(p.logo)))}.png`, true);
      else W(`⚠️  Đối tác "${p.name}": không thấy file logo "${p.logo}" trong content/partners/. Web sẽ hiện khung mẫu.`);
    }
    partners.push({ n: str(p.name), logo });
  });
  warnUnsupported(PA);

  /* ---- stop here if anything is wrong: do not touch the live site */
  if (errors.length) return { ok: false, errors, warnings };

  let sharp;
  try { sharp = require('sharp'); } catch (e) {
    return { ok: false, errors: ['❌ Chưa cài thư viện nén ảnh (sharp).\n   Cách sửa: mở thư mục dự án, nhấp đúp publish.bat (nó tự cài), hoặc chạy lệnh:  npm install'], warnings };
  }

  /* ---- images */
  let written = 0;
  for (const j of jobs) {
    if (fs.existsSync(j.out) && fs.statSync(j.out).mtimeMs >= fs.statSync(j.src).mtimeMs) continue;
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    try {
      let img = sharp(j.src, { failOn: 'none' }).rotate().resize({ width: j.alpha ? 800 : MAX_SIDE, height: j.alpha ? 800 : MAX_SIDE, fit: 'inside', withoutEnlargement: true });
      img = j.alpha ? img.png({ compressionLevel: 9 }) : img.flatten({ background: '#ffffff' }).jpeg({ quality: QUALITY, mozjpeg: true });
      await img.toFile(j.out + '.tmp');
      fs.renameSync(j.out + '.tmp', j.out);
      written++;
    } catch (e) {
      try { fs.unlinkSync(j.out + '.tmp'); } catch (_) {}
      W(`⚠️  Không đọc được ảnh "${rel(j.src)}" (file hỏng?). Bỏ qua ảnh này.`);
    }
  }
  /* assets/ holds only what the website uses */
  (function clean(dir) {
    for (const e of listDir(dir)) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { clean(p); if (!fs.readdirSync(p).length) fs.rmdirSync(p); }
      else if (!used.has(rel(p).replace(/^assets\//, ''))) fs.unlinkSync(p);
    }
  })(ASSETS);

  /* ---- data.js */
  const SITE_DATA = {
    showPreviewRibbon: site.showPreviewRibbon !== false,
    group: { desc: str(site.description) },
    hero, pillars, mentor, directions, topics, gallery, people, milestones, news,
    scholar: str(site.scholar), pubs, partners, join: joinList,
    contact: { email: str(contact.email), lab: str(contact.lab), address: str(contact.address) },
  };
  const body = JSON.stringify(SITE_DATA, null, 2);
  const text = `/* AUTO-GENERATED by tools/build.js - do not edit by hand. Edit the files in content/ instead. */\nwindow.SITE_DATA = ${body};\n`;

  let oldData = null;
  try { if (fs.existsSync(DATA_JS)) { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(DATA_JS, 'utf8'), ctx); oldData = ctx.window.SITE_DATA; } } catch (_) {}
  const changed = !fs.existsSync(DATA_JS) || fs.readFileSync(DATA_JS, 'utf8') !== text;
  if (changed) { fs.writeFileSync(DATA_JS + '.tmp', text); fs.renameSync(DATA_JS + '.tmp', DATA_JS); }

  /* cache-busting version in index.html */
  const ver = crypto.createHash('md5').update(text).digest('hex').slice(0, 8);
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const html2 = html.replace(/data\.js\?v=[^"']*/, `data.js?v=${ver}`);
  if (html2 !== html) fs.writeFileSync(INDEX_HTML, html2);

  const count = d => d ? {
    images: (d.gallery || []).filter(g => g.img).length + (d.topics || []).filter(t => t.image).length + (d.people || []).filter(p => p.photo).length + (d.partners || []).filter(p => p.logo).length + (d.hero && d.hero.image ? 1 : 0) + (d.mentor && d.mentor.photo ? 1 : 0),
    projects: d.topics.length, people: d.people.length, publications: d.pubs.length, news: d.news.length,
  } : { images: 0, projects: 0, people: 0, publications: 0, news: 0 };
  const a = count(oldData), b = count(SITE_DATA), parts = [];
  const add = (k, one, many) => { const n = b[k] - a[k]; if (n) parts.push(`${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? one : many}`); };
  add('images', 'image', 'images'); add('projects', 'project', 'projects'); add('people', 'person', 'people');
  add('publications', 'publication', 'publications'); add('news', 'news item', 'news items');
  if (!parts.length && (changed || written)) parts.push('content edits');

  log(`✅ Build xong: ${b.projects} đề tài, ${b.people} thành viên, ${b.publications} bài báo, ${b.images} ảnh (đã nén ${written} ảnh mới).`);
  warnings.forEach(w => log(w));
  return { ok: true, errors, warnings, changed, summary: parts.join(', '), counts: b };
}

module.exports = { build };

if (require.main === module) {
  build().then(r => {
    if (!r.ok) {
      console.log('\n⛔ Build KHÔNG thành công. Website đang chạy vẫn giữ nguyên, chưa bị thay đổi.\n');
      r.errors.forEach(e => console.log(e + '\n'));
      process.exit(1);
    }
  }).catch(e => { console.log('⛔ Lỗi không mong đợi trong lúc build: ' + e.message); process.exit(1); });
}
