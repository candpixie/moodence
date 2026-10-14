// Next-chord statistics from the Chordonomicon dataset.
//
// Chordonomicon is CC BY-NC 4.0, so it is not included here and anything you
// derive from it is non-commercial. Download it yourself:
//   https://huggingface.co/datasets/ailsntua/Chordonomicon
//
//   node examples/04-chordonomicon.mjs chordonomicon_v2.csv [--genre pop] [--limit 50000]
//
// The dataset has no key column, so each song's key is estimated from its
// chords and songs with a weak fit are dropped. Run without a path to use the
// four synthetic rows in examples/data/.

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { countTransitions, estimateKey, nextChords, romanize } from "moodence";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const path = args[0] && !args[0].startsWith("--")
  ? args[0]
  : fileURLToPath(new URL("./data/chordonomicon-format-sample.csv", import.meta.url));
const genre = flag("--genre")?.toLowerCase();
const limit = Number(flag("--limit") ?? Infinity);
const MIN_FIT = 0.8;

/** Chordonomicon writes C# as "Cs" and minor as "min", and tags sections like <verse_1>. */
export function chordonomiconTokens(field) {
  return field.split(/\s+/)
    .filter((t) => t && !t.startsWith("<"))
    .map((t) => t.replace(/^([A-G])s(?!us)/, "$1#").replace(/\/([A-G])s$/, "/$1#"));
}

function splitCsv(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out;
}

const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
let header = null;
const sequences = [];
let songs = 0;
let kept = 0;
let chordsSeen = 0;
let chordsParsed = 0;

for await (const line of lines) {
  if (!header) { header = splitCsv(line); continue; }
  const row = Object.fromEntries(splitCsv(line).map((v, i) => [header[i], v]));
  if (genre && !`${row.genres} ${row.main_genre}`.toLowerCase().includes(genre)) continue;
  if (++songs > limit) break;
  const tokens = chordonomiconTokens(row.chords ?? "");
  const key = estimateKey(tokens);
  if (!key || key.fit < MIN_FIT) continue;
  kept += 1;
  const romans = romanize(tokens, key.tonic, key.mode).map((c) => c.roman);
  chordsSeen += romans.length;
  chordsParsed += romans.filter(Boolean).length;
  sequences.push(romans);
}

const transitions = countTransitions(sequences);
console.log(`${Math.min(songs, limit)} songs${genre ? ` matching "${genre}"` : ""}, ${kept} with key fit >= ${MIN_FIT}`);
console.log(`${chordsParsed}/${chordsSeen} chords parsed, ${transitions.total} transitions\n`);
for (const from of ["I", "IV", "V", "vi", "i", "VI", "VII"]) {
  const next = nextChords(transitions, from, 5);
  if (next.length) console.log(`${from.padEnd(4)} -> ${next.map((n) => `${n.roman} ${(n.probability * 100).toFixed(0)}%`).join(", ")}`);
}
