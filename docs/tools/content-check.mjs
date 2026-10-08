#!/usr/bin/env node
// Checks the game's content tables: conditions and proficiencies (docs/13-units-classes-power.md),
// classes and skills (docs/14-class-library.md) and items (docs/15-item-library.md).
//
//   node docs/tools/content-check.mjs                    check, print a summary, exit 1 on problems
//   node docs/tools/content-check.mjs --ladder           also print the benchmark ladder (13 §9.2) from the formulas
//   node docs/tools/content-check.mjs --json [--upto M4] print every row as JSON (for content:build)
//   node docs/tools/content-check.mjs extra.md ...       check extra files together with the three docs
//
// No dependencies. Extend it rather than working around it.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const docs = resolve(here, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const extra = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--upto');
const FILES = [
  ...['13-units-classes-power.md', '14-class-library.md', '15-item-library.md'].map((f) => resolve(docs, f)),
  ...extra.map((f) => resolve(f)),
];

export const PHASES = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];
const FAMILIES = ['Field', 'Wild', 'Earth', 'Wood', 'Fire', 'Stone', 'Thread', 'Table', 'Road', 'Mind', 'Hall'];
const ATTRIBUTES = ['Strength', 'Agility', 'Endurance', 'Intellect', 'Will', 'Affinity'];
const SLOTS = ['Knack', 'Active', 'Ultimate', 'Art', 'Mastery', 'Cataclysm', 'Office'];
// A Calamity's nature (13 §15.3); a Cataclysm row may name one in its For column.
const NATURES = ['Sellsword', 'Idol', 'Wildfire', 'Bastion', 'Oathsworn'];
const RESOLVE = ['Work', 'Fight', 'Aid'];
const HEALTH = ['2', '3', '4', '6', '8'];
const OFFICES = [
  'chancellor', 'marshal', 'treasurer', 'quartermaster', 'magister', 'envoy', 'spymaster', 'high-hearthkeeper',
  'governor', 'reeve', 'bailiff', 'storekeeper', 'paymaster', 'hearthkeeper', 'captain', 'commander',
  'lieutenant', 'sergeant', 'foreman', 'overseer',
];
// Bold words a rules column may use besides condition names.
const KEYWORDS = [
  'played only', 'crushing', 'uncapped', 'reveal', 'read', 'mark', 'survey', 'sweep', 'guard', 'resolve',
  'flame', 'siege', 'true', 'might', 'hunger', 'ward', 'day trade',
];
// Slot budgets (13 §11.10): cooldown range in seconds and cost ranges.
const BUDGET = {
  Active: { cd: [15, 90], stamina: [10, 30], mana: [10, 40] },
  Art: { cd: [20, 120], stamina: [10, 40], mana: [10, 60] },
};
const BANNED = [
  [/!/, 'exclamation mark'], [/\bplease\b/i, '"please"'], [/\bsimply\b/i, '"simply"'], [/\bjust\b/i, '"just"'],
  [/click here/i, '"click here"'], [/\bwelcome\b/i, '"welcome"'], [/\boops\b/i, '"oops"'], [/\bsorry\b/i, '"sorry"'],
  [/\.\.\.|…/, 'ellipsis'], [/coming soon/i, '"coming soon"'], [/\p{Extended_Pictographic}/u, 'emoji'],
];
const ID = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;
const CONTENT_PREFIX = /^(class|skill|item|cond|prof|trial)\./;

