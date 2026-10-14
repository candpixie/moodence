/**
 * Cantonese lyric tones against a melody.
 *
 * A typed wrapper over cantojam's tone model, measured on Jason Lee's
 * Cantopop corpus (105 songs, 2000 to 2020, CC BY 4.0). For each pair of
 * neighbouring syllables it knows which way the corpus moves the melody, and
 * flags melodies that go the other way.
 *
 * @module tones
 */

import * as cantojam from "./vendor/cantojam/cantojam.js";
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
  const sung = syllabify(song.lyrics).filter((s) => !s.skipped);
  const hasCantonese = sung.some((s) => s.tone !== null);
  const midis = notes.map((n) => degreeMidi(n, song.mode, song.tonic));
  const report = toneCheck && hasCantonese ? checkTones(song.lyrics, midis) : null;

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
