// Build a song from Roman numerals and scale degrees, then write a MIDI file.
//
//   node examples/03-export-midi.mjs [out.mid]

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STEPS_PER_BAR, keyName, parseRoman, songToMidi } from "moodence";

const mode = "minor";
const chords = ["i", "VI", "III", "V7"].map((text, bar) => ({
  id: `c${bar}`, ...parseRoman(text, mode), start: bar * STEPS_PER_BAR, len: STEPS_PER_BAR,
}));
const notes = [5, 4, 3, 2, 3, 1, 7].map((deg, i) => ({
  id: `n${i}`, deg, oct: deg === 7 ? -1 : 0, acc: deg === 7 ? 1 : 0, start: i * 8, len: 8,
}));

const song = { version: 1, title: "example", tonic: 9, mode, bpm: 90, bars: 4, chords, notes, lyrics: "" };
const out = process.argv[2] ?? join(tmpdir(), "moodence-example.mid");
writeFileSync(out, songToMidi(song));
console.log(`${keyName(song.tonic, mode)}, ${chords.length} chords, ${notes.length} notes -> ${out}`);
