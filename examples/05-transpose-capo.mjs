// Transpose a chord sheet, and convert between capo shapes and real pitch.
//
//   node examples/05-transpose-capo.mjs

import { capoShapes, soundingChords, transposeProgression } from "moodence";

const shapes = "Am D G Em";
console.log(`shapes ${shapes} with capo 2 sound as  ${soundingChords(shapes, 2)}`);
console.log(`to play Bm E A F#m with capo 2, use     ${capoShapes("Bm E A F#m", 2)}`);

for (const n of [-2, -1, 1, 3, 5]) {
  console.log(`C G Am F ${n > 0 ? "+" : ""}${n}`.padEnd(14), transposeProgression("C G Am F", n));
}
