/**
 * Transposition and capo.
 *
 * A song moves by changing its tonic, since everything in it is a scale
 * degree. Chord sheets (plain symbol strings) are re-spelled in the new key
 * by letter, so C G Am F up 3 is E♭ B♭ Cm A♭, not D♯ A♯ D♯m G♯.
 *
 * @module transpose
 */

import { parseChordSymbol, romanFromParsed, splitProgression } from "./parse";
import { estimateKey } from "./stats";
import { chordSymbol, pitchName, tonicMidi, type Mode } from "./theory";
import type { Song } from "./song";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/**
 * Move a song by `semitones`. The melody moves by exactly that amount: the
 * song's octave offset absorbs the jump where the tonic wraps (F♯ up to G).
 *
 * @example
 * transpose(song, 2); // C major -> D major, every note 2 semitones higher
 */
export function transpose(song: Song, semitones: number): Song {
  const tonic = mod12(song.tonic + semitones);
  const target = tonicMidi(song.tonic) + 12 * (song.octave ?? 0) + semitones;
  const octave = (target - tonicMidi(tonic)) / 12;
  return { ...song, tonic, octave };
}

/**
 * Transpose a chord sheet. The key is estimated from the chords, moved, and
 * every chord re-spelled in the new key. Anything that does not parse is
 * left as written.
 *
 * @param key Skip estimation and use this key for the original chords.
 * @example
 * transposeProgression("Am D G Em", 2); // "Bm E A F♯m"
 * transposeProgression("C G Am F", 3);  // "E♭ B♭ Cm A♭"
 */
export function transposeProgression(
  progression: string | string[],
  semitones: number,
  key?: { tonic: number; mode: Mode },
): string {
  const symbols = typeof progression === "string" ? splitProgression(progression) : progression;
  const from = key ?? estimateKey(symbols);
  if (!from) return symbols.join(" ");
  const to = mod12(from.tonic + semitones);
  return symbols.map((symbol) => {
    const parsed = parseChordSymbol(symbol);
    const spec = parsed && romanFromParsed(parsed, from.tonic, from.mode);
    if (!parsed || !spec) return symbol;
    const name = chordSymbol(spec, from.mode, to);
    return parsed.bass === null ? name : `${name}/${pitchName(parsed.bass + semitones, to, from.mode)}`;
  }).join(" ");
}

/**
 * The guitar shapes to play for sounding chords with a capo on `fret`.
 *
 * @example
 * capoShapes("Bm E A F#m", 2); // "Am D G Em"
 */
export function capoShapes(sounding: string | string[], fret: number, key?: { tonic: number; mode: Mode }): string {
  return transposeProgression(sounding, -fret, key);
}

/**
 * What chord shapes played with a capo on `fret` actually sound like.
 *
 * @example
 * soundingChords("Am D G Em", 2); // "Bm E A F♯m"
 */
export function soundingChords(shapes: string | string[], fret: number, key?: { tonic: number; mode: Mode }): string {
  return transposeProgression(shapes, fret, key);
}

/** The key whose chord names are the shapes to play with a capo on `fret`. */
export function shapeTonic(tonic: number, fret: number): number {
  return mod12(tonic - fret);
}
