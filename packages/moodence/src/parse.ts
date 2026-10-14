/**
 * Parse chord symbols and Roman numerals, and convert between them in a key.
 *
 * Unsupported chords return `null` rather than a guess, so corpus statistics
 * can count what they skipped.
 *
 * @module parse
 */

import {
  SCALES, diatonicQuality, pitchName, type ChordSpec, type Mode, type Quality,
} from "./theory";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** A chord symbol reduced to a root and one of Moodence's qualities. */
export interface ParsedSymbol {
  /** Root letter index, C = 0 ... B = 6. Keeps spelling (G♯ vs A♭). */
  letter: number;
  /** Root pitch class, 0..11. */
  root: number;
  quality: Quality;
  /** Slash bass pitch class, if the symbol had one. */
  bass: number | null;
}

// Longest suffixes first so "maj7" wins over "m".
const SYMBOL_QUALITIES: [string, Quality][] = [
  ["maj13", "maj7"], ["maj11", "maj7"], ["maj9", "maj7"], ["maj7", "maj7"], ["Maj7", "maj7"],
  ["M7", "maj7"], ["Δ7", "maj7"], ["Δ", "maj7"],
  ["m7b5", "hdim7"], ["m7♭5", "hdim7"], ["ø7", "hdim7"], ["ø", "hdim7"],
  ["dim7", "dim7"], ["°7", "dim7"], ["o7", "dim7"],
  ["min7", "min7"], ["m13", "min7"], ["m11", "min7"], ["m9", "min7"], ["m7", "min7"], ["-7", "min7"],
  ["sus4", "sus4"], ["sus", "sus4"],
  ["dim", "dim"], ["°", "dim"], ["o", "dim"],
  ["aug", "aug"], ["+", "aug"],
  ["min", "min"], ["m6", "min"], ["m", "min"], ["-", "min"],
  ["13", "dom7"], ["11", "dom7"], ["9", "dom7"], ["7", "dom7"],
  ["add9", "maj"], ["6", "maj"], ["maj", "maj"], ["", "maj"],
];

/**
 * Parse a lead-sheet chord symbol.
 *
 * Extensions reduce to their seventh chord (`Cm9` is `min7`, `G13` is
 * `dom7`). Power chords, sus2 and altered dominants return `null`.
 *
 * @example
 * parseChordSymbol("F#m7b5"); // { letter: 3, root: 6, quality: "hdim7", bass: null }
 * parseChordSymbol("C/E");    // { letter: 0, root: 0, quality: "maj", bass: 4 }
 */
