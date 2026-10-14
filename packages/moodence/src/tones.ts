/**
 * Cantonese lyric tones against a melody.
 *
 * A typed wrapper over [cantojam](https://github.com/candpixie/CantoJam)'s
 * tone model, measured on Jason Lee's Cantopop corpus (105 songs, 2000 to
 * 2020, CC BY 4.0). For each pair of neighbouring syllables it knows which way
 * the corpus moves the melody, flags melodies that go the other way, and finds
 * corpus words that fit the notes instead.
 *
 * @module tones
 */

import * as cantojam from "cantojam";
import { degreeMidi } from "./theory";
import { sortedNotes, type Song } from "./song";

/** One sung syllable. `tone` is "1".."6", or null for English and unknown characters. */
export interface Syllable {
  char: string;
  jyutping: string | null;
  tone: string | null;
  /** Where the reading came from: the corpus, a hand-written colloquial table, or an override. */
  source: "corpus" | "curated" | "override" | null;
  /** True when the character has more than one reading in the corpus. */
  ambiguous: boolean;
  /** Punctuation: takes no note. */
  skipped: boolean;
  /** A run of Latin letters sung as one syllable. */
  latin: boolean;
}

/** The check for one syllable against the note it sits on. */
export interface ToneRow {
  index: number;
  char: string;
  jyutping: string | null;
  tone: string | null;
  midi: number | null;
  /** The melody moves against the direction the corpus takes at least 80% of the time. */
  violation: boolean;
  /** Singable, but a move the corpus makes under 6% of the time. */
  unusual: boolean;
  message?: string;
}

export interface ToneReport {
  rows: ToneRow[];
  violations: ToneRow[];
  unusual: ToneRow[];
  syllables: number;
  notes: number;
  lengthMismatch: boolean;
}

/** Tone number to its traditional name, e.g. "4" to "陽平 low falling". */
export const TONE_NAMES: Record<string, string> = cantojam.TONE_NAMES;

/** Size of the corpus the tone model was measured on. */
export const CORPUS = { songs: cantojam.corpusSongs, syllables: cantojam.corpusSyllables };

/**
 * Split a lyric into sung syllables with jyutping and tone.
 *
 * @param overrides Pin a reading per character, e.g. `{ 行: "haang4" }`.
 * @example
 * syllabify("我哋").map((s) => s.jyutping); // ["ngo5", "dei6"]
 */
export function syllabify(text: string, overrides: Record<string, string> = {}): Syllable[] {
  return cantojam.syllabify(text, overrides);
}

/**
 * Check a melody (MIDI numbers, one per sung syllable) against a lyric.
 *
 * @example
 * checkTones("慢行", [62, 67]).violations.length; // 1: tone 6 to 4 should fall
 */
export function checkTones(text: string, melody: number[], overrides: Record<string, string> = {}): ToneReport {
  const r = cantojam.check(text, melody, overrides);
  return {
    rows: r.rows,
    violations: r.violations,
    unusual: r.unusual,
    syllables: r.syllables,
    notes: r.notes,
    lengthMismatch: r.length_mismatch,
  };
}

/** A syllable placed on a melody note, with its tone-check result. */
export interface NoteLyric {
  text: string;
  jyutping: string | null;
  tone: string | null;
  status: "ok" | "violation" | "unusual" | "none";
  message?: string;
}

export interface LyricAlignment {
  /** Note id to the syllable on it. */
  byNote: Map<string, NoteLyric>;
  syllables: number;
  notes: number;
  violations: ToneRow[];
  unusual: ToneRow[];
  /** False when the lyric has no Cantonese syllables, in which case nothing is checked. */
  hasCantonese: boolean;
}

/**
 * Put a song's lyric on its melody, one syllable per note in time order, and
 * run the tone check when the lyric is Cantonese.
 */
export function alignLyrics(song: Song, toneCheck = true): LyricAlignment {
  const notes = sortedNotes(song.notes);
  const readings = song.readings ?? {};
  const sung = syllabify(song.lyrics, readings).filter((s) => !s.skipped);
  const hasCantonese = sung.some((s) => s.tone !== null);
  const midis = notes.map((n) => degreeMidi(n, song.mode, song.tonic));
  const report = toneCheck && hasCantonese ? checkTones(song.lyrics, midis, readings) : null;

  const byNote = new Map<string, NoteLyric>();
  notes.forEach((note, i) => {
    const syllable = sung[i];
    if (!syllable) return;
    const row = report?.rows[i];
    byNote.set(note.id, {
      text: syllable.char,
      jyutping: syllable.jyutping,
      tone: syllable.tone,
      status: !row ? "none" : row.violation ? "violation" : row.unusual ? "unusual" : "ok",
      message: row?.message,
    });
  });

  return {
    byNote,
    syllables: sung.length,
    notes: notes.length,
    violations: report?.violations ?? [],
    unusual: report?.unusual ?? [],
    hasCantonese,
  };
}

