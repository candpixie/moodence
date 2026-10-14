import { describe, expect, it } from "vitest";
import {
  chordMidi, chordSymbol, degreeMidi, diatonicQuality, isBorrowed, keyName, palette, romanLabel,
  type ChordSpec,
} from "../src";

const d = (deg: number, seventh = false): ChordSpec => ({ deg, acc: 0, quality: null, seventh });

describe("diatonic chords", () => {
  it("gives the major-key qualities", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => diatonicQuality("major", n, false)))
      .toEqual(["maj", "min", "min", "maj", "maj", "min", "dim"]);
  });
  it("gives the natural-minor qualities", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => diatonicQuality("minor", n, false)))
      .toEqual(["min", "dim", "maj", "min", "min", "maj", "maj"]);
  });
  it("stacks sevenths", () => {
    expect([1, 2, 5, 7].map((n) => diatonicQuality("major", n, true)))
      .toEqual(["maj7", "min7", "dom7", "hdim7"]);
  });
  it("labels Roman numerals by quality", () => {
    expect([1, 2, 5, 7].map((n) => romanLabel(d(n), "major"))).toEqual(["I", "ii", "V", "vii°"]);
    expect(romanLabel(d(5, true), "major")).toBe("V7");
    expect(romanLabel(d(1), "minor")).toBe("i");
  });
});

describe("keys", () => {
  it("names chords with the key's spelling", () => {
    expect(chordSymbol(d(4), "major", 5)).toBe("B♭"); // IV in F
    expect(chordSymbol(d(5), "major", 7)).toBe("D"); // V in G
    expect(chordSymbol(d(6), "major", 0)).toBe("Am");
    expect(keyName(3, "major")).toBe("E♭ major");
  });
  it("transposes by changing only the tonic", () => {
    const c = chordMidi(d(1), "major", 0);
    const g = chordMidi(d(1), "major", 7);
    expect(g.map((m, i) => m - c[i])).toEqual([7, 7, 7]);
  });
  it("puts the melody tonic near middle C", () => {
    expect(degreeMidi({ deg: 1, oct: 0, acc: 0 }, "major", 0)).toBe(60);
    expect(degreeMidi({ deg: 1, oct: 0, acc: 0 }, "major", 9)).toBe(57); // A3, not A4
    expect(degreeMidi({ deg: 3, oct: 0, acc: 0 }, "minor", 0)).toBe(63);
  });
});

describe("borrowed chords", () => {
  it("builds bVI and bVII in major", () => {
    const flat6: ChordSpec = { deg: 6, acc: -1, quality: "maj", seventh: false };
    expect(chordSymbol(flat6, "major", 0)).toBe("A♭");
    expect(romanLabel(flat6, "major")).toBe("♭VI");
    expect(isBorrowed(flat6, "major")).toBe(true);
  });
  it("does not flag a diatonic chord that has an explicit quality", () => {
    expect(isBorrowed({ deg: 2, acc: 0, quality: "min7", seventh: false }, "major")).toBe(false);
    expect(isBorrowed({ deg: 5, acc: 0, quality: "maj", seventh: false }, "minor")).toBe(true);
  });
  it("offers chords that all resolve to real symbols", () => {
    for (const mode of ["major", "minor"] as const) {
      for (const group of palette(mode, true)) {
        for (const spec of group.chords) expect(chordSymbol(spec, mode, 2)).toMatch(/^[A-G]/);
      }
    }
  });
});

describe("spelling", () => {
  it("spells every degree with its own letter", () => {
    const names = [1, 2, 3, 4, 5, 6, 7].map((deg) => chordSymbol({ deg, acc: 0, quality: "maj", seventh: false }, "major", 6));
    expect(names.map((n) => n[0])).toEqual(["G", "A", "B", "C", "D", "E", "F"]); // G♭ major
    expect(names[0]).toBe("G♭");
    expect(names[3]).toBe("C♭");
  });
  it("spells minor-key borrowed chords", () => {
    expect(chordSymbol({ deg: 2, acc: -1, quality: "maj", seventh: false }, "minor", 9)).toBe("B♭"); // Neapolitan in A minor
    expect(chordSymbol({ deg: 7, acc: 1, quality: "dim7", seventh: false }, "minor", 9)).toBe("G♯dim7");
  });
});