const clean = (cell) => {
  const t = cell.trim();
  return t === '—' ? '' : t;
};
const words = (s) => s.split(/\s+/).filter(Boolean);
const unbacktick = (s) => s.replace(/`/g, '');

// ---------- parsing ----------
function parseFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const tables = [];
  const errors = [];
  let h2 = '';
  let h3 = '';
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (h) {
      if (h[1].length <= 2) { h2 = h[2]; h3 = ''; } else h3 = h[2];
    }
    if (!/^\|\s*ID\s*\|/.test(lines[i])) continue;
    const head = lines[i].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
    const table = { file: basename(file), line: i + 1, head, rows: [], section: h3 || h2 };
    i += 1;
    for (i += 1; i < lines.length && lines[i].startsWith('|'); i++) {
      const cells = lines[i].split('|').slice(1, -1).map(clean);
      if (cells.length !== head.length) {
        errors.push(`${table.file}:${i + 1}: ${cells.length} cells, expected ${head.length}`);
        continue;
      }
      const row = Object.fromEntries(head.map((name, c) => [name, cells[c]]));
      row.id = unbacktick(row.id);
      row._file = table.file;
      row._line = i + 1;
      table.rows.push(row);
    }
    i -= 1;
    tables.push(table);
  }
  return { text, tables, errors };
}

const has = (t, ...cols) => cols.every((c) => t.head.includes(c));
function kindOf(t) {
  if (has(t, 'slot', 'name', 'cost', 'ready', 'reach', 'tooltip', 'rules')) return 'skill';
  if (has(t, 'for', 'name', 'cost', 'ready', 'reach', 'tooltip', 'rules')) return 'cataclysm';
  if (has(t, 'class', 'family', 'proficiency', 'attributes', 'health')) return 'class';
  if (has(t, 'class', 'base')) return 'advanced';
  if (has(t, 'name', 'effect', 'lasts', 'stacks', 'tooltip')) return 'condition';
  if (has(t, 'name', 'attribute', 'tooltip')) return 'proficiency';
  if (has(t, 'for', 'trial')) return 'trial';
  if (has(t, 'metal', 'tier')) return 'metal';
  if (t.rows.some((r) => r.id.startsWith('item.'))) return t.head.includes('ingots') ? 'family' : 'item';
  return 'other';
}

// ---------- checks ----------
function main() {
  const errors = [];
  const warnings = [];
  const all = [];
  const texts = [];
  for (const f of FILES) {
    if (!existsSync(f)) {
      warnings.push(`${basename(f)} not found: skipped`);
      continue;
    }
    const { text, tables, errors: e } = parseFile(f);
    errors.push(...e);
    texts.push({ file: basename(f), text });
    for (const t of tables) {
      t.kind = kindOf(t);
      for (const r of t.rows) all.push({ ...r, _kind: t.kind, _section: t.section });
    }
  }
  const bad = (r, msg) => errors.push(`${r._file}:${r._line}  ${r.id}: ${msg}`);

  const byKind = (k) => all.filter((r) => r._kind === k);
  const conditions = byKind('condition');
  const profs = byKind('proficiency');
  const classes = byKind('class');
  const advanced = byKind('advanced');
  const skills = byKind('skill');
  const cataclysms = byKind('cataclysm');
  const metals = byKind('metal').sort((a, b) => Number(a.tier) - Number(b.tier));
  const families = byKind('family');
  const items = byKind('item');

  // Generated items: every family row × every metal tier it allows.
  const generated = [];
  for (const fam of families) {
    const [lo, hi] = (fam.tiers || '1–7').split(/[–-]/).map(Number);
    for (const m of metals) {
      const tier = Number(m.tier);
      if (tier < lo || tier > (hi || lo)) continue;
      generated.push({
        id: `${fam.id}.t${tier}`,
        name: `${m.metal} ${fam.name.toLowerCase()}`,
        since: laterPhase(fam.since, m.since),
        _file: fam._file, _line: fam._line, _kind: 'generated', family: fam.id, tier,
      });
    }
  }

  // IDs: shape and uniqueness.
  const seen = new Map();
  for (const r of [...all, ...generated]) {
    if (r._kind === 'other') continue;
    if (!ID.test(r.id)) bad(r, 'ID must look like area.name');
    if (seen.has(r.id)) bad(r, `duplicate ID (first at ${seen.get(r.id)})`);
    seen.set(r.id, `${r._file}:${r._line}`);
    if (r.since !== undefined && !PHASES.includes(r.since)) bad(r, `"Since" must be one of ${PHASES.join(' ')}`);
  }
  const known = new Set(seen.keys());

  // Words: names and tooltips.
  const condNames = new Set(conditions.map((c) => c.name.toLowerCase()));
  for (const r of [...all, ...generated]) {
    if (['other', 'trial'].includes(r._kind)) continue;
    const name = r.name ?? r.class ?? r.metal;
    if (name) {
      if (name.length > 24) bad(r, `name longer than 24 characters: "${name}"`);
      if (words(name).length > 3) bad(r, `name longer than 3 words: "${name}"`);
      if (!/^[\p{Lu}\p{N}]/u.test(name)) bad(r, `name must start with a capital: "${name}"`);
      if (/[.:]$/.test(name)) bad(r, `name ends with punctuation: "${name}"`);
      if (r._kind === 'skill' || r._kind === 'cataclysm') {
        words(name).slice(1).forEach((w) => {
          const bare = w.replace(/['’]s$/u, '').replace(/[^\p{L}]/gu, '');
          if (/^\p{Lu}/u.test(bare) && !/^\p{Lu}+$/u.test(bare) && !condNames.has(bare.toLowerCase()) && !PROPER.has(bare)) {
            bad(r, `skill name is not sentence case ("${w}"): "${name}"`);
          }
        });
      }
      for (const [re, what] of BANNED) if (re.test(name)) bad(r, `name contains ${what}`);
    }
    if (r.tooltip) {
      if (r.tooltip.length > 100) bad(r, `tooltip longer than 100 characters (${r.tooltip.length})`);
      if (/\.$/.test(r.tooltip)) bad(r, 'tooltip ends with a full stop');
      if (!/^[\p{Lu}\p{N}]/u.test(r.tooltip)) bad(r, 'tooltip must start with a capital');
      if (name && r.tooltip.toLowerCase() === name.toLowerCase()) bad(r, 'tooltip repeats the name');
      for (const [re, what] of BANNED) if (re.test(r.tooltip)) bad(r, `tooltip contains ${what}`);
    }
  }

  // Bold words in rules and effects must be conditions or keywords.
  const keywords = new Set([...condNames, ...KEYWORDS]);
  for (const r of all) {
    for (const col of ['rules', 'effect', 'power', 'hunger', 'traits']) {
      if (!r[col]) continue;
      for (const m of r[col].matchAll(/\*\*([^*]+)\*\*/g)) {
        const term = m[1].trim().toLowerCase().replace(/^(a|an|the)\s+/, '');
        if (!keywords.has(term) && !keywords.has(term.replace(/s$/, ''))) {
          bad(r, `"**${m[1]}**" in ${col} is neither a condition (13 §6) nor a keyword`);
        }
      }
    }
  }

  // Proficiencies.
  const profByName = new Map(profs.map((p) => [p.name.toLowerCase(), p]));
  for (const p of profs) {
    if (!ATTRIBUTES.includes(p.attribute)) bad(p, `unknown attribute "${p.attribute}"`);
  }
  const profOf = (s) => profByName.get(s.replace(/\s*\(.*\)$/, '').trim().toLowerCase());

  // Classes.
  const classById = new Map();
  for (const c of classes) {
    classById.set(c.id, c);
    if (!c.id.startsWith('class.')) bad(c, 'class IDs start with class.');
    if (!FAMILIES.includes(c.family) && c.family !== 'Military') bad(c, `unknown family "${c.family}"`);
    if (!profOf(c.proficiency)) bad(c, `unknown proficiency "${c.proficiency}"`);
    const attrs = c.attributes.split(/,\s*/);
    if (attrs.length !== 2 || attrs.some((a) => !ATTRIBUTES.includes(a))) bad(c, `attributes must be two of ${ATTRIBUTES.join(', ')}`);
    if (!HEALTH.includes(c.health)) bad(c, `health per level must be one of ${HEALTH.join(', ')}`);
    if (!RESOLVE.includes(c.resolve)) bad(c, `resolve must be one of ${RESOLVE.join(', ')}`);
    if (!c.deed) bad(c, 'needs a deed');
    if (c['also trains']) {
      for (const p of c['also trains'].split(/,\s*/)) if (!profOf(p)) bad(c, `unknown proficiency "${p}" in Also trains`);
    }
  }
  for (const a of advanced) {
    classById.set(a.id, a);
    const base = classById.get(unbacktick(a.base)) ?? classes.find((c) => c.class === a.base);
    if (!base || base.family !== 'Military') bad(a, `base "${a.base}" is not a military base class`);
    a._base = base;
  }

  // Skills.
  const slotsOf = new Map();
  for (const s of skills) {
    const parts = s.id.split('.');
    if (parts[0] !== 'skill' || parts.length !== 3) { bad(s, 'skill IDs look like skill.<class>.<slot>'); continue; }
    const owner = parts[1];
    if (!SLOTS.includes(s.slot)) bad(s, `unknown slot "${s.slot}"`);
    if (owner === 'office') {
      if (s.slot !== 'Office') bad(s, 'office skills have the slot Office');
      if (!OFFICES.includes(parts[2])) bad(s, `unknown office "${parts[2]}"`);
    } else if (owner !== 'king' && !classById.has(`class.${owner}`)) bad(s, `no class "class.${owner}"`);
    if (parts[2] !== s.slot.toLowerCase() && owner !== 'office') bad(s, `the last part of the ID should be "${s.slot.toLowerCase()}"`);
    const key = owner;
    if (!slotsOf.has(key)) slotsOf.set(key, []);
    slotsOf.get(key).push(s.slot);
    checkTiming(s, bad);
  }
  for (const c of cataclysms) {
    if (!c.id.startsWith('skill.cataclysm.')) bad(c, 'cataclysm IDs look like skill.cataclysm.<name>');
    if (c.ready !== '600 s') bad(c, 'a Cataclysm is ready every 600 s (13 §11.10)');
    if (!/flame/i.test(c.cost)) bad(c, 'a Cataclysm costs Flame');
    for (const who of c.for.split(/,\s*/)) {
      const ok = NATURES.includes(who) || FAMILIES.includes(who.replace(/ family$/, '')) || classById.has(unbacktick(who)) || classes.some((k) => k.class === who) || advanced.some((k) => k.class === who);
      if (!ok) bad(c, `"${who}" in For is neither a family nor a class`);
    }
  }
  // Each class has exactly its slots.
  const need = (c) => {
    if (c._kind === 'advanced' || c.base) return ['Art', 'Mastery'];
    if (c.family === 'Military') return ['Knack', 'Active', 'Ultimate'];
    return ['Knack', 'Active', 'Ultimate', 'Mastery'];
  };
  if (skills.length) {
    for (const c of [...classes, ...advanced]) {
      const got = (slotsOf.get(c.id.slice('class.'.length)) ?? []).sort().join(', ');
      const want = need(c).slice().sort().join(', ');
      if (got !== want) {
        const msg = `${c._file}:${c._line}  ${c.id}: has skills [${got}], needs [${want}]`;
        (got ? errors : warnings).push(msg);
      }
    }
    const king = (slotsOf.get('king') ?? []).sort().join(', ');
    if (king && king !== 'Active, Knack, Ultimate') errors.push(`the king has skills [${king}], needs [Active, Knack, Ultimate]`);
  }

  // A skill can't ship before its class, and a made item can't ship before what it is made from.
  const sinceOf = new Map([...all, ...generated].map((r) => [r.id, r.since]));
  const before = (a, b) => PHASES.indexOf(a) < PHASES.indexOf(b);
  for (const s of skills) {
    const owner = classById.get(`class.${s.id.split('.')[1]}`);
    if (owner && s.since && owner.since && before(s.since, owner.since)) bad(s, `ships in ${s.since}, before its class (${owner.since})`);
  }
  for (const r of [...items, ...families, ...metals]) {
    for (const col of ['made from', 'ingots', 'source']) {
      for (const m of (r[col] ?? '').matchAll(/`(item\.[a-z0-9.-]+)`/g)) {
        const need = sinceOf.get(m[1]);
        if (need && r.since && before(r.since, need)) bad(r, `ships in ${r.since}, before \`${m[1]}\` (${need})`);
      }
    }
  }

  // Item recipes and references across every doc.
  const familyIds = new Set(families.map((f) => f.id));
  for (const { file, text } of texts) {
    text.split(/\r?\n/).forEach((line, n) => {
      for (const m of line.matchAll(/`([^`]+)`/g)) {
        const token = m[1];
        if (!CONTENT_PREFIX.test(token) || !ID.test(token.replace(/\.t\*$/, '.t1'))) continue;
        if (known.has(token)) continue;
        if (/\.t\*$/.test(token) && familyIds.has(token.slice(0, -3))) continue;
        errors.push(`${file}:${n + 1}: \`${token}\` is mentioned but no row has that ID`);
      }
    });
  }

  return { errors, warnings, all, generated, classes, advanced, skills, cataclysms, items, families, metals, conditions, profs };
}

