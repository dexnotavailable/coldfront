#!/usr/bin/env node
// Reads the interface catalogue (docs/11-interface-catalogue.md), checks every catalogue
// table against the writing rules in its Part A, and can print the entries as JSON.
//
//   node docs/tools/ui-catalogue.mjs                 check, print a summary, exit 1 on errors
//   node docs/tools/ui-catalogue.mjs --json          print every entry as JSON (for the UI's string table)
//   node docs/tools/ui-catalogue.mjs --json --upto 1.4   only entries that ship by phase 1.4
//
// No dependencies. Shipped by the owner; extend it rather than working around it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--upto');
const file = resolve(positional[0] ?? resolve(here, '..', '11-interface-catalogue.md'));

export const PHASES = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];
const TYPES = new Set([
  'button', 'icon', 'toggle', 'slider', 'select', 'segmented', 'stepper', 'field', 'tab',
  'row', 'slot', 'bar', 'stat', 'chip', 'title', 'table', 'canvas', 'keycap', 'wedge',
]);
// Words that may keep a capital inside a sentence-case string.
const PROPER = new Set([
  'Coldfront', 'Kaldmark', 'Discord', 'Steward', 'Frost', 'Thaw', 'Warden', 'Wardens', 'Seat', 'Seats',
  'Reeve', 'Quartermaster', 'Captain', 'Marshal', 'Magister', 'Treasurer', 'Envoy',
  'Crown', 'Crowns', 'Mark', 'Marks', 'Ledger', 'Chronicle', 'Kings', 'King', 'Below',
  'Upper', 'Deep', 'Undercrown', 'Maw', 'Pit', 'Rim', 'Nadir', 'Command', 'Possess',
  'Enter', 'Esc', 'Tab', 'Shift', 'Ctrl', 'Space',
  'WebGL2', 'Left', 'Delete', 'Home', 'End', 'Backspace', 'I', 'W', 'Y', 'N', 'X', 'Z',
  'Academy', 'Alt', 'PageUp', 'PageDown',
]);
const BANNED = [
  [/!/, 'exclamation mark'],
  [/\bplease\b/i, '"please"'],
  [/\bsimply\b/i, '"simply"'],
  [/\bjust\b/i, '"just"'],
  [/click here/i, '"click here"'],
  [/\bwelcome\b/i, '"welcome"'],
  [/\boops\b/i, '"oops"'],
  [/\bsorry\b/i, '"sorry"'],
  [/\.\.\.|…/, 'ellipsis'],
  [/coming soon/i, '"coming soon"'],
  [/\p{Extended_Pictographic}/u, 'emoji'],
];
// In-world voice (03-lore.md): longer lines and normal punctuation are allowed.
const VOICE = /^(steward|chron|moment)\./;
// Units, number formats, key names and compass points: fragments, so they needn't start with a capital.
const FRAGMENT = /^(unit|fmt|keyname|compass)\./;

// An em dash means "none". A hyphen is a real value (it is the default key for "Zoom out").
const clean = (cell) => {
  const t = cell.trim();
  return t === '—' ? '' : t;
};
const words = (s) => s.split(/\s+/).filter(Boolean);

