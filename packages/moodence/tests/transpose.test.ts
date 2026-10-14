import { describe, expect, it } from "vitest";
import {
  capoShapes, noteMidi, shapeTonic, soundingChords, transpose, transposeProgression, type Song,
} from "../src";

const song: Song = {
  version: 1, title: "t", tonic: 0, mode: "major", bpm: 100, bars: 1, chords: [], lyrics: "",
  notes: [{ id: "a", deg: 1, oct: 0, acc: 0, start: 0, len: 4 }, { id: "b", deg: 5, oct: 0, acc: 0, start: 4, len: 4 }],
};
const pitches = (s: Song) => s.notes.map((n) => noteMidi(s, n));

describe("transpose(song)", () => {
  it("moves every note by exactly the interval, through the tonic wrap", () => {
    let s = song;
    for (let i = 1; i <= 14; i++) {
      s = transpose(s, 1);
      expect(pitches(s)).toEqual(pitches(song).map((p) => p + i));
    }
    expect(s.tonic).toBe(2);
    expect(s.octave).toBe(1);
  });
  it("goes down as cleanly as up", () => {
    const down = transpose(song, -5);
    expect(down.tonic).toBe(7);
    expect(pitches(down)).toEqual([55, 62]);
    expect(pitches(transpose(down, 5))).toEqual(pitches(song));
  });
});

describe("transposeProgression", () => {
  it("re-spells in the new key", () => {
    expect(transposeProgression("Am D G Em", 2)).toBe("Bm E A F♯m");
    expect(transposeProgression("C G Am F", 3)).toBe("E♭ B♭ Cm A♭");
    expect(transposeProgression("C G Am F", -1)).toBe("B F♯ G♯m E");
  });
  it("keeps borrowed chords and slash basses", () => {
    expect(transposeProgression("C Ab Bb C", 2)).toBe("D B♭ C D");
    expect(transposeProgression("C G/B Am", 2)).toBe("D A/C♯ Bm");
  });
  it("leaves what it cannot parse", () => {
    expect(transposeProgression("C G5 Am", 2)).toBe("D G5 Bm");
  });
});

describe("capo", () => {
  it("round-trips Follow You's shapes and sound", () => {
    expect(soundingChords("Am D G Em", 2)).toBe("Bm E A F♯m");
    expect(capoShapes("Bm E A F#m", 2)).toBe("Am D G Em");
    expect(shapeTonic(11, 2)).toBe(9);
  });
});
