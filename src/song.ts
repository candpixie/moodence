import type { ChordSpec, DegreePitch, Mode } from "./theory";

export const STEPS_PER_BEAT = 4; // sixteenth notes
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

export interface ChordEvent extends ChordSpec {
  id: string;
  start: number; // step
  len: number; // steps
}

export interface NoteEvent extends DegreePitch {
  id: string;
  start: number;
  len: number;
}

export interface Song {
  version: 1;
  title: string;
  tonic: number; // pitch class 0..11
  mode: Mode;
  bpm: number;
  bars: number;
  chords: ChordEvent[];
  notes: NoteEvent[];
  lyrics: string;
}

let counter = 0;
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const overlaps = (a: { start: number; len: number }, b: { start: number; len: number }) =>
  a.start < b.start + b.len && b.start < a.start + a.len;

/* Melody is one voice: lyrics map onto notes in time order, so a new note
   replaces whatever it overlaps. */
export function placeNote(notes: NoteEvent[], note: NoteEvent): NoteEvent[] {
  return [...notes.filter((n) => n.id !== note.id && !overlaps(n, note)), note]
    .sort((a, b) => a.start - b.start);
}

export function placeChord(chords: ChordEvent[], chord: ChordEvent): ChordEvent[] {
  return [...chords.filter((c) => c.id !== chord.id && !overlaps(c, chord)), chord]
    .sort((a, b) => a.start - b.start);
}

export function chordAt(chords: ChordEvent[], step: number): ChordEvent | undefined {
  return chords.find((c) => step >= c.start && step < c.start + c.len);
}

export function sortedNotes(notes: NoteEvent[]): NoteEvent[] {
  return [...notes].sort((a, b) => a.start - b.start);
}

/* Trim anything that runs past the last bar, after the song gets shorter. */
export function clampToBars(song: Song): Song {
  const end = song.bars * STEPS_PER_BAR;
  const fit = <T extends { start: number; len: number }>(items: T[]) =>
    items.filter((i) => i.start < end).map((i) => ({ ...i, len: Math.min(i.len, end - i.start) }));
  return { ...song, chords: fit(song.chords), notes: fit(song.notes) };
}

const n = (deg: number, oct: number, start: number, len: number): NoteEvent =>
  ({ id: newId(), deg, oct, acc: 0, start, len });
const ch = (deg: number, start: number): ChordEvent =>
  ({ id: newId(), deg, acc: 0, quality: null, seventh: false, start, len: STEPS_PER_BAR });

/* The starter song. The lyric is neutral filler written for this demo, and
   the melody was checked against the tone model so it starts clean. */
export function demoSong(): Song {
  return {
    version: 1,
    title: "Untitled sketch",
    tonic: 0,
    mode: "major",
    bpm: 84,
    bars: 4,
    chords: [ch(1, 0), ch(5, 16), ch(6, 32), ch(4, 48)],
    notes: [
      n(5, 0, 0, 4), n(3, 0, 4, 2), n(3, 0, 6, 2), n(2, 0, 8, 4), n(2, 0, 12, 2), n(2, 0, 14, 2),
      n(7, -1, 16, 12),
      n(6, -1, 34, 2), n(6, -1, 36, 4), n(3, 0, 40, 4), n(3, 0, 44, 4),
      n(6, 0, 48, 12),
    ],
    lyrics: "今晚我哋慢慢行 抬頭睇下星",
  };
}

export function emptySong(): Song {
  return { ...demoSong(), chords: [], notes: [], lyrics: "" };
}

const STORAGE_KEY = "moodence.song.v1";

export function isSong(value: unknown): value is Song {
  const s = value as Song;
  return !!s && s.version === 1 && Array.isArray(s.chords) && Array.isArray(s.notes)
    && typeof s.tonic === "number" && (s.mode === "major" || s.mode === "minor");
}

export function loadStored(): Song | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSong(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function store(song: Song): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
  } catch {
    // Private windows and full storage: the song still works, it just won't persist.
  }
}
