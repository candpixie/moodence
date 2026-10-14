import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import {
  STEPS_PER_BAR, alignLyrics, applyLyricFix, checkTones, clampToBars, isSong, placeNote, songToMidi,
  fixReadings, suggestLyricFixes, syllabify,
  type NoteEvent, type Song,
} from "../src";

const note = (id: string, deg: number, oct: number, start: number, len = 4): NoteEvent =>
  ({ id, deg, oct, acc: 0, start, len });

// 慢慢行: tone 6, 6, 4. The corpus holds 6->6 and falls 6->4.
const song = (notes: NoteEvent[]): Song => ({
  version: 1, title: "test", tonic: 0, mode: "major", bpm: 100, bars: 1,
  chords: [{ id: "c", deg: 1, acc: 0, quality: null, seventh: false, start: 0, len: STEPS_PER_BAR }],
  notes, lyrics: "慢慢行",
});

describe("song editing", () => {
  it("keeps the melody to one voice", () => {
    const notes = placeNote([note("a", 1, 0, 0), note("b", 1, 0, 4)], note("c", 1, 0, 2));
    expect(notes.map((n) => n.id)).toEqual(["c"]);
  });
  it("trims to the bar count", () => {
    const s = clampToBars({ ...song([note("a", 1, 0, 0), note("b", 1, 0, 14, 8), note("c", 1, 0, 20)]), bars: 1 });
    expect(s.notes.map((n) => [n.id, n.len])).toEqual([["a", 4], ["b", 2]]);
  });
  it("recognises song files", () => {
    expect(isSong(song([]))).toBe(true);
    expect(isSong({ version: 2 })).toBe(false);
  });
});

describe("tones", () => {
  it("reads jyutping and tone", () => {
    expect(syllabify("我哋").map((s) => s.jyutping)).toEqual(["ngo5", "dei6"]);
  });
  it("passes a melody that follows the tones", () => {
    expect(checkTones("慢慢行", [62, 62, 59]).violations).toHaveLength(0);
  });
  it("flags a melody that fights them", () => {
    const r = checkTones("慢慢行", [62, 62, 67]);
    expect(r.violations.map((v) => v.char)).toEqual(["行"]);
  });
  it("aligns syllables to notes in time order", () => {
    const a = alignLyrics(song([note("z", 7, -1, 8), note("x", 2, 0, 0), note("y", 2, 0, 4)]));
    expect(a.byNote.get("x")?.text).toBe("慢");
    expect(a.byNote.get("z")?.text).toBe("行");
    expect(a.violations).toHaveLength(0);
  });
  it("honours pinned readings", () => {
    // 行 is hang4 by default. Pinned to hang6 (tone 6 to 6 holds), a flat melody is fine.
    const flat = song([note("x", 2, 0, 0), note("y", 2, 0, 4), note("z", 2, 0, 8)]);
    expect(alignLyrics(flat).violations).toHaveLength(1);
    expect(alignLyrics({ ...flat, readings: { 行: "hang6" } }).violations).toHaveLength(0);
  });
  it("does not check non-Cantonese lyrics", () => {
    const a = alignLyrics({ ...song([note("x", 1, 0, 0)]), lyrics: "la" });
    expect(a.hasCantonese).toBe(false);
  });
});

describe("songToMidi", () => {
  it("writes melody and chord tracks that read back", () => {
    const s = song([note("x", 2, 0, 0), note("y", 2, 0, 4), note("z", 7, -1, 8)]);
    const midi = new Midi(songToMidi(s));
    expect(midi.tracks.map((t) => t.name)).toEqual(["Melody", "Chords"]);
    expect(midi.tracks[0].notes.map((n) => n.midi)).toEqual([62, 62, 59]);
    expect(midi.tracks[1].notes).toHaveLength(3);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(100);
  });
});

describe("lyric fixes", () => {
  it("suggests corpus words that fit the clash, and they really fit", async () => {
    const melody = [62, 62, 67];
    const [problem] = await suggestLyricFixes("慢慢行", melody);
    expect(problem.kind).toBe("violation");
    expect(problem.phrases.length).toBeGreaterThan(0);
    for (const fix of [...problem.phrases, ...problem.singles]) {
      const fixed = applyLyricFix("慢慢行", fix);
      // A pin like "一=jat6" means: sing that character with that reading.
      expect(checkTones(fixed, melody, fixReadings(fix)).violations).toHaveLength(0);
    }
  });
  it("keeps spaces and punctuation when applying a fix", () => {
    expect(applyLyricFix("慢慢，行 啦", { start: 1, length: 2, word: "路燈" })).toBe("慢路，燈 啦");
    expect(applyLyricFix("慢慢行", { start: 2, length: 1, word: "等" })).toBe("慢慢等");
  });
  it("never suggests a fix that joins two lyric lines", async () => {
    // 行 ends line one and clashes. Fixes may change 慢行 or 行, never 行抬.
    const problems = await suggestLyricFixes("慢慢行 抬頭", [62, 62, 67, 57, 57]);
    const all = problems.flatMap((p) => [...p.phrases, ...p.singles]);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((f) => !f.replaces.includes("抬"))).toBe(true);
  });
  it("ignores fixes that do not fit the line", () => {
    expect(applyLyricFix("慢慢行", { start: 2, length: 2, word: "路燈" })).toBe("慢慢行");
  });
});
