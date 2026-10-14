import { describe, expect, it } from "vitest";
import { chordSymbol, parseChordSymbol, parseRoman, romanFromSymbol, romanLabel, splitProgression } from "../src";

describe("parseChordSymbol", () => {
  it.each([
    ["C", 0, "maj"], ["Am", 9, "min"], ["F#m7b5", 6, "hdim7"], ["Bbmaj7", 10, "maj7"],
    ["G7", 7, "dom7"], ["Ebdim7", 3, "dim7"], ["Dsus4", 2, "sus4"], ["Caug", 0, "aug"],
    ["Cm9", 0, "min7"], ["G13", 7, "dom7"], ["Fadd9", 5, "maj"], ["A♭", 8, "maj"],
  ])("%s", (symbol, root, quality) => {
    expect(parseChordSymbol(symbol)).toMatchObject({ root, quality });
  });
  it("keeps the slash bass", () => {
    expect(parseChordSymbol("C/E")).toMatchObject({ root: 0, bass: 4 });
  });
  it("returns null instead of guessing", () => {
    for (const s of ["C5", "Csus2", "G7#9", "H", "", "xyz"]) expect(parseChordSymbol(s)).toBeNull();
  });
});

describe("romanFromSymbol", () => {
  const roman = (s: string, tonic: number, mode: "major" | "minor") => {
    const spec = romanFromSymbol(s, tonic, mode);
    return spec && romanLabel(spec, mode);
  };
  it("labels a pop progression", () => {
    expect(["C", "G", "Am", "F"].map((s) => roman(s, 0, "major"))).toEqual(["I", "V", "vi", "IV"]);
  });
  it("uses the letter to pick the degree", () => {
    expect(roman("Ab", 0, "major")).toBe("♭VI");
    expect(roman("G#", 0, "major")).toBe("♯V");
    expect(roman("Bb", 0, "major")).toBe("♭VII");
  });
  it("keeps diatonic sevenths diatonic", () => {
    const spec = romanFromSymbol("Dm7", 0, "major");
    expect(spec).toMatchObject({ deg: 2, quality: null, seventh: true });
  });
  it("works in minor and flat keys", () => {
    expect(["Am", "F", "C", "G", "E"].map((s) => roman(s, 9, "minor"))).toEqual(["i", "VI", "III", "VII", "V"]);
    expect(["Eb", "Bb", "Cm", "Ab"].map((s) => roman(s, 3, "major"))).toEqual(["I", "V", "vi", "IV"]);
  });
  it("round-trips with chordSymbol", () => {
    for (const s of ["C", "Dm", "E7", "Fmaj7", "Ab", "Bb", "Bdim"]) {
      const spec = romanFromSymbol(s, 0, "major")!;
      expect(chordSymbol(spec, "major", 0).replace("♭", "b")).toBe(s);
    }
  });
});

describe("parseRoman", () => {
  it("reads case, accidentals and suffixes", () => {
    expect(parseRoman("bVII", "major")).toMatchObject({ deg: 7, acc: -1, quality: "maj" });
    expect(parseRoman("iv", "major")).toMatchObject({ deg: 4, quality: "min" });
    expect(parseRoman("V7", "major")).toMatchObject({ deg: 5, quality: null, seventh: true });
    expect(parseRoman("viiø7", "major")).toMatchObject({ deg: 7, quality: null, seventh: true });
    expect(chordSymbol(parseRoman("vii°7", "minor")!, "minor", 9)).toBe("G♯dim7"); // raised leading tone
    expect(chordSymbol(parseRoman("VII", "minor")!, "minor", 9)).toBe("G");
  });
  it("builds secondary dominants on the target", () => {
    expect(chordSymbol(parseRoman("V7/V", "major")!, "major", 0)).toBe("D7");
    expect(chordSymbol(parseRoman("V7/vi", "major")!, "major", 0)).toBe("E7");
    expect(chordSymbol(parseRoman("V/IV", "major")!, "major", 7)).toBe("G");
    expect(chordSymbol(parseRoman("vii°7/V", "major")!, "major", 0)).toBe("F♯dim7");
  });
  it("rejects nonsense", () => {
    for (const s of ["", "VIII", "V9", "IV/x"]) expect(parseRoman(s, "major")).toBeNull();
  });
});

describe("splitProgression", () => {
  it("splits on spaces, bars and commas", () => {
    expect(splitProgression("C G | Am, F")).toEqual(["C", "G", "Am", "F"]);
  });
});