/** A corpus word that fits the notes where a clash is. */
export interface LyricFix {
  /** Index of the first sung syllable it replaces. */
  start: number;
  length: number;
  replaces: string;
  word: string;
  jyutping: string;
  /** Times the corpus used it. */
  count: number;
  /** Polyphones that must be sung with a non-default reading, e.g. "爲=wai4". */
  pin: string[];
}

/** One clash and the words that would fix it. */
export interface LyricProblem {
  /** Index of the sung syllable that clashes. */
  index: number;
  kind: "violation" | "unusual";
  message: string;
  /** Multi-character phrases the corpus wrote as a unit. Ranked first. */
  phrases: LyricFix[];
  /** Single characters that fit the notes. Whether they make sense is up to you. */
  singles: LyricFix[];
}

export interface LyricFixOptions {
  /** Readings already pinned in the song. */
  overrides?: Record<string, string>;
  /** Keep the line's final rhyme when the fix touches the last syllable. Default true. */
  keepRhyme?: boolean;
  /** Only words the corpus used at least this often. Default 2. */
  minCount?: number;
  /** Suggestions per bucket. Default 6. */
  limit?: number;
}

/**
 * For each tone clash, find corpus words that sit on those exact notes,
 * checked at both edges so fixing one clash cannot create the next. Lines are
 * separated by whitespace, and no fix spans two lines.
 *
 * Loads cantojam's word list (about 700 KB) on first call.
 *
 * @example
 * const [problem] = await suggestLyricFixes("慢慢行", [62, 62, 67]);
 * problem.phrases.map((f) => f.word); // ["綠燈", "路燈", "陌生", ...]
 */
export async function suggestLyricFixes(
  text: string, melody: number[], options: LyricFixOptions = {},
): Promise<LyricProblem[]> {
  await cantojam.loadWords();
  const report = cantojam.repairs(text, melody, { keepRhyme: true, minCount: 2, limit: 6, ...options });
  const fix = (o: cantojam.RepairOption): LyricFix => ({
    start: o.start, length: o.length, replaces: o.replaces, word: o.word,
    jyutping: o.jyutping, count: o.count, pin: o.pin,
  });
  // cantojam works on one line. Moodence sends the whole lyric, so drop any
  // fix that would join the end of one line to the start of the next.
  const spans = syllableSpans(text, options.overrides);
  const sameLine = (o: cantojam.RepairOption) => !crossesLineBreak(text, spans, o.start, o.length);
  return report.problems.map((p) => ({
    index: p.index,
    kind: p.kind,
    message: p.message,
    phrases: p.phrases.filter(sameLine).map(fix),
    singles: p.singles.filter(sameLine).map(fix),
  }));
}

/* Where each sung syllable sits in the text, in order. */
function syllableSpans(text: string, overrides: Record<string, string> = {}): [number, number][] {
  const spans: [number, number][] = [];
  let cursor = 0;
  for (const s of syllabify(text, overrides).filter((x) => !x.skipped)) {
    const at = text.indexOf(s.char, cursor);
    spans.push([at, at + s.char.length]);
    cursor = at + s.char.length;
  }
  return spans;
}

/* True if replacing syllables start..start+length would reach across
   whitespace, i.e. join the end of one lyric line to the next. */
function crossesLineBreak(text: string, spans: [number, number][], start: number, length: number): boolean {
  for (let i = start; i < start + length - 1; i++) {
    if (/\s/.test(text.slice(spans[i][1], spans[i + 1][0]))) return true;
  }
  return false;
}

/**
 * The readings a fix needs pinned, as an overrides map: `["爲=wai4"]` becomes
 * `{ 爲: "wai4" }`. Merge it into a song's `readings` when applying the fix.
 */
export function fixReadings(fix: Pick<LyricFix, "pin">): Record<string, string> {
  return Object.fromEntries(fix.pin.map((p) => p.split("=") as [string, string]));
}

/**
 * Apply a {@link LyricFix} to the original lyric text, keeping its spaces and
 * punctuation. Syllable indexes count sung syllables only.
 *
 * @example
 * applyLyricFix("慢慢，行", { start: 1, length: 2, word: "路燈", ... }); // "慢路，燈"
 */
export function applyLyricFix(text: string, fix: Pick<LyricFix, "start" | "length" | "word">): string {
  const spans = syllableSpans(text);
  if (fix.start < 0 || fix.start + fix.length > spans.length) return text;
  const chars = [...fix.word];
  let out = text;
  // Replace right to left so earlier offsets stay valid. Extra or missing
  // characters (a 2-char word over 2 syllables is the norm) go at the end.
  for (let i = fix.length - 1; i >= 0; i--) {
    const [from, to] = spans[fix.start + i];
    const piece = i === fix.length - 1 ? chars.slice(i).join("") : (chars[i] ?? "");
    out = out.slice(0, from) + piece + out.slice(to);
  }
  return out;
}
