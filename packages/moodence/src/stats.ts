/**
 * Progression statistics: which chord follows which, counted over a corpus.
 *
 * Works on Roman labels, so songs in different keys pool together. Feed it
 * the output of {@link romanize} over a dataset such as Chordonomicon.
 *
 * @module stats
 */

import { parseChordSymbol, romanFromParsed, romanFromSymbol, splitProgression, type ParsedSymbol } from "./parse";
import { romanLabel, type ChordSpec, type Mode } from "./theory";

/** One chord of a romanized progression. `spec` is null if it didn't parse. */
export interface RomanChord {
  symbol: string;
  spec: ChordSpec | null;
  roman: string | null;
}

/**
 * Turn a symbol progression into Roman numerals in a key.
 *
 * @example
 * romanize("C G Am F", 0, "major").map((c) => c.roman); // ["I", "V", "vi", "IV"]
 */
export function romanize(progression: string | string[], tonic: number, mode: Mode): RomanChord[] {
  const symbols = typeof progression === "string" ? splitProgression(progression) : progression;
  return symbols.map((symbol) => {
    const spec = romanFromSymbol(symbol, tonic, mode);
    return { symbol, spec, roman: spec ? romanLabel(spec, mode) : null };
  });
}

/** Counts of `from -> to` transitions, plus how many chords were skipped. */
export interface TransitionCounts {
  counts: Map<string, Map<string, number>>;
  /** Chords that did not parse. A transition through one is not counted. */
  skipped: number;
  /** Repeated chords (`I I`) are merged before counting. */
  total: number;
}

/**
 * Count chord-to-chord transitions over many romanized progressions.
 *
 * Consecutive repeats collapse (`I I V` counts one `I -> V`), and a chord
 * that failed to parse breaks the chain on both sides instead of being
 * guessed at.
 */
export function countTransitions(progressions: Iterable<(string | null)[]>): TransitionCounts {
  const counts = new Map<string, Map<string, number>>();
  let skipped = 0;
  let total = 0;
  for (const progression of progressions) {
    let prev: string | null = null;
    for (const label of progression) {
      if (label === null) {
        skipped += 1;
        prev = null;
        continue;
      }
      if (label === prev) continue;
      if (prev !== null) {
        const row = counts.get(prev) ?? new Map<string, number>();
        row.set(label, (row.get(label) ?? 0) + 1);
        counts.set(prev, row);
        total += 1;
      }
      prev = label;
    }
  }
  return { counts, skipped, total };
}

/** A candidate next chord with its share of observed transitions. */
export interface NextChord {
  roman: string;
  count: number;
  probability: number;
}

/**
 * Most frequent next chords after `from`, highest first.
 *
 * @example
 * const t = countTransitions([["I", "V", "vi", "IV"], ["I", "V", "IV"]]);
 * nextChords(t, "V"); // [{ roman: "vi", count: 1, probability: 0.5 }, { roman: "IV", ... }]
 */
export function nextChords(transitions: TransitionCounts, from: string, limit = 8): NextChord[] {
  const row = transitions.counts.get(from);
  if (!row) return [];
  let sum = 0;
  for (const count of row.values()) sum += count;
  return [...row.entries()]
    .map(([roman, count]) => ({ roman, count, probability: count / sum }))
    .sort((a, b) => b.count - a.count || a.roman.localeCompare(b.roman))
    .slice(0, limit);
}

/** A key guess for a progression. */
export interface KeyEstimate {
  tonic: number;
  mode: Mode;
  /** Share of parsed chords that belong to the key (V and V7 count in minor). */
  fit: number;
  /** Margin over the runner-up key, 0..1. Low means ambiguous. */
  margin: number;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/**
 * Guess the key of a chord progression from its symbols.
 *
 * Scores all 24 major and minor keys by how many chords are diatonic, then
 * breaks the tie between relative keys (C major and A minor share every
 * chord) by how often the tonic chord appears and whether the progression
 * starts or ends on it. Only chords are used, never a melody, so modal and
 * chromatic songs come back with a low `fit`.
 *
 * @example
 * estimateKey(["Am", "F", "C", "G", "Am"]); // { tonic: 9, mode: "minor", ... }
 */
export function estimateKey(progression: string | string[]): KeyEstimate | null {
  const symbols = typeof progression === "string" ? splitProgression(progression) : progression;
  const parsed = symbols.map(parseChordSymbol).filter((p): p is ParsedSymbol => p !== null);
  if (!parsed.length) return null;

  const scored: { tonic: number; mode: Mode; fit: number; score: number }[] = [];
  for (const mode of ["major", "minor"] as const) {
    for (let tonic = 0; tonic < 12; tonic++) {
      let inKey = 0;
      let onTonic = 0;
      const specs = parsed.map((p) => romanFromParsed(p, tonic, mode));
      specs.forEach((spec) => {
        if (!spec) return;
        const dominantInMinor = mode === "minor" && spec.deg === 5 && spec.acc === 0
          && (spec.quality === "maj" || spec.quality === "dom7");
        if (spec.quality === null || dominantInMinor) inKey += 1;
        if (spec.deg === 1 && spec.acc === 0 && spec.quality === null) onTonic += 1;
      });
      const isTonic = (spec: ChordSpec | null) => !!spec && spec.deg === 1 && spec.acc === 0 && spec.quality === null;
      const fit = inKey / parsed.length;
      const score = fit + 0.3 * (onTonic / parsed.length)
        + 0.1 * Number(isTonic(specs[0])) + 0.15 * Number(isTonic(specs[specs.length - 1]));
      scored.push({ tonic, mode, fit, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  return {
    tonic: mod12(best.tonic),
    mode: best.mode,
    fit: best.fit,
    margin: Math.max(0, Math.min(1, best.score - second.score)),
  };
}
