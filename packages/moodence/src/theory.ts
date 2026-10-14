/**
 * Scale-degree music theory.
 *
 * Everything is relative to a key: melody notes are scale degrees, chords are
 * a degree plus an optional accidental and quality. Change the tonic and every
 * pitch moves with it.
 *
 * Pitch classes are integers 0..11 with C = 0. A key is a `tonic` pitch class
 * plus a {@link Mode}.
 *
 * @module theory
 */

/** The two modes Moodence models. Minor is natural minor. */
export type Mode = "major" | "minor";

export const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export type Quality =
  | "maj" | "min" | "dim" | "aug" | "sus4"
  | "maj7" | "min7" | "dom7" | "hdim7" | "dim7";

export const QUALITY_INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  hdim7: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

/* A chord relative to the key. `quality: null` means "whatever the key gives
   this degree", so a diatonic ii stays diatonic when the mode changes, while
   an explicit quality (a borrowed bVI, a V7/V) keeps its exact sound. */
export interface ChordSpec {
  deg: number; // 1..7
  acc: number; // -1 flat, 0, +1 sharp, applied to the root
  quality: Quality | null;
  seventh: boolean; // only used when quality is null
  label?: string; // fixed Roman label, for secondary dominants
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/**
 * The quality a mode gives a scale degree, stacked in thirds.
 *
 * @example
 * diatonicQuality("major", 5, true); // "dom7"
 */
export function diatonicQuality(mode: Mode, deg: number, seventh: boolean): Quality {
  const key = `${mode}${deg}${seventh ? 7 : 3}`;
  let quality = DIATONIC_CACHE.get(key);
  if (!quality) {
    quality = computeDiatonicQuality(mode, deg, seventh);
    DIATONIC_CACHE.set(key, quality);
  }
  return quality;
}

// Only 28 possible inputs, and corpus-scale key estimation calls this millions of times.
const DIATONIC_CACHE = new Map<string, Quality>();

function computeDiatonicQuality(mode: Mode, deg: number, seventh: boolean): Quality {
  const scale = SCALES[mode];
  const root = scale[deg - 1];
  const stack = (seventh ? [0, 2, 4, 6] : [0, 2, 4]).map((step) => {
    const i = deg - 1 + step;
    return mod12(scale[i % 7] - root);
  });
  const key = stack.join(",");
  for (const [quality, intervals] of Object.entries(QUALITY_INTERVALS)) {
    if (intervals.join(",") === key) return quality as Quality;
  }
  throw new Error(`no quality for ${mode} degree ${deg}`);
}

export function chordQuality(spec: ChordSpec, mode: Mode): Quality {
  return spec.quality ?? diatonicQuality(mode, spec.deg, spec.seventh);
}

export function chordRootSemis(spec: ChordSpec, mode: Mode): number {
  return mod12(SCALES[mode][spec.deg - 1] + spec.acc);
}

export function isBorrowed(spec: ChordSpec, mode: Mode): boolean {
  if (spec.quality === null) return false;
  if (spec.acc !== 0) return true;
  const own = [diatonicQuality(mode, spec.deg, false), diatonicQuality(mode, spec.deg, true)];
  return !own.includes(spec.quality);
}

/** Absolute pitch classes (0..11) sounding in a chord. */
export function chordPitchClasses(spec: ChordSpec, mode: Mode, tonic: number): number[] {
  const root = tonic + chordRootSemis(spec, mode);
  return QUALITY_INTERVALS[chordQuality(spec, mode)].map((i) => mod12(root + i));
}

/** A close-position MIDI voicing with the root between C3 (48) and B3 (59). */
export function chordMidi(spec: ChordSpec, mode: Mode, tonic: number): number[] {
  const root = 48 + mod12(tonic + chordRootSemis(spec, mode));
  return QUALITY_INTERVALS[chordQuality(spec, mode)].map((i) => root + i);
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const UPPER: Quality[] = ["maj", "aug", "sus4", "maj7", "dom7"];
const ROMAN_SUFFIX: Record<Quality, string> = {
  maj: "", min: "", dim: "°", aug: "+", sus4: "sus4",
  maj7: "maj7", min7: "7", dom7: "7", hdim7: "ø7", dim7: "°7",
};

/**
 * Roman numeral for a chord: case for quality, ° ø + for diminished,
 * half-diminished and augmented, ♭/♯ for a chromatic root.
 *
 * @example
 * romanLabel({ deg: 6, acc: -1, quality: "maj", seventh: false }, "major"); // "♭VI"
 */
export function romanLabel(spec: ChordSpec, mode: Mode): string {
  if (spec.label) return spec.label;
  const quality = chordQuality(spec, mode);
  const numeral = NUMERALS[spec.deg - 1];
  const body = UPPER.includes(quality) ? numeral : numeral.toLowerCase();
  const prefix = spec.acc < 0 ? "♭" : spec.acc > 0 ? "♯" : "";
  return prefix + body + ROMAN_SUFFIX[quality];
}

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const FLAT_MAJOR = [5, 10, 3, 8, 1, 6];
const FLAT_MINOR = [2, 7, 0, 5, 10, 3];

export function prefersFlats(tonic: number, mode: Mode): boolean {
  return (mode === "major" ? FLAT_MAJOR : FLAT_MINOR).includes(mod12(tonic));
}

export function pitchName(pc: number, tonic: number, mode: Mode): string {
  return (prefersFlats(tonic, mode) ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

export function keyName(tonic: number, mode: Mode): string {
  return `${pitchName(tonic, tonic, mode)} ${mode}`;
}

const SYMBOL_SUFFIX: Record<Quality, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug", sus4: "sus4",
  maj7: "maj7", min7: "m7", dom7: "7", hdim7: "m7♭5", dim7: "dim7",
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACCIDENTALS: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };

/**
 * Spell a scale degree by letter, so the 6th of C is always some kind of A
 * (A, A♭) and never G♯. `semis` is the actual distance above the tonic.
 */
export function spellDegree(tonic: number, mode: Mode, deg: number, semis: number): string {
  const tonicLetter = LETTERS.indexOf(pitchName(tonic, tonic, mode)[0]);
  const letter = (tonicLetter + deg - 1) % 7;
  let offset = mod12(tonic + semis - LETTER_PC[letter]);
  if (offset > 6) offset -= 12;
  return LETTERS[letter] + (ACCIDENTALS[offset] ?? "?");
}

/**
 * Lead-sheet symbol for a chord in a key.
 *
 * @example
 * chordSymbol({ deg: 4, acc: 0, quality: null, seventh: false }, "major", 5); // "B♭"
 */
export function chordSymbol(spec: ChordSpec, mode: Mode, tonic: number): string {
  const root = spellDegree(tonic, mode, spec.deg, chordRootSemis(spec, mode));
  return root + SYMBOL_SUFFIX[chordQuality(spec, mode)];
}

export function degreeName(p: DegreePitch, mode: Mode, tonic: number): string {
  return spellDegree(tonic, mode, p.deg, SCALES[mode][p.deg - 1] + p.acc);
}

export interface PaletteGroup {
  title: string;
  chords: ChordSpec[];
}

/**
 * A curated chord palette for a mode: diatonic first, then borrowed and
 * secondary chords common in pop.
 */
export function palette(mode: Mode, seventh: boolean): PaletteGroup[] {
  const diatonic = [1, 2, 3, 4, 5, 6, 7].map((deg) => ({ deg, acc: 0, quality: null, seventh }));
  const c = (deg: number, acc: number, quality: Quality, label?: string): ChordSpec =>
    ({ deg, acc, quality, seventh: false, ...(label ? { label } : {}) });
  if (mode === "major") {
    return [
      { title: "In the key", chords: diatonic },
      { title: "Borrowed from minor", chords: [c(4, 0, "min"), c(6, -1, "maj"), c(7, -1, "maj"), c(3, -1, "maj")] },
      { title: "Secondary dominants", chords: [c(1, 0, "dom7", "V7/IV"), c(2, 0, "dom7", "V7/V"), c(3, 0, "dom7", "V7/vi"), c(6, 0, "dom7", "V7/ii")] },
      { title: "Color", chords: [c(5, 0, "sus4"), c(2, 0, "min7"), c(4, 0, "maj7")] },
    ];
  }
  return [
    { title: "In the key", chords: diatonic },
    { title: "Borrowed", chords: [c(5, 0, "maj"), c(5, 0, "dom7"), c(4, 0, "maj"), c(2, -1, "maj"), c(7, 1, "dim7")] },
    { title: "Color", chords: [c(5, 0, "sus4"), c(1, 0, "maj", "I (Picardy)")] },
  ];
}

/** A melody pitch as a scale degree. `oct` is relative to the tonic octave. */
export interface DegreePitch {
  deg: number; // 1..7
  oct: number; // -1, 0, +1 relative to the tonic octave
  acc: number;
}

export function tonicMidi(tonic: number): number {
  const pc = mod12(tonic);
  return 60 + (pc > 6 ? pc - 12 : pc);
}

/**
 * MIDI number for a scale degree. The tonic octave sits around middle C:
 * tonics C to F♯ start at 60 to 66, G to B start at 55 to 59.
 */
export function degreeMidi(p: DegreePitch, mode: Mode, tonic: number): number {
  return tonicMidi(tonic) + SCALES[mode][p.deg - 1] + p.acc + 12 * p.oct;
}
