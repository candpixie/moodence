/**
 * The song model: chords and melody notes on a sixteenth-note grid, all in
 * scale degrees. Plain JSON, so a song saves and loads as-is.
 *
 * @module song
 */

import type { ChordSpec, DegreePitch, Mode } from "./theory";

export const STEPS_PER_BEAT = 4; // sixteenth notes
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

/** A chord placed on the grid. `start` and `len` are in steps. */
export interface ChordEvent extends ChordSpec {
  id: string;
  start: number;
  len: number;
}

/** A melody note placed on the grid. `start` and `len` are in steps. */
export interface NoteEvent extends DegreePitch {
  id: string;
  start: number;
  len: number;
}

/** A whole song. `version` is the file-format version. */
export interface Song {
  version: 1;
  title: string;
  /** Tonic pitch class, 0..11. */
  tonic: number;
  mode: Mode;
  bpm: number;
  bars: number;
  chords: ChordEvent[];
  notes: NoteEvent[];
  /** One syllable per melody note, in time order. */
  lyrics: string;
}

/** Seconds per grid step at a tempo. */
export const stepSeconds = (bpm: number) => 60 / bpm / STEPS_PER_BEAT;

const overlaps = (a: { start: number; len: number }, b: { start: number; len: number }) =>
  a.start < b.start + b.len && b.start < a.start + a.len;

/**
 * Add or move a note, keeping the melody to one voice: anything the note
 * overlaps is removed. Lyrics map onto notes in time order, so overlap would
 * make the mapping ambiguous.
 */
export function placeNote(notes: NoteEvent[], note: NoteEvent): NoteEvent[] {
  return [...notes.filter((n) => n.id !== note.id && !overlaps(n, note)), note]
    .sort((a, b) => a.start - b.start);
}

/** Add or move a chord, replacing whatever it overlaps. */
export function placeChord(chords: ChordEvent[], chord: ChordEvent): ChordEvent[] {
  return [...chords.filter((c) => c.id !== chord.id && !overlaps(c, chord)), chord]
    .sort((a, b) => a.start - b.start);
}

/** The chord sounding at a step, if any. */
export function chordAt(chords: ChordEvent[], step: number): ChordEvent | undefined {
  return chords.find((c) => step >= c.start && step < c.start + c.len);
}

/** Notes in time order. */
export function sortedNotes(notes: NoteEvent[]): NoteEvent[] {
  return [...notes].sort((a, b) => a.start - b.start);
}

/** Trim chords and notes that run past the last bar. */
export function clampToBars(song: Song): Song {
  const end = song.bars * STEPS_PER_BAR;
  const fit = <T extends { start: number; len: number }>(items: T[]) =>
    items.filter((i) => i.start < end).map((i) => ({ ...i, len: Math.min(i.len, end - i.start) }));
  return { ...song, chords: fit(song.chords), notes: fit(song.notes) };
}

/** Structural check for a parsed song file. */
export function isSong(value: unknown): value is Song {
  const s = value as Song;
  return !!s && s.version === 1 && Array.isArray(s.chords) && Array.isArray(s.notes)
    && typeof s.tonic === "number" && (s.mode === "major" || s.mode === "minor");
}
