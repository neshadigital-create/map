// Converts the ANSES CIQUAL XML tables into a compact JSON the app loads offline.
// Usage: node scripts/build-ciqual.mjs <dir with alim*.xml, compo*.xml, const*.xml> <out.json>
// Source: ANSES-CIQUAL French food composition table, Etalab Open Licence 2.0.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('usage: build-ciqual.mjs <xml dir> <out.json>');
  process.exit(1);
}

/** CIQUAL XML is usually windows-1252; honour the declared encoding. */
function readXml(file) {
  const buf = readFileSync(file);
  const head = buf.subarray(0, 200).toString('latin1');
  const enc = (head.match(/encoding="([^"]+)"/i)?.[1] ?? 'utf-8').toLowerCase();
  return new TextDecoder(enc === 'iso-8859-1' ? 'windows-1252' : enc).decode(buf);
}

function find(prefix) {
  const f = readdirSync(dir).find((n) => n.toLowerCase().startsWith(prefix) && n.toLowerCase().endsWith('.xml'));
  if (!f) throw new Error(`missing ${prefix}*.xml in ${dir}`);
  return join(dir, f);
}

function records(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  for (const m of xml.matchAll(re)) {
    const rec = {};
    for (const f of m[1].matchAll(/<([a-z_]+)>([\s\S]*?)<\/\1>/gi)) rec[f[1].toLowerCase()] = f[2].trim();
    out.push(rec);
  }
  return out;
}

const decode = (s) =>
  (s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** "1,5" -> 1.5, "< 0,5" -> 0.25, "traces" -> 0, "-" -> null */
export function value(s) {
  const t = decode(s).toLowerCase();
  if (!t || t === '-') return null;
  if (t.startsWith('trace')) return 0;
  const n = Number(t.replace('<', '').replace(',', '.').trim());
  if (!Number.isFinite(n)) return null;
  return t.startsWith('<') ? n / 2 : n;
}

const consts = records(readXml(find('const')), 'CONST');
const constName = new Map(consts.map((c) => [c.const_code, decode(c.const_nom_fr || c.const_nom_eng)]));
// Nutrient codes in CIQUAL 2020; names are checked so a changed table fails loudly.
const WANT = {
  kcal: ['328', /kcal/i],
  protein: ['25000', /prot/i],
  fat: ['40000', /lipides|fat/i],
  carbs: ['31000', /glucides|carbohydrate/i],
  fiber: ['34100', /fibres|fibre/i],
  sugar: ['32000', /sucres|sugars/i],
};
for (const [k, [code, re]] of Object.entries(WANT)) {
  const name = constName.get(code);
  if (!name || !re.test(name)) throw new Error(`nutrient ${k}: code ${code} is "${name}"`);
  console.log(`${k.padEnd(8)} ${code} ${name}`);
}

const alimFile = readdirSync(dir).find((n) => /^alim_\d/i.test(n) && n.toLowerCase().endsWith('.xml'));
if (!alimFile) throw new Error('missing alim_*.xml');
const alims = records(readXml(join(dir, alimFile)), 'ALIM');
const compo = new Map();
for (const c of records(readXml(find('compo')), 'COMPO')) {
  const key = c.alim_code;
  if (!compo.has(key)) compo.set(key, {});
  compo.get(key)[c.const_code] = value(c.teneur);
}

const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const foods = [];
for (const a of alims) {
  const n = compo.get(a.alim_code) ?? {};
  const kcal = n[WANT.kcal[0]];
  if (kcal === null || kcal === undefined) continue;
  foods.push([
    Number(a.alim_code),
    decode(a.alim_nom_fr),
    decode(a.alim_nom_eng),
    Math.round(kcal),
    r1(n[WANT.protein[0]] ?? 0),
    r1(n[WANT.fat[0]] ?? 0),
    r1(n[WANT.carbs[0]] ?? 0),
    r1(n[WANT.fiber[0]]),
    r1(n[WANT.sugar[0]]),
  ]);
}
foods.sort((a, b) => a[1].localeCompare(b[1], 'fr'));
writeFileSync(
  out,
  JSON.stringify({
    source: 'ANSES-CIQUAL 2020',
    license: 'Licence Ouverte / Etalab 2.0',
    fields: ['code', 'fr', 'en', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar'],
    foods,
  }),
);
console.log(`wrote ${foods.length} foods to ${out}`);
