#!/usr/bin/env node
// DRIFTLINE content validator — plain node, no deps.
// Checks schemas (see .ralph/ROUTES.md) and cross-references between
// missions, characters, regions/anchors and lore files.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const listFiles = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)) : []);
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(p, `invalid JSON: ${e.message}`); return null; } };

// ---------- regions ----------
const regionDir = join(root, 'src/world/regions');
const regions = new Map(); // slug -> { meta, anchors }
for (const slug of existsSync(regionDir) ? readdirSync(regionDir) : []) {
  const folder = join(regionDir, slug);
  const metaPath = join(folder, 'meta.json');
  const anchorsPath = join(folder, 'anchors.json');
  if (!existsSync(metaPath)) {
    // mid-flight demo-region folder (parallel workers commit incrementally) —
    // don't fail the build; it becomes a full region when meta.json lands.
    warn(`region ${slug}`, 'no meta.json yet — in-progress folder, skipping');
    continue;
  }
  const meta = readJson(metaPath);
  const anchors = readJson(anchorsPath);
  if (!meta) { err(`region ${slug}`, 'missing meta.json'); continue; }
  for (const f of ['slug', 'name', 'blurb', 'center', 'radius']) if (!(f in meta)) err(`region ${slug}`, `meta.json missing "${f}"`);
  if (meta.slug !== slug) err(`region ${slug}`, `meta.slug "${meta.slug}" != folder name`);
  if (!Array.isArray(meta.center) || meta.center.length !== 2) err(`region ${slug}`, 'center must be [x, z]');
  if (!anchors || typeof anchors !== 'object') { err(`region ${slug}`, 'missing/invalid anchors.json'); continue; }
  for (const [aid, a] of Object.entries(anchors)) {
    if (!Array.isArray(a.pos) || a.pos.length !== 2) err(`region ${slug}:${aid}`, 'anchor needs "pos": [x, z]');
    if (!a.label) warn(`region ${slug}:${aid}`, 'anchor missing label');
  }
  regions.set(slug, { meta, anchors });
}
const hasAnchor = (ref) => {
  const [slug, aid] = String(ref ?? '').split(':');
  return slug && aid && regions.has(slug) && aid in regions.get(slug).anchors;
};

// ---------- characters ----------
const charDir = join(root, 'src/content/characters');
const characters = new Map();
for (const f of listFiles(charDir, '.json')) {
  const c = readJson(join(charDir, f));
  if (!c) continue;
  const w = `character ${f}`;
  for (const k of ['id', 'name', 'role', 'faction', 'home', 'bio', 'appearance', 'voice', 'lines']) if (!(k in c)) err(w, `missing "${k}"`);
  if (c.id !== f.replace('.json', '')) err(w, `id "${c.id}" != filename`);
  if (c.home && !regions.has(c.home)) err(w, `home region "${c.home}" not found`);
  const total = Object.values(c.lines ?? {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  if (total < 8) err(w, `lines: ${total} found, needs >= 8`);
  if (!Array.isArray(c.lines?.greetings) || c.lines.greetings.length < 2) err(w, 'needs >= 2 greetings');
  characters.set(c.id, c);
}

// ---------- lore ----------
const loreDir = join(root, 'src/content/lore');
const loreSlugs = new Set();
const parseFrontmatter = (raw) => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
};
for (const f of listFiles(loreDir, '.md')) {
  const parsed = parseFrontmatter(readFileSync(join(loreDir, f), 'utf8'));
  const w = `lore ${f}`;
  if (!parsed) { err(w, 'missing frontmatter block'); continue; }
  for (const k of ['title', 'slug', 'cluster', 'category', 'summary']) if (!parsed.fm[k]) err(w, `frontmatter missing "${k}"`);
  if (parsed.fm.cluster !== 'lore') err(w, 'cluster must be "lore"');
  const slug = f.replace('.md', '');
  if (parsed.fm.slug && parsed.fm.slug !== slug) err(w, `slug "${parsed.fm.slug}" != filename`);
  const words = parsed.body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 250) err(w, `body ${words} words, needs >= 250`);
  loreSlugs.add(slug);
}