const PROPER = new Set(['Warden', 'Wardens', 'Hearth', 'Crown', 'King', 'Below', 'Deep', 'Frost', 'Wellspring', 'Mark', 'Marks', 'Crowns']);

function laterPhase(a, b) {
  return PHASES.indexOf(a) >= PHASES.indexOf(b) ? a : b;
}

function checkTiming(s, bad) {
  const { slot, ready, cost, reach } = s;
  if (slot === 'Knack' || slot === 'Mastery') {
    if (ready !== 'Passive') bad(s, `a ${slot} is ready "Passive"`);
    if (cost) bad(s, `a ${slot} has no cost`);
    return;
  }
  if (!reach || !/^(Self|Target|Point|Direction|Aura|Blocks|Jurisdiction)\b/.test(reach)) {
    bad(s, `reach must start with Self, Target, Point, Direction, Aura, Blocks or Jurisdiction (13 §11.4): "${reach}"`);
  }
  if (slot === 'Ultimate') {
    if (ready !== 'Resolve') bad(s, 'an Ultimate is ready "Resolve"');
    if (!/^100 Resolve/.test(cost)) bad(s, 'an Ultimate costs "100 Resolve" (and may add more after " + ")');
    return;
  }
  if (slot === 'Office') {
    if (!/^(\d+ (s|min|h)|1 day)$/.test(ready)) bad(s, `office skills are ready in "N s", "N min", "N h" or "1 day": "${ready}"`);
    return;
  }
  const b = BUDGET[slot];
  if (!b) return;
  const cd = /^(\d+) s$/.exec(ready);
  if (!cd) bad(s, `ready must be a cooldown like "30 s": "${ready}"`);
  else if (Number(cd[1]) < b.cd[0] || Number(cd[1]) > b.cd[1]) bad(s, `a ${slot}'s cooldown is ${b.cd[0]}–${b.cd[1]} s (13 §11.10), not ${cd[1]}`);
  for (const part of (cost || '').split(/\s*\+\s*/)) {
    const m = /^(\d+) (stamina|mana|health)$/.exec(part);
    if (!part) bad(s, `a ${slot} needs a cost`);
    else if (m && b[m[2]] && (Number(m[1]) < b[m[2]][0] || Number(m[1]) > b[m[2]][1])) {
      bad(s, `a ${slot} costs ${b[m[2]][0]}–${b[m[2]][1]} ${m[2]} (13 §11.10), not ${m[1]}`);
    } else if (!m && !/^\d+ × `?item\.[a-z0-9.-]+`?$/.test(part)) bad(s, `cost must be "N stamina", "N mana", "N health" or "N × \`item.id\`": "${part}"`);
  }
}

