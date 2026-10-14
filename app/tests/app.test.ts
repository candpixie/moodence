import { describe, expect, it } from "vitest";
import { alignLyrics, degreeMidi } from "moodence";
import { ROWS, demoSong } from "../src/song";

describe("starter song", () => {
  it("starts with no tone clashes and one syllable per note", () => {
    const report = alignLyrics(demoSong());
    expect(report.hasCantonese).toBe(true);
    expect(report.syllables).toBe(report.notes);
    expect(report.violations).toHaveLength(0);
  });
  it("only uses notes the grid can show", () => {
    for (const note of demoSong().notes) {
      expect(ROWS.some((r) => r.deg === note.deg && r.oct === note.oct)).toBe(true);
    }
  });
});

describe("grid rows", () => {
  it("run strictly downward in pitch", () => {
    const pitches = ROWS.map((r) => degreeMidi(r, "major", 0));
    pitches.slice(1).forEach((p, i) => expect(p).toBeLessThan(pitches[i]));
  });
});
