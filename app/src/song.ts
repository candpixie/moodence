import { STEPS_PER_BAR, isSong, type ChordEvent, type DegreePitch, type NoteEvent, type Song } from "moodence";

// Editor-only state: the starter song, ids, browser storage, grid rows. The
// music model itself lives in the moodence package.

let counter = 0;
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Grid rows, top to bottom: 5 up to 5 down around the tonic octave. */
export const ROWS: DegreePitch[] = [
  ...[5, 4, 3, 2, 1].map((deg) => ({ deg, oct: 1, acc: 0 })),
  ...[7, 6, 5, 4, 3, 2, 1].map((deg) => ({ deg, oct: 0, acc: 0 })),
  ...[7, 6, 5].map((deg) => ({ deg, oct: -1, acc: 0 })),
];

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
