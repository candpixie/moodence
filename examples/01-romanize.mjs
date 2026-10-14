// Turn chord symbols into Roman numerals, guessing the key first.
//
//   node examples/01-romanize.mjs "Am F C G"

import { estimateKey, keyName, romanize } from "moodence";

const progressions = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["C G Am F", "Am F C G Am", "D A Bm G", "Eb Bb Cm Ab", "C Ab Bb C", "Em C G D B7 Em"];

for (const progression of progressions) {
  const key = estimateKey(progression);
  if (!key) {
    console.log(`${progression.padEnd(22)} (no chords parsed)`);
    continue;
  }
  const romans = romanize(progression, key.tonic, key.mode).map((c) => c.roman ?? "?");
  console.log(
    `${progression.padEnd(22)} ${keyName(key.tonic, key.mode).padEnd(10)} ${romans.join(" ").padEnd(22)}`
    + ` fit ${key.fit.toFixed(2)}  margin ${key.margin.toFixed(2)}`,
  );
}
