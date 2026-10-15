import { describe, expect, it } from "vitest";
import { STARTERS, chordFeel, commonNext, palette, romanLabel, type ChordSpec, type Mode } from "../src";

const d = (deg: number): ChordSpec => ({ deg, acc: 0, quality: null, seventh: false });

describe("chordFeel", () => {
  it("names the major-key chords", () => {
    expect([1, 4, 5, 6].map((n) => chordFeel(d(n), "major"))).toEqual(["home", "lifting", "wants home", "sad home"]);
  });
  it("names borrowed and secondary chords", () => {
    expect(chordFeel({ deg: 6, acc: -1, quality: "maj", seventh: false }, "major")).toBe("epic");
    expect(chordFeel({ deg: 2, acc: 0, quality: "dom7", seventh: false, label: "V7/V" }, "major")).toBe("leads to V");
  });
  it("uses mode-specific words", () => {
    expect(chordFeel(d(4), "dorian")).toBe("bright lift");
    expect(chordFeel({ deg: 1, acc: 0, quality: "maj", seventh: false }, "minor")).toBe("bright ending");
  });
  it("has a word for every palette chord", () => {
    for (const mode of ["major", "minor", "dorian"] as Mode[]) {
      for (const seventh of [false, true]) {
        for (const g of palette(mode, seventh)) {
          for (const c of g.chords) expect(chordFeel(c, mode), `${mode} ${romanLabel(c, mode)}`).not.toBe("color");
        }
      }
    }
  });
});

describe("commonNext", () => {
  it("knows the strong moves", () => {
    expect(commonNext(d(5), d(1), "major")).toBe(true);
    expect(commonNext(d(5), d(6), "major")).toBe(true);
    expect(commonNext(d(6), d(4), "major")).toBe(true);
    expect(commonNext(d(5), d(3), "major")).toBe(false);
  });
  it("never suggests the same chord again", () => {
    expect(commonNext(d(4), d(4), "major")).toBe(false);
    expect(commonNext(d(4), { deg: 4, acc: 0, quality: "min", seventh: false }, "major")).toBe(true);
  });
  it("resolves secondary dominants to their target", () => {
    const v7ofV: ChordSpec = { deg: 2, acc: 0, quality: "dom7", seventh: false, label: "V7/V" };
    expect(commonNext(v7ofV, d(5), "major")).toBe(true);
    expect(commonNext(v7ofV, d(1), "major")).toBe(false);
  });
});

describe("STARTERS", () => {
  it("has starters for every mode", () => {
    for (const mode of ["major", "minor", "dorian"]) expect(STARTERS.some((s) => s.mode === mode)).toBe(true);
  });
});
