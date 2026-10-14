import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { clampToBars, demoSong, placeNote, type NoteEvent } from "../src/song";
import { analyzeLyrics, syllableTexts } from "../src/lyrics";
import { songToMidi } from "../src/midi";

const note = (id: string, start: number, len: number): NoteEvent => ({ id, deg: 1, oct: 0, acc: 0, start, len });

describe("melody editing", () => {
  it("keeps the melody to one voice", () => {
    const notes = placeNote([note("a", 0, 4), note("b", 4, 4)], note("c", 2, 4));
    expect(notes.map((n) => n.id)).toEqual(["c"]);
  });
  it("trims notes when bars are removed", () => {
    const song = { ...demoSong(), bars: 2 };
    const clamped = clampToBars(song);
    expect(clamped.notes.every((n) => n.start + n.len <= 32)).toBe(true);
    expect(clamped.chords).toHaveLength(2);
  });
});

describe("lyrics and tones", () => {
  it("starts the demo with no tone clashes", () => {
    const report = analyzeLyrics(demoSong(), true);
    expect(report.hasCantonese).toBe(true);
    expect(report.syllables).toBe(report.notes);
    expect(report.violations).toHaveLength(0);
  });
  it("flags a melody that fights the tones", () => {
    // 慢慢 then 行 (tone 6 then 4): the corpus falls. Make 行 jump up instead.
    const song = demoSong();
    const notes = song.notes.map((n, i) => (i === 6 ? { ...n, deg: 5, oct: 1 } : n));
    const report = analyzeLyrics({ ...song, notes }, true);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.byNote.get(notes[6].id)?.status).toBe("violation");
  });
  it("skips the check when the lyric has no Cantonese", () => {
    const report = analyzeLyrics({ ...demoSong(), lyrics: "la la la" }, true);
    expect(report.hasCantonese).toBe(false);
    expect(report.violations).toHaveLength(0);
  });
});

describe("midi export", () => {
  it("writes melody and chord tracks that read back", () => {
    const song = demoSong();
    const midi = new Midi(songToMidi(song, syllableTexts(song)));
    expect(midi.tracks.map((t) => t.name)).toEqual(["Melody", "Chords"]);
    expect(midi.tracks[0].notes).toHaveLength(song.notes.length);
    expect(midi.tracks[1].notes).toHaveLength(song.chords.length * 3);
    expect(midi.tracks[0].notes[0].midi).toBe(67); // G4, degree 5 in C
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(song.bpm);
  });
});