function parse(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const errors = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) heading = h[1];
    if (!/^\|\s*ID\s*\|/.test(line)) continue;
    const head = line.split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
    i += 1; // separator row
    for (i += 1; i < lines.length && lines[i].startsWith('|'); i++) {
      const cells = lines[i].split('|').slice(1, -1).map(clean);
      if (cells.length !== head.length) {
        errors.push(`line ${i + 1}: ${cells.length} cells, expected ${head.length}`);
        continue;
      }
      const row = Object.fromEntries(head.map((name, c) => [name, cells[c]]));
      const id = row.id.replace(/`/g, '');
      const kind = 'type' in row ? 'control' : 'action' in row ? 'binding' : 'text';
      entries.push({
        id,
        kind,
        type: row.type ?? '',
        label: kind === 'binding' ? row.action : row.label ?? '',
        tooltip: row.tooltip ?? '',
        text: row.text ?? '',
        key: row.key ?? row.default ?? '',
        since: row.since ?? '',
        line: i + 1,
        section: heading,
      });
    }
    i -= 1;
  }
  return { entries, errors };
}

function check(entries) {
  const errors = [];
  const seen = new Map();
  const bad = (e, msg) => errors.push(`line ${e.line}  ${e.id}: ${msg}`);
  const sentenceCase = (e, s, what) => {
    const ws = words(s.replace(/\{[^}]*\}/g, 'X'));
    if (ws.length && /^[a-z]/.test(ws[0])) bad(e, `${what} must start with a capital: "${s}"`);
    ws.slice(1).forEach((w) => {
      const bare = w.replace(/[^\p{L}\p{N}]/gu, '');
      if (!/^\p{Lu}/u.test(bare)) return;
      if (PROPER.has(bare) || /^[\p{Lu}\p{N}]+$/u.test(bare)) return; // proper noun or abbreviation
      if (/[.:·]$/.test(ws[ws.indexOf(w) - 1] ?? '')) return; // starts a new clause
      bad(e, `${what} is not sentence case ("${w}"): "${s}"`);
    });
  };
  for (const e of entries) {
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/.test(e.id)) bad(e, 'ID must look like area.name');
    if (seen.has(e.id)) bad(e, `duplicate ID (first on line ${seen.get(e.id)})`);
    seen.set(e.id, e.line);
    if (!PHASES.includes(e.since)) bad(e, `"Since" must be one of ${PHASES.join(' ')}`);
    const voice = VOICE.test(e.id);
    for (const [what, s] of [['label', e.label], ['tooltip', e.tooltip], ['text', e.text]]) {
      if (!s) continue;
      for (const [re, name] of BANNED) {
        if (voice && (name === 'ellipsis')) continue;
        if (re.test(s)) bad(e, `${what} contains ${name}: "${s}"`);
      }
    }
    if (e.kind === 'control') {
      if (!TYPES.has(e.type)) bad(e, `unknown type "${e.type}"`);
      if (!e.label && !e.tooltip && ['button', 'icon', 'toggle', 'slider', 'select', 'segmented', 'stepper', 'field', 'tab'].includes(e.type)) {
        bad(e, 'needs a label or a tooltip');
      }
      if (e.type === 'icon' && !e.label) bad(e, 'icon controls need a label (shown in the tooltip and read by screen readers)');
    }
    if (e.label) {
      if (e.label.length > 24) bad(e, `label longer than 24 characters: "${e.label}"`);
      if (words(e.label).length > 3) bad(e, `label longer than 3 words: "${e.label}"`);
      if (/[.:]$/.test(e.label)) bad(e, `label ends with punctuation: "${e.label}"`);
      sentenceCase(e, e.label, 'label');
    }
    if (e.tooltip) {
      if (e.tooltip.length > 100) bad(e, `tooltip longer than 100 characters (${e.tooltip.length})`);
      if (/\.$/.test(e.tooltip)) bad(e, 'tooltip ends with a full stop');
      if (e.tooltip.toLowerCase() === e.label.toLowerCase()) bad(e, 'tooltip repeats the label');
      sentenceCase(e, e.tooltip, 'tooltip');
    }
    if (e.kind === 'text') {
      if (!e.text) bad(e, 'text is empty');
      const maxWords = voice ? 24 : 14;
      if (words(e.text).length > maxWords) bad(e, `text longer than ${maxWords} words`);
      if (e.text.length > (voice ? 160 : 90)) bad(e, `text longer than ${voice ? 160 : 90} characters (${e.text.length})`);
      if (!voice && /\.$/.test(e.text)) bad(e, 'interface text ends with a full stop');
      if (!voice && !FRAGMENT.test(e.id)) sentenceCase(e, e.text, 'text');
    }
  }
  return errors;
}

// Every `area.name` the doc mentions in backticks must be a row, or the start of one
// (`confirm.demolish` stands for its .title and .do rows; `note.possess.*` for a family).
function checkReferences(text, entries) {
  const ids = entries.map((e) => e.id);
  const known = new Set(ids);
  const errors = [];
  text.split(/\r?\n/).forEach((line, n) => {
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const token = m[1];
      const family = token.endsWith('.*');
      const name = family ? token.slice(0, -2) : token;
      if (!/^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/.test(name) && !(family && /^[a-z][a-z0-9]*$/.test(name))) continue;
      if (/\.(css|ts|tsx|js|mjs|json|md|svg|png|jpg|html|toml)$/.test(name)) continue; // a file name
      if (known.has(name) || ids.some((id) => id.startsWith(`${name}.`))) continue;
      errors.push(`line ${n + 1}: \`${token}\` is mentioned but no row has that ID`);
    }
  });
  return errors;
}

const source = readFileSync(file, 'utf8');
const { entries, errors: parseErrors } = parse(source);
const errors = [...parseErrors, ...check(entries), ...checkReferences(source, entries)];
const upto = option('--upto');
if (upto && !PHASES.includes(upto)) {
  console.error(`--upto must be one of ${PHASES.join(' ')}`);
  process.exit(2);
}
const wanted = upto ? entries.filter((e) => PHASES.indexOf(e.since) <= PHASES.indexOf(upto)) : entries;

if (flag('--json')) {
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const out = {};
  for (const { id, line, section, ...rest } of wanted) out[id] = rest;
  console.log(JSON.stringify(out, null, 2));
} else {
  const count = (kind) => wanted.filter((e) => e.kind === kind).length;
  console.log(`${wanted.length} entries: ${count('control')} controls, ${count('text')} texts, ${count('binding')} key bindings${upto ? ` (up to ${upto})` : ''}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log('Catalogue is consistent.');
}
