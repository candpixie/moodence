/**
 * Plain-language help for picking chords: a feel word per chord, which
 * chords usually come next, and starter progressions.
 *
 * Everything here is hand-written pop harmony rules, not learned from data.
 * They are hints for a songwriter, never a verdict. Any chord can follow any
 * other.
 *
 * @module feel
 */

import { chordQuality, chordRootSemis, type ChordSpec, type Mode, type Quality } from "./theory";

type Shape = "M" | "m" | "d" | "s";

const SHAPE: Record<Quality, Shape> = {
  maj: "M", maj7: "M", dom7: "M", aug: "M",
  min: "m", min7: "m",
  dim: "d", hdim7: "d", dim7: "d",
  sus4: "s",
};

// Keyed by root (semitones above the tonic) plus shape. Mode-specific words win.
const FEEL: Record<string, string> = {
  "0M": "home",
  "0m": "home",
  "1M": "dramatic",
  "2m": "steps away",
  "2d": "uneasy",
  "3M": "hopeful",
  "4m": "wistful",
  "5M": "lifting",
  "5m": "heavy",
  "7M": "wants home",
  "7m": "soft tension",
  "7s": "suspended",
  "8M": "epic",
  "9m": "sad home",
  "9d": "uneasy",
  "10M": "lift",
  "11d": "wants home",
};

const FEEL_BY_MODE: Record<Mode, Record<string, string>> = {
  major: { "3M": "bold", "5m": "bittersweet", "10M": "rock lift" },
  minor: { "0M": "bright ending", "5M": "bright surprise" },
  dorian: { "0M": "bright ending", "5M": "bright lift" },
};

/**
 * A one- or two-word feel for a chord in a key.
 *
 * @example
 * chordFeel({ deg: 5, acc: 0, quality: null, seventh: false }, "major"); // "wants home"
 * chordFeel({ deg: 6, acc: -1, quality: "maj", seventh: false }, "major"); // "epic"
 */
export function chordFeel(spec: ChordSpec, mode: Mode): string {
  if (spec.label?.startsWith("V7/")) return `leads to ${spec.label.slice(3)}`;
  const quality = chordQuality(spec, mode);
  const root = chordRootSemis(spec, mode);
  if (quality === "maj7") return "dreamy";
  if (quality === "dim7") return "spooky";
  if (quality === "dom7" && root !== 7) return "bluesy";
  const key = `${root}${SHAPE[quality]}`;
  return FEEL_BY_MODE[mode][key] ?? FEEL[key] ?? "color";
}

// Roots (semitones above the tonic) that commonly follow each root.
const NEXT: Record<Mode, Record<number, number[]>> = {
  major: {
    0: [5, 7, 9, 2], 2: [7, 5, 0], 3: [8, 5], 4: [9, 5], 5: [0, 7, 9, 2, 5],
    7: [0, 9, 5], 8: [10, 7, 0], 9: [5, 2, 7, 4], 10: [0, 5], 11: [0],
  },
  minor: {
    0: [8, 10, 3, 5], 1: [7, 0], 2: [7, 0], 3: [8, 10, 5], 5: [0, 7, 10],
    7: [0, 8], 8: [10, 3, 7, 5], 10: [0, 3, 8], 11: [0],
  },
  dorian: {
    0: [5, 10, 3, 2], 2: [5, 0, 7], 3: [5, 10, 2], 5: [0, 10, 3], 7: [0, 5],
    8: [10, 7], 9: [0], 10: [0, 5], 11: [0],
  },
};

const sameChord = (a: ChordSpec, b: ChordSpec, mode: Mode) =>
  chordRootSemis(a, mode) === chordRootSemis(b, mode) && chordQuality(a, mode) === chordQuality(b, mode);

/**
 * Whether `next` is a common move after `prev` in pop harmony. A hint for
 * highlighting, not a rule: uncommon moves are often the interesting ones.
 *
 * @example
 * const I = { deg: 1, acc: 0, quality: null, seventh: false };
 * const V = { deg: 5, acc: 0, quality: null, seventh: false };
 * commonNext(V, I, "major"); // true
 */
export function commonNext(prev: ChordSpec, next: ChordSpec, mode: Mode): boolean {
  if (sameChord(prev, next, mode)) return false;
  const from = chordRootSemis(prev, mode);
  const to = chordRootSemis(next, mode);
  // A secondary dominant resolves down a fifth to the chord it names.
  if (prev.label?.startsWith("V7/")) return to === (from + 5) % 12;
  if (chordQuality(prev, mode) === "sus4") return to === from || to === 0;
  return (NEXT[mode][from] ?? [0]).includes(to);
}

/** A named progression to start from. */
export interface Starter {
  name: string;
  mode: Mode;
  chords: ChordSpec[];
}

const d = (deg: number, quality: Quality | null = null, acc = 0): ChordSpec =>
  ({ deg, acc, quality, seventh: false });

/** Common progressions for each mode, to drop in and then change. */
export const STARTERS: Starter[] = [
  { name: "Hopeful", mode: "major", chords: [d(1), d(5), d(6), d(4)] },
  { name: "Sad but warm", mode: "major", chords: [d(6), d(4), d(1), d(5)] },
  { name: "Canon ballad", mode: "major", chords: [d(1), d(5), d(6), d(3), d(4), d(1), d(4), d(5)] },
  { name: "Royal road", mode: "major", chords: [d(4), d(5), d(3), d(6)] },
  { name: "Dreamy", mode: "major", chords: [d(1, "maj7"), d(3, "min7"), d(6, "min7"), d(4, "maj7")] },
  { name: "Bittersweet", mode: "major", chords: [d(1), d(4), d(4, "min"), d(1)] },
  { name: "Doo-wop", mode: "major", chords: [d(1), d(6), d(4), d(5)] },
  { name: "Rising", mode: "major", chords: [d(4), d(1), d(5), d(6)] },
  { name: "Floating", mode: "major", chords: [d(1), d(3), d(4), d(4, "min")] },
  { name: "Big chorus", mode: "major", chords: [d(1), d(5), d(6, "maj", -1), d(7, "maj", -1)] },
  { name: "Dark loop", mode: "minor", chords: [d(1), d(6), d(3), d(7)] },
  { name: "Epic", mode: "minor", chords: [d(1), d(7), d(6), d(7)] },
  { name: "Lament", mode: "minor", chords: [d(1), d(7), d(6), d(5, "maj")] },
  { name: "Pull home", mode: "minor", chords: [d(1), d(4), d(5, "dom7"), d(1)] },
  { name: "Night drive", mode: "minor", chords: [d(1), d(6), d(7), d(1)] },
  { name: "Brooding", mode: "minor", chords: [d(1), d(4), d(6), d(5, "maj")] },
  { name: "Cool vamp", mode: "dorian", chords: [d(1), d(4)] },
  { name: "Groove", mode: "dorian", chords: [d(1), d(3), d(7), d(4)] },
];
