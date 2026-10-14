import { check, syllabify, type CheckRow } from "./vendor/cantojam/cantojam.js";
import { degreeMidi } from "./theory";
import { sortedNotes, type Song } from "./song";

export interface NoteLyric {
  text: string;
  jyutping: string | null;
  tone: string | null;
  status: "ok" | "violation" | "unusual" | "none";
  message?: string;
}

export interface LyricReport {
  byNote: Map<string, NoteLyric>; // note id -> syllable
  syllables: number;
  notes: number;
  violations: CheckRow[];
  unusual: CheckRow[];
  hasCantonese: boolean;
}

/* Syllables land on melody notes in time order, one each. The tone check is
   cantojam's: it compares each step of the melody against which way the
   Cantopop corpus moves between those two lyric tones. */
export function analyzeLyrics(song: Song, toneCheck: boolean): LyricReport {
  const notes = sortedNotes(song.notes);
  const sung = syllabify(song.lyrics).filter((s) => !s.skipped);
  const hasCantonese = sung.some((s) => s.tone !== null);
  const midis = notes.map((n) => degreeMidi(n, song.mode, song.tonic));
  const result = toneCheck && hasCantonese ? check(song.lyrics, midis) : null;

  const byNote = new Map<string, NoteLyric>();
  notes.forEach((note, i) => {
    const syllable = sung[i];
    if (!syllable) return;
    const row = result?.rows[i];
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
    violations: result?.violations ?? [],
    unusual: result?.unusual ?? [],
    hasCantonese,
  };
}

export function syllableTexts(song: Song): string[] {
  return syllabify(song.lyrics).filter((s) => !s.skipped).map((s) => s.char);
}
