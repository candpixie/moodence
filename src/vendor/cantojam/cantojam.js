// cantojam core, ported from the Python package.
//
// This is a second implementation of the same model, which is a real risk:
// two copies drift. tests/test_parity.py runs both over the same inputs and
// fails if they ever disagree, so any change here must be mirrored in
// cantojam/*.py and vice versa.

import { CHAR_TONES, MODEL, COLLOQUIAL } from "./data.js";

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F",
                           "F#", "G", "G#", "A", "A#", "B"];
const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

export const TONE_NAMES = {
  1: "陰平 high level",
  2: "陰上 high rising",
  3: "陰去 mid level",
  4: "陽平 low falling",
  5: "陽上 low rising",
  6: "陽去 low level",
};

const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const JYUTPING = /^[a-z]+([1-6])$/;

// ---------------------------------------------------------------- lexicon

export function readings(char, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, char)) {
    return [overrides[char]];
  }
  const found = [];
  const entry = CHAR_TONES[char];
  if (entry) {
    for (const [jyut] of entry.readings) found.push(jyut);
  }
  for (const jyut of COLLOQUIAL[char] || []) {
    if (!found.includes(jyut)) found.push(jyut);
  }
  return found;
}

export function lookup(char, overrides) {
  return readings(char, overrides)[0] || null;
}

export function sourceOf(char, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, char)) return "override";
  if (CHAR_TONES[char]) return "corpus";
  if (COLLOQUIAL[char]) return "curated";
  return null;
}

export function toneOf(jyutping) {
  if (!jyutping) return null;
  const match = JYUTPING.exec(jyutping);
  return match ? match[1] : null;
}

export function isHan(char) {
  return HAN.test(char);
}

const LATIN = /[A-Za-z][A-Za-z'\u2019-]*/y;

/* Split a line into syllables.

   Cantopop is full of English words and vocables, and they are sung: "block"
   in 一首song takes a note like any other syllable. So a run of latin letters
   becomes one entry that occupies a note and carries no tone, rather than one
   skipped entry per letter, which would drop the note and shift every syllable
   after it. Punctuation is still skipped, and reported. */
export function syllabify(text, overrides = {}) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (isHan(char)) {
      const jyutping = lookup(char, overrides);
      out.push({
        char,
        jyutping,
        tone: toneOf(jyutping),
        source: sourceOf(char, overrides),
        ambiguous: !Object.prototype.hasOwnProperty.call(overrides, char) &&
                   readings(char, overrides).length > 1,
        skipped: false,
        latin: false,
      });
      i += 1;
      continue;
    }
    LATIN.lastIndex = i;
    const match = LATIN.exec(text);
    if (match) {
      out.push({ char: match[0], jyutping: null, tone: null, source: null,
                 ambiguous: false, skipped: false, latin: true });
      i = LATIN.lastIndex;
      continue;
    }
    if (char.trim()) {
      out.push({ char, jyutping: null, tone: null, source: null,
                 ambiguous: false, skipped: true, latin: false });
    }
    i += 1;
  }
  return out;
}

// ------------------------------------------------------------------ model

export const levels = MODEL.tone_levels;
export const sections = MODEL.sections;
export const corpusSongs = MODEL.songs;
export const corpusSyllables = MODEL.syllables;

export function level(tone) {
  return MODEL.tone_levels[tone];
}

export function transition(first, second) {
  return MODEL.transitions[`${first}${second}`] || null;
}

export function requiredDirection(first, second, threshold = 0.8) {
  const stats = transition(first, second);
  if (!stats) {
    const gap = level(second) - level(first);
    if (gap > 1.0) return 1;
    if (gap < -1.0) return -1;
    return 0;
  }
  if (stats.up >= threshold) return 1;
  if (stats.down >= threshold) return -1;
  return 0;
}

export function discouragedDirections(first, second, floor = 0.06) {
  const stats = transition(first, second);
  if (!stats) return [];
  const required = requiredDirection(first, second);
  const out = [];
  for (const [direction, key] of [[1, "up"], [0, "same"], [-1, "down"]]) {
    if (stats[key] < floor && direction !== required) out.push(direction);
  }
  return out;
}