// ---------- the benchmark ladder (13 §9.2) ----------
const GRADES = ['Common', 'Proven', 'Tempered', 'Elite', 'Champion', 'Paragon', 'Calamity'];
export function ladder() {
  const quality = [0, 0, 5, 10, 10, 15, 20];
  const rows = GRADES.map((grade, k) => {
    const g = k + 1;
    const level = 10 * g;
    const str = 12 + g;
    const end = 12 + g;
    const might = 1 + 0.5 * (g - 1);
    const health = (60 + 4 * end + 6 * (level - 1)) * might;
    const armour = 10 + 20 * g;
    const weapon = 10 + 10 * g;
    const prof = Math.min(100, 10 + 15 * g);
    const increased = 3 * (str - 10) + 0.4 * prof + level + 50 * (g - 1) + quality[k];
    const hit = weapon * (1 + increased / 100);
    const dps = hit * 1.6;
    const ehp = health * (1 + armour / 100);
    return { grade, level, health, armour, hit, dps, ehp, product: ehp * dps };
  });
  const base = rows[1].product;
  for (const r of rows) r.worth = r.product / base;
  return rows;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
function printLadder(rows) {
  console.log('\nGrade, level      Health  Armour   Hit  Damage/s  Effective Health  Worth');
  for (const r of rows) {
    console.log(`${`${r.grade} ${r.level}`.padEnd(16)}${fmt(r.health).padStart(8)}${fmt(r.armour).padStart(8)}${fmt(r.hit).padStart(6)}${fmt(r.dps).padStart(10)}${fmt(r.ehp).padStart(18)}${r.worth.toFixed(2).padStart(7)}`);
  }
}
function compareLadder(rows, errors) {
  const file = resolve(docs, '13-units-classes-power.md');
  if (!existsSync(file)) return;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^\|\s*Grade, level\s*\|/.test(l));
  if (start < 0) { errors.push('13-units-classes-power.md: the benchmark table (§9.2) is missing'); return; }
  rows.forEach((r, k) => {
    const cells = (lines[start + 2 + k] ?? '').split('|').slice(1, -1).map((c) => c.trim());
    const nums = cells.slice(1).map((c) => Number(c.replace(/,/g, '')));
    const want = [r.health, r.armour, r.hit, r.dps, r.ehp, r.worth];
    want.forEach((w, j) => {
      const tolerance = j === 5 ? 0.06 : 1;
      if (!(Math.abs(nums[j] - w) <= tolerance)) {
        errors.push(`13-units-classes-power.md:${start + 3 + k}: ${r.grade}: the table says ${cells[j + 1]}, the formulas give ${j === 5 ? w.toFixed(2) : fmt(w)}`);
      }
    });
  });
}

