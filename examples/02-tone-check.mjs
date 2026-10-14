// Check a melody against the tones of a Cantonese lyric.
//
//   node examples/02-tone-check.mjs

import { TONE_NAMES, checkTones, syllabify } from "moodence";

const lyric = "今晚我哋慢慢行";
const syllables = syllabify(lyric);
console.log(syllables.map((s) => `${s.char} ${s.jyutping} (${TONE_NAMES[s.tone]})`).join("\n"));

const follows = [67, 64, 64, 62, 62, 62, 59]; // G E E D D D B
const fights = [67, 64, 64, 62, 62, 62, 69]; // ...and 行 jumps up instead of falling

for (const [name, melody] of [["follows the tones", follows], ["fights the tones", fights]]) {
  const report = checkTones(lyric, melody);
  console.log(`\n${name}: ${report.violations.length} violations, ${report.unusual.length} unusual`);
  for (const row of [...report.violations, ...report.unusual]) console.log(`  ${row.message}`);
}