export function suggestedInterval(first, second) {
  const stats = transition(first, second);
  if (stats) return stats.median;
  return Math.round(level(second) - level(first));
}

export function confidence(first, second) {
  const stats = transition(first, second);
  if (!stats) return 0;
  return Math.max(stats.up, stats.down, stats.same);
}

export function sectionOffset(name) {
  const entry = MODEL.sections[name];
  return entry ? entry.median_offset : 0;
}

// ------------------------------------------------------------------ notes

export function noteName(midi) {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function parseNote(token) {
  token = String(token).trim();
  if (!token) throw new Error("empty note");
  if (/^-?\d+$/.test(token)) return parseInt(token, 10);
  const letter = token[0].toUpperCase();
  if (!(letter in PITCH_CLASS)) throw new Error(`unknown note: ${token}`);
  let body = token.slice(1);
  let shift = 0;
  while (body && "#b♯♭".includes(body[0])) {
    shift += "#♯".includes(body[0]) ? 1 : -1;
    body = body.slice(1);
  }
  if (!/^-?\d+$/.test(body)) throw new Error(`unknown note: ${token}`);
  return (parseInt(body, 10) + 1) * 12 + PITCH_CLASS[letter] + shift;
}

export function parseKey(key) {
  const parts = key.trim().split(/\s+/);
  const name = parts[0];
  const quality = (parts.slice(1).join(" ") || "major").toLowerCase();
  const letter = name[0].toUpperCase();
  if (!(letter in PITCH_CLASS)) throw new Error(`unknown key: ${key}`);
  let tonic = PITCH_CLASS[letter];
  for (const accidental of name.slice(1)) {
    if ("#♯".includes(accidental)) tonic += 1;
    else if ("b♭".includes(accidental)) tonic -= 1;
    else throw new Error(`unknown key: ${key}`);
  }
  if (!(quality in SCALES)) throw new Error(`unknown scale: ${quality}`);
  return { tonic: ((tonic % 12) + 12) % 12, scale: SCALES[quality] };
}

export function scalePitches(tonic, scale, low, high) {
  const out = [];
  for (let p = low; p <= high; p += 1) {
    if (scale.includes((((p - tonic) % 12) + 12) % 12)) out.push(p);
  }
  return out;
}

function snap(target, allowed) {
  let best = allowed[0];
  let bestScore = [Math.abs(allowed[0] - target), allowed[0]];
  for (const pitch of allowed) {
    const score = [Math.abs(pitch - target), pitch];
    if (score[0] < bestScore[0] ||
        (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = pitch;
      bestScore = score;
    }
  }
  return best;
}

// ------------------------------------------------------------------ check

export function check(text, melody, overrides = {}) {
  const pitches = (typeof melody === "string"
    ? melody.replace(/,/g, " ").split(/\s+/).filter(Boolean)
    : melody).map((n) => (typeof n === "number" ? n : parseNote(n)));

  // Toneless syllables still occupy a note, matching buildContour. They can
  // never be a violation and they break the constraint between neighbours.
  const sung = syllabify(text, overrides).filter((s) => !s.skipped);
  const rows = [];

  sung.forEach((syllable, i) => {
    const row = {
      index: i,
      char: syllable.char,
      jyutping: syllable.jyutping,
      tone: syllable.tone,
      midi: i < pitches.length ? pitches[i] : null,
      note: i < pitches.length ? noteName(pitches[i]) : null,
      violation: false,
      unusual: false,
    };
    if (i && row.midi !== null && rows[i - 1].midi !== null
        && syllable.tone && sung[i - 1].tone) {
      const first = sung[i - 1].tone;
      const second = syllable.tone;
      const interval = row.midi - rows[i - 1].midi;
      const actual = Math.sign(interval);
      const required = requiredDirection(first, second);
      const stats = transition(first, second);
      const pair = `${sung[i - 1].char}${syllable.char} (tone ${first}->${second})`;
      const did = actual === 0 ? "holds" : actual > 0 ? "rises" : "falls";
      Object.assign(row, {
        interval,
        actual,
        required,
        corpus_median: suggestedInterval(first, second),
        confidence: confidence(first, second),
      });
      if (required && actual !== required) {
        row.violation = true;
        const way = required > 0 ? "rise" : "fall";
        row.message = `${pair} should ${way}; this melody ${did}. ` +
          `Corpus median ${suggestedInterval(first, second) >= 0 ? "+" : ""}` +
          `${suggestedInterval(first, second)} semitones over ${stats.n} examples.`;
      } else if (discouragedDirections(first, second).includes(actual)) {
        row.unusual = true;
        const key = actual === 1 ? "up" : actual === 0 ? "same" : "down";
        row.message = `${pair} ${did}, which the corpus does ` +
          `${(stats[key] * 100).toFixed(1)}% of the time across ${stats.n} ` +
          `examples. Singable, but rare.`;
      }
    }
    rows.push(row);
  });

  return {
    rows,
    violations: rows.filter((r) => r.violation),
    unusual: rows.filter((r) => r.unusual),
    syllables: sung.length,
    notes: pitches.length,
    length_mismatch: pitches.length !== sung.length,
  };
}

// ---------------------------------------------------------------- contour

export function buildContour(text, {
  key = "F major", center = "F4", section = null,
  overrides = {}, span = 14, spread = 1.0,
} = {}) {
  const { tonic, scale } = parseKey(key);
  let centre = typeof center === "string" ? parseNote(center) : center;
  if (section) centre += sectionOffset(section);

  const allowed = scalePitches(tonic, scale,
                               Math.round(centre - span),
                               Math.round(centre + span));
  // A syllable the lexicon cannot read still gets a note. Dropping it would
  // silently shorten the melody and shift everything after it.
  const syllables = syllabify(text, overrides).filter((s) => !s.skipped);
  const sung = syllables;
  if (!sung.length) {
    return { syllables, notes: [], warnings: [], unresolved: [], key, section };
  }

  // Beam search over scale-degree paths rather than a greedy repair. Mirrors
  // cantojam/contour.py exactly; tests/test_parity.py fails if they diverge.
  const BEAM_WIDTH = 32;
  const CADENCE_PENALTY = 2.0;
  const UNUSUAL_PENALTY = 2.0;
  const ARC_WEIGHT = 0.25;
  const STEP_WEIGHT = 0.5;
  const MOTIF_BONUS = 1.0;
  const IMPOSSIBLE = 1000.0;

  const idealPitches = sung.map((s) =>
    (s.tone ? centre + level(s.tone) * spread : null));
  const tonicPitch = ((tonic % 12) + 12) % 12;
  const dominantPitch = ((tonic + 7) % 12 + 12) % 12;

  let beam = [[0, []]];
  for (let i = 0; i < sung.length; i += 1) {
    const position = i / Math.max(1, sung.length - 1);
    const isLast = i === sung.length - 1;

    const legal = [];
    const forced = [];
    for (const [cost, path] of beam) {
      // Toneless syllables anchor to wherever this path already is.
      let ideal = idealPitches[i];
      if (ideal === null) ideal = path.length ? path[path.length - 1] : centre;
      const arcTarget = ideal + 3 * spread * Math.sin(position * Math.PI);

      for (const candidate of allowed) {
        let stepCost = Math.abs(candidate - ideal);
        stepCost += Math.abs(candidate - arcTarget) * ARC_WEIGHT;
        const pc = ((candidate % 12) + 12) % 12;
        if (isLast && pc !== tonicPitch && pc !== dominantPitch) {
          stepCost += CADENCE_PENALTY;
        }

        let violates = false;
        if (i && sung[i].tone && sung[i - 1].tone) {
          const previous = path[path.length - 1];
          const first = sung[i - 1].tone;
          const second = sung[i].tone;
          const want = requiredDirection(first, second);
          const step = candidate - previous;
          const actual = Math.sign(step);

          if (want && actual !== want) violates = true;
          if (!want && discouragedDirections(first, second).includes(actual)) {
            stepCost += UNUSUAL_PENALTY;
          }

          const expected = suggestedInterval(first, second) * spread;
          stepCost += Math.abs(step - expected) * STEP_WEIGHT;

          // If this tone pair appeared earlier, repeating the interval it took
          // then turns coincidence into a motif.
          for (let j = 1; j < i; j += 1) {
            if (sung[j - 1].tone === first && sung[j].tone === second) {
              if (step === path[j] - path[j - 1]) stepCost -= MOTIF_BONUS;
              break;
            }
          }
        }

        const total = cost + stepCost;
        if (violates) forced.push([total + IMPOSSIBLE, path.concat(candidate)]);
        else legal.push([total, path.concat(candidate)]);
      }
    }

    const candidates = legal.length ? legal : forced;
    // Python's sort is stable and compares the cost first; matching that
    // exactly is what keeps the two implementations byte-identical.
    candidates.sort((a, b) => a[0] - b[0]);
    beam = candidates.slice(0, BEAM_WIDTH);
  }

  const pitches = beam[0][1];
  const warnings = [];
  for (let i = 1; i < pitches.length; i += 1) {
    const first = sung[i - 1].tone;
    const second = sung[i].tone;
    if (!first || !second) continue;
    const want = requiredDirection(first, second);
    const actual = Math.sign(pitches[i] - pitches[i - 1]);
    if (want !== 0 && actual !== want) {
      warnings.push({
        index: i,
        char: sung[i].char,
        reason: `tone ${first}->${second} must move ` +
                `${want > 0 ? "up" : "down"} but the range is exhausted`,
      });
    }
  }

  const base = allowed.indexOf(snap(centre, allowed));
  const notes = sung.map((syllable, i) => {
    const entry = {
      char: syllable.char,
      jyutping: syllable.jyutping,
      tone: syllable.tone,
      midi: pitches[i],
      note: noteName(pitches[i]),
      degree: allowed.indexOf(pitches[i]) - base,
      source: syllable.source,
      ambiguous: syllable.ambiguous,
    };
    if (i) {
      const first = sung[i - 1].tone;
      const second = syllable.tone;
      entry.interval = pitches[i] - pitches[i - 1];
      if (first && second) {
        entry.required = requiredDirection(first, second);
        entry.corpus_median = suggestedInterval(first, second);
        entry.confidence = confidence(first, second);
      }
    }
    return entry;
  });

  return {
    key,
    section,
    notes,
    syllables,
    warnings,
    unresolved: syllables.filter((s) => !s.skipped && !s.tone).map((s) => s.char),
  };
}

// --------------------------------------------------------------- word list
//
// Loaded on demand: the lexicon is several times the size of the model, and
// most visits never open the word finder.

const INITIALS = ["gw", "kw", "ng", "b", "p", "m", "f", "d", "t", "n", "l",
                  "g", "k", "h", "z", "c", "s", "j", "w"];

export function rime(jyutping) {
  const body = jyutping.slice(0, -1);
  for (const initial of INITIALS) {
    if (body.startsWith(initial) && body.length > initial.length) {
      return body.slice(initial.length);
    }
  }
  return body;
}

let entries = null;
export function wordsLoaded() { return entries !== null; }

export async function loadWords() {
  if (entries) return entries;
  ({ LEXICON: entries } = await import("./lexicon.js"));
  return entries;
}

function rimeOf(text) {
  if (!text) return null;
  if (/^[a-z]+[1-6]$/.test(text)) return rime(text);
  const exact = entries.find((e) => e.w === text);
  if (exact) return exact.r;
  const last = entries.find((e) => e.w === text[text.length - 1]);
  return last ? last.r : null;
}

function tonesMatch(actual, pattern) {
  if (actual.length !== pattern.length) return false;
  return [...pattern].every((p, i) => p === "?" || p === "." || p === actual[i]);
}

export function search({ contains, rimesWith, tones, length,
                         minCount = 1, limit = 100 } = {}) {
  if (!entries) throw new Error("call loadWords() first");
  let targetRime = null;
  if (rimesWith) {
    targetRime = rimeOf(rimesWith);
    if (!targetRime) return [];
  }
  const out = [];
  for (const entry of entries) {
    if (length && entry.w.length !== length) continue;
    if (entry.n < minCount) continue;
    if (contains && !entry.w.includes(contains)) continue;
    if (targetRime && entry.r !== targetRime) continue;
    if (tones && !tonesMatch(entry.t, tones)) continue;
    out.push(entry);
    if (limit && out.length >= limit) break;
  }
  return out;
}

/** Words that can sit at a slot in an existing melody. See lexicon.py. */
export function fitting(pitches, lineTones, start, length,
                        { allowUnusual = false, ...filters } = {}) {
  if (start < 0 || start + length > pitches.length) return [];
  const direction = (i) => Math.sign(pitches[i] - pitches[i - 1]);

  const allowed = (first, second, at) => {
    const required = requiredDirection(first, second);
    const actual = direction(at);
    if (required) return actual === required;
    if (allowUnusual) return true;
    return !discouragedDirections(first, second).includes(actual);
  };

  const out = [];
  for (const entry of search({ ...filters, length, limit: null })) {
    const pattern = entry.t;
    let ok = true;
    for (let j = 1; j < length && ok; j += 1) {
      ok = allowed(pattern[j - 1], pattern[j], start + j);
    }
    if (ok && start > 0 && lineTones[start - 1]) {
      ok = allowed(lineTones[start - 1], pattern[0], start);
    }
    if (ok && start + length < pitches.length && lineTones[start + length]) {
      ok = allowed(pattern[pattern.length - 1], lineTones[start + length],
                   start + length);
    }
    if (ok) out.push(entry);
  }
  return out;
}

// --- a melody that already exists ------------------------------------------

const DEGREE_STEPS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

export function parseMelody(melody) {
  const tokens = Array.isArray(melody)
    ? melody : String(melody).replace(/,/g, " ").trim().split(/\s+/);
  return tokens.filter((t) => t !== "")
    .map((t) => (typeof t === "number" ? t : parseNote(t)));
}

/* Numbered notation (簡譜) -> MIDI numbers. ' or ^ lifts an octave, . or ,
   drops one, leading #/b bends a semitone, 0 is a rest and carries no
   syllable. Songwriters who read 簡譜 can type a melody straight in. */
export function parseDegrees(text, key = "F major", octave = 4) {
  const { tonic, scale } = parseKey(key);
  const base = (octave + 1) * 12 + tonic;
  const out = [];
  for (let token of String(text).replace(/,/g, " ").trim().split(/\s+/)) {
    if (!token) continue;
    let shift = 0;
    while (token && "#b♯♭".includes(token[0])) {
      shift += "#♯".includes(token[0]) ? 1 : -1;
      token = token.slice(1);
    }
    let jump = 0;
    while (token && "'^.,_".includes(token[token.length - 1])) {
      jump += "'^".includes(token[token.length - 1]) ? 1 : -1;
      token = token.slice(0, -1);
    }
    if (token === "0") continue;
    if (!(token in DEGREE_STEPS)) {
      throw new Error(`unknown scale degree: ${token}`);
    }
    const step = DEGREE_STEPS[token];
    out.push(base + scale[step % scale.length]
             + 12 * (Math.floor(step / scale.length) + jump) + shift);
  }
  return out;
}

/* A clash sits between two syllables. Replacing the phrase that spans it is
   tried first, then the wider phrase, then either character alone. */
const WINDOWS = [[-1, 2], [-1, 3], [0, 2], [-1, 1], [0, 1]];

export function repairs(text, melody, {
  keepRhyme = true, minCount = 2, limit = 6, allowUnusual = false,
  overrides = {},
} = {}) {
  const pitches = parseMelody(melody);
  const result = check(text, pitches, overrides);
  const rows = result.rows;
  const tones = rows.map((r) => r.tone);
  const here = rows.map((r) => r.char);
  const last = rows.length - 1;
  const rhyme = rows.length && rows[last].jyutping ? rows[last].jyutping : null;

  /* A candidate is admitted on the tones the corpus sang it with, but the
     checker reads a polyphone with its most frequent reading. 爲何 is offered
     as wai4 ho4 while 爲 defaults to wai6, and that one tone is the difference
     between fitting and not. Name it rather than drop it. */
  const readingNote = (entry) => {
    const pins = [];
    entry.j.split(/\s+/).forEach((syllable, i) => {
      const char = entry.w[i];
      if (toneOf(syllable) !== toneOf(lookup(char, overrides) || "")) {
        pins.push(`${char}=${syllable}`);
      }
    });
    return pins;
  };

  const problems = [];
  for (const row of rows) {
    if (!row.violation && !row.unusual) continue;
    const phrases = [];
    const singles = [];
    const seen = new Set();
    for (const [offset, length] of WINDOWS) {
      const start = row.index + offset;
      if (start < 0 || start + length > rows.length) continue;
      const was = here.slice(start, start + length).join("");
      const filters = { minCount };
      if (keepRhyme && rhyme && start + length > last) filters.rimesWith = rhyme;
      for (const entry of fitting(pitches, tones, start, length,
                                  { allowUnusual, ...filters })) {
        const key = `${start}:${entry.w}`;
        if (entry.w === was || seen.has(key)) continue;
        seen.add(key);
        (length === 1 ? singles : phrases).push({
          start, length, replaces: was, word: entry.w, jyutping: entry.j,
          tones: entry.t, rime: entry.r, count: entry.n, pin: readingNote(entry),
          line: here.slice(0, start).join("") + entry.w
                + here.slice(start + length).join(""),
        });
      }
    }
    phrases.sort((a, b) => a.length - b.length || b.count - a.count);
    singles.sort((a, b) => b.count - a.count);
    problems.push({
      index: row.index,
      kind: row.violation ? "violation" : "unusual",
      message: row.message || "",
      phrases: phrases.slice(0, limit), singles: singles.slice(0, limit),
      phraseTotal: phrases.length, singleTotal: singles.length,
    });
  }

  return { check: result, problems, clean: problems.length === 0, line: text };
}

/* Read a melody out of a MIDI export. Notes starting on the same tick are one
   chord and collapse to the top note, because a syllable is sung on one pitch. */
export function readMidi(buffer, track = null) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const text = (i) => String.fromCharCode(data[i], data[i + 1],
                                          data[i + 2], data[i + 3]);
  if (text(0) !== "MThd") throw new Error("not a MIDI file");

  const varint = (i) => {
    let value = 0;
    for (;;) {
      const byte = data[i];
      i += 1;
      value = (value << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) return [value, i];
    }
  };

  const events = (start, end) => {
    const out = [];
    let i = start;
    let tick = 0;
    let status = null;
    while (i < end) {
      let delta;
      [delta, i] = varint(i);
      tick += delta;
      if (i >= end) break;
      const byte = data[i];
      if (byte === 0xff) {
        i += 2;
        let length;
        [length, i] = varint(i);
        i += length;
        continue;
      }
      if (byte === 0xf0 || byte === 0xf7) {
        i += 1;
        let length;
        [length, i] = varint(i);
        i += length;
        continue;
      }
      if (byte & 0x80) { status = byte; i += 1; }
      if (status === null) break;
      const kind = status & 0xf0;
      if (kind === 0xc0 || kind === 0xd0) { i += 1; continue; }
      const pitch = data[i];
      const velocity = data[i + 1];
      i += 2;
      if (kind === 0x90 && velocity > 0) out.push([tick, pitch]);
    }
    return out;
  };

  const format = view.getUint16(8);
  const tracks = [];
  let i = 8 + view.getUint32(4);
  while (i < data.length && text(i) === "MTrk") {
    const length = view.getUint32(i + 4);
    tracks.push([i + 8, i + 8 + length]);
    i += 8 + length;
  }
  if (!tracks.length) throw new Error("no tracks in this MIDI file");

  const parsed = tracks.map(([a, b]) => events(a, b));
  let chosen;
  if (track !== null) chosen = parsed[track];
  else if (format === 0) chosen = parsed[0];
  // Type 1 usually puts tempo and key alone on track 0. Take whichever track
  // carries the most notes rather than guessing by position.
  else chosen = parsed.reduce((a, b) => (b.length > a.length ? b : a), []);

  const byTick = new Map();
  for (const [tick, pitch] of chosen) {
    byTick.set(tick, Math.max(byTick.get(tick) ?? -1, pitch));
  }
  return [...byTick.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}
