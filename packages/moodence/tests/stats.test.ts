import { describe, expect, it } from "vitest";
import { countTransitions, estimateKey, nextChords, romanize } from "../src";

describe("romanize", () => {
  it("marks chords it cannot parse", () => {
    const out = romanize("C G5 Am", 0, "major");
    expect(out.map((c) => c.roman)).toEqual(["I", null, "vi"]);
  });
});

describe("countTransitions", () => {
  it("pools keys once romanized", () => {
    const songs = [romanize("C G Am F", 0, "major"), romanize("G D Em C", 7, "major")];
    const t = countTransitions(songs.map((s) => s.map((c) => c.roman)));
    expect(t.counts.get("I")?.get("V")).toBe(2);
    expect(t.total).toBe(6);
  });
  it("collapses repeats and breaks chains at unparsed chords", () => {
    const t = countTransitions([["I", "I", "V", null, "vi", "IV"]]);
    expect(t.counts.get("I")?.get("V")).toBe(1);
    expect(t.counts.get("V")).toBeUndefined();
    expect(t.skipped).toBe(1);
    expect(t.total).toBe(2);
  });
});

describe("nextChords", () => {
  it("ranks by count with probabilities that sum to 1", () => {
    const t = countTransitions([["I", "V", "vi"], ["I", "V", "vi"], ["I", "V", "IV"]]);
    const next = nextChords(t, "V");
    expect(next.map((n) => n.roman)).toEqual(["vi", "IV"]);
    expect(next.reduce((a, n) => a + n.probability, 0)).toBeCloseTo(1);
    expect(nextChords(t, "ii")).toEqual([]);
  });
});

describe("estimateKey", () => {
  const key = (p: string) => { const k = estimateKey(p)!; return [k.tonic, k.mode]; };
  it("finds major keys", () => {
    expect(key("C G Am F C")).toEqual([0, "major"]);
    expect(key("D A Bm G D")).toEqual([2, "major"]);
    expect(key("Eb Bb Cm Ab Eb")).toEqual([3, "major"]);
  });
  it("separates a minor key from its relative major", () => {
    expect(key("Am F C G Am")).toEqual([9, "minor"]);
    expect(key("Em C G D Em B7 Em")).toEqual([4, "minor"]);
  });
  it("hears Dorian only when the tonic chord is clearly home", () => {
    expect(key("Bm E A F#m Bm")).toEqual([11, "dorian"]);
    expect(key("Dm G Dm G Dm")).toEqual([2, "dorian"]);
    expect(key("Dm G C")).toEqual([0, "major"]); // ii V I stays major
    expect(key("Am F C G Am")).toEqual([9, "minor"]); // no major IV, stays minor
  });
  it("reports fit and ambiguity", () => {
    const k = estimateKey("C G Am F")!;
    expect(k.fit).toBe(1);
    expect(estimateKey("C Db D Eb")!.fit).toBeLessThan(k.fit);
    expect(estimateKey("C5 G5")).toBeNull();
  });
});