export function parseChordSymbol(symbol: string): ParsedSymbol | null {
  const match = /^([A-Ga-g])([#♯b♭]*)([^/]*)(?:\/([A-Ga-g][#♯b♭]*))?$/.exec(symbol.trim());
  if (!match) return null;
  const [, letterText, accText, rest, bassText] = match;
  const letter = LETTERS.indexOf(letterText.toUpperCase());
  const root = mod12(LETTER_PC[letter] + accidentalShift(accText));
  const found = SYMBOL_QUALITIES.find(([suffix]) => rest === suffix);
  if (!found) return null;
  let bass: number | null = null;
  if (bassText) {
    const bassLetter = LETTERS.indexOf(bassText[0].toUpperCase());
    bass = mod12(LETTER_PC[bassLetter] + accidentalShift(bassText.slice(1)));
  }
  return { letter, root, quality: found[1], bass };
}

function accidentalShift(text: string): number {
  let shift = 0;
  for (const ch of text) shift += "#♯".includes(ch) ? 1 : "b♭".includes(ch) ? -1 : 0;
  return shift;
}

/**
 * Express a chord symbol as a key-relative {@link ChordSpec}.
 *
 * The degree comes from the root's letter, so `A♭` in C major is ♭VI and
 * `G♯` is ♯V. A chord whose quality matches the key comes back diatonic
 * (`quality: null`).
 *
 * @example
 * romanFromSymbol("Ab", 0, "major"); // ♭VI: { deg: 6, acc: -1, quality: "maj", ... }
 * romanFromSymbol("Dm7", 0, "major"); // diatonic ii7
 */
export function romanFromSymbol(symbol: string, tonic: number, mode: Mode): ChordSpec | null {
  const parsed = parseChordSymbol(symbol);
  return parsed ? romanFromParsed(parsed, tonic, mode) : null;
}

/** {@link romanFromSymbol} for an already-parsed symbol, for tight loops. */
export function romanFromParsed(parsed: ParsedSymbol, tonic: number, mode: Mode): ChordSpec | null {
  const tonicLetter = LETTERS.indexOf(pitchName(tonic, tonic, mode)[0]);
  const deg = (((parsed.letter - tonicLetter) % 7) + 7) % 7 + 1;
  let acc = mod12(parsed.root - tonic - SCALES[mode][deg - 1]);
  if (acc > 6) acc -= 12;
  if (Math.abs(acc) > 1) return null; // double accidentals: out of scope
  return keyRelative(deg, acc, parsed.quality, mode);
}

function keyRelative(deg: number, acc: number, quality: Quality, mode: Mode): ChordSpec {
  if (acc === 0) {
    if (diatonicQuality(mode, deg, false) === quality) return { deg, acc, quality: null, seventh: false };
    if (diatonicQuality(mode, deg, true) === quality) return { deg, acc, quality: null, seventh: true };
  }
  return { deg, acc, quality, seventh: false };
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/**
 * Parse a Roman numeral such as `V7`, `♭VI`, `ii°`, `viiø7`, `Imaj7`,
 * `Vsus4` or a secondary dominant like `V7/vi`.
 *
 * Case sets the third: uppercase is major, lowercase is minor. `b` and `#`
 * work as well as `♭` and `♯`. In minor, a diminished vii (`vii°`, `vii°7`,
 * `viiø7`) is built on the raised leading tone, as in standard analysis.
 *
 * @example
 * parseRoman("bVII", "major"); // { deg: 7, acc: -1, quality: "maj", ... }
 * parseRoman("V7/V", "major"); // D7 in C: { deg: 2, acc: 0, quality: "dom7", label: "V7/V" }
 */
export function parseRoman(text: string, mode: Mode): ChordSpec | null {
  const [head, target] = text.trim().split("/");
  const match = /^([b♭#♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(head);
  if (!match) return null;
  const [, accText, numeral, suffix] = match;
  const deg = NUMERALS.indexOf(numeral.toUpperCase()) + 1;
  const upper = numeral === numeral.toUpperCase();
  const quality = romanQuality(upper, suffix);
  if (!quality) return null;
  let acc = accidentalShift(accText);
  // Convention: a diminished vii in minor is built on the raised leading tone.
  if (mode === "minor" && deg === 7 && !accText && ["dim", "dim7", "hdim7"].includes(quality)) acc = 1;

  if (target === undefined) return keyRelative(deg, acc, quality, mode);

  // Secondary chord: V/x or vii°/x, built on the target's root.
  const tonicised = parseRoman(target, mode);
  if (!tonicised || (deg !== 5 && deg !== 7)) return null;
  const targetSemis = SCALES[mode][tonicised.deg - 1] + tonicised.acc;
  const rootSemis = mod12(targetSemis + (deg === 5 ? 7 : 11));
  const rootDeg = (tonicised.deg - 1 + deg - 1) % 7 + 1;
  let rootAcc = mod12(rootSemis - SCALES[mode][rootDeg - 1]);
  if (rootAcc > 6) rootAcc -= 12;
  return { deg: rootDeg, acc: rootAcc, quality, seventh: false, label: text.trim() };
}

function romanQuality(upper: boolean, suffix: string): Quality | null {
  switch (suffix) {
    case "": return upper ? "maj" : "min";
    case "7": return upper ? "dom7" : "min7";
    case "maj7": case "M7": case "Δ7": return "maj7";
    case "°": case "o": case "dim": return "dim";
    case "°7": case "o7": case "dim7": return "dim7";
    case "ø7": case "ø": return "hdim7";
    case "+": case "aug": return "aug";
    case "sus4": case "sus": return "sus4";
    default: return null;
  }
}

/**
 * Split a progression string on whitespace, bar lines and commas.
 *
 * @example
 * splitProgression("C G | Am F"); // ["C", "G", "Am", "F"]
 */
export function splitProgression(text: string): string[] {
  return text.split(/[\s|,]+/).filter(Boolean);
}