// ---------- missions ----------
const objTypes = new Set(['pickup', 'dropoff', 'goto', 'deliver', 'collect', 'race', 'escort', 'chase', 'scout', 'storm']);
const missionTypes = new Set(['deliver', 'timed', 'fragile', 'escort', 'chase', 'race', 'collect', 'scout', 'storm']);
const missionDir = join(root, 'src/content/missions');
let missions = 0;
for (const f of listFiles(missionDir, '.json')) {
  const m = readJson(join(missionDir, f));
  if (!m) continue;
  const w = `mission ${f}`;
  missions++;
  for (const k of ['id', 'title', 'chapter', 'type', 'giver', 'region', 'summary', 'objectives', 'rewards', 'dialogue']) if (!(k in m)) err(w, `missing "${k}"`);
  if (m.id !== f.replace('.json', '')) err(w, `id "${m.id}" != filename`);
  const ch = m.chapter;
  if (!(ch === 'side' || (Number.isInteger(ch) && ch >= 1 && ch <= 5))) err(w, `chapter must be 1-5 or "side"`);
  if (!missionTypes.has(m.type)) err(w, `unknown type "${m.type}"`);
  if (m.giver && !characters.has(m.giver)) err(w, `giver "${m.giver}" not found`);
  if (m.region && !regions.has(m.region)) err(w, `region "${m.region}" not found`);
  if (!Array.isArray(m.objectives) || m.objectives.length < 2) err(w, 'needs >= 2 objectives');
  else m.objectives.forEach((o, i) => {
    if (!objTypes.has(o.type)) err(w, `objective ${i}: unknown type "${o.type}"`);
    if (o.type === 'race') {
      if (!Array.isArray(o.targets) || o.targets.length < 3) err(w, `objective ${i}: race needs >= 3 targets`);
      else o.targets.forEach((t, j) => { if (!hasAnchor(t)) err(w, `objective ${i} target ${j}: "${t}" not found`); });
    } else if (o.type === 'escort' || o.type === 'chase') {
      // NPC spawns at `target` (optional; defaults to first route point) then
      // runs the `targets` route (escort: one-way; chase: ping-pong)
      if (!Array.isArray(o.targets) || o.targets.length < 2) err(w, `objective ${i}: ${o.type} needs >= 2 route anchors in "targets"`);
      else o.targets.forEach((t, j) => { if (!hasAnchor(t)) err(w, `objective ${i} route[${j}]: "${t}" not found`); });
      if (o.target && !hasAnchor(o.target)) err(w, `objective ${i}: spawn target "${o.target}" not found`);
    } else if (!o.target) err(w, `objective ${i}: missing target`);
    else if (!hasAnchor(o.target)) err(w, `objective ${i}: target "${o.target}" not found`);
    if (o.type === 'collect' && !(o.count >= 2)) err(w, `objective ${i}: collect needs count >= 2`);
  });
  if (!(m.rewards?.credits > 0)) err(w, 'rewards.credits must be > 0');
  for (const flag of m.rewards?.flags ?? []) {
    if (flag.startsWith('lore:') && !loreSlugs.has(flag.slice(5))) err(w, `reward flag "${flag}" has no matching lore file`);
  }
  for (const phase of ['offer', 'accept', 'complete']) {
    if (!Array.isArray(m.dialogue?.[phase]) || m.dialogue[phase].length === 0) err(w, `dialogue.${phase} must be a non-empty array`);
    else m.dialogue[phase].forEach((l, i) => {
      if (!l.who || !characters.has(l.who)) err(w, `dialogue.${phase}[${i}]: unknown speaker "${l.who}"`);
      if (!l.text) err(w, `dialogue.${phase}[${i}]: empty text`);
    });
  }
  if (m.timeLimit !== undefined && !(m.timeLimit > 10)) err(w, 'timeLimit must be > 10s');
  if (m.type === 'fragile' && !m.cargo) err(w, 'fragile mission needs "cargo"');
}

// ---------- signal caches ----------
const cachesDoc = readJson(join(root, 'src/content/caches.json'));
let caches = 0;
if (!cachesDoc) err('caches.json', 'missing/invalid');
else {
  const seenIds = new Set(); const seenLore = new Set();
  const list = cachesDoc.caches ?? [];
  if (!Array.isArray(list)) err('caches.json', '"caches" must be an array');
  for (const c of Array.isArray(list) ? list : []) {
    const w = `cache ${c.id ?? '?'}`;
    caches++;
    for (const k of ['id', 'lore', 'anchor']) if (!(k in c)) err(w, `missing "${k}"`);
    if (seenIds.has(c.id)) err(w, 'duplicate id'); seenIds.add(c.id);
    if (c.lore) {
      if (!loreSlugs.has(c.lore)) err(w, `lore "${c.lore}" not found`);
      if (seenLore.has(c.lore)) err(w, `lore "${c.lore}" claimed by another cache`);
      seenLore.add(c.lore);
    }
    if (c.anchor) {
      if (!hasAnchor(c.anchor)) err(w, `anchor "${c.anchor}" not found`);
      else {
        const centre = regions.get(String(c.anchor).split(':')[0])?.meta.center ?? [0, 0];
        if (Math.abs(centre[0]) > 1800 || Math.abs(centre[1]) > 1800) err(w, `anchor "${c.anchor}" is off-world (lab bench)`);
      }
    }
  }
}

// ---------- report ----------
for (const g of warnings) console.warn(`  warn  ${g}`);
if (errors.length) {
  console.error(`\n✗ validate:content — ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ validate:content — ${regions.size} regions, ${characters.size} characters, ${missions} missions, ${loreSlugs.size} lore entries, ${caches} caches, ${warnings.length} warning(s)`);