// ---------- output ----------
const result = main();
const { errors, warnings } = result;
const rows = ladder();
compareLadder(rows, errors);

const upto = option('--upto');
if (upto && !PHASES.includes(upto)) {
  console.error(`--upto must be one of ${PHASES.join(' ')}`);
  process.exit(2);
}
const inPhase = (r) => !upto || !r.since || PHASES.indexOf(r.since) <= PHASES.indexOf(upto);

if (flag('--json')) {
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const out = {};
  for (const r of [...result.all, ...result.generated].filter((x) => x._kind !== 'other' && inPhase(x))) {
    const { _file, _line, _section, ...rest } = r;
    out[r.id] = { ...rest, kind: r._kind };
    delete out[r.id]._kind;
    delete out[r.id]._base;
  }
  console.log(JSON.stringify(out, null, 2));
} else {
  const count = (list) => list.filter(inPhase).length;
  console.log(
    `Content${upto ? ` up to ${upto}` : ''}: ${count(result.conditions)} conditions, ${count(result.profs)} proficiencies, ` +
      `${count(result.classes)} classes, ${count(result.advanced)} advanced classes, ${count(result.skills)} skills, ` +
      `${count(result.cataclysms)} cataclysms, ${count(result.items)} items, ${count(result.families)} item families ` +
      `(${count(result.generated)} generated items)`,
  );
  if (flag('--ladder')) printLadder(rows);
  if (warnings.length) console.log(`\n${warnings.length} warning(s):\n${warnings.join('\n')}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log('Content is consistent.');
}
