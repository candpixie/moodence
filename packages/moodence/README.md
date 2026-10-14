# moodence

<!-- Candy: one-line description goes here. -->

```sh
npm install moodence
```

```js
import { estimateKey, romanize, checkTones } from "moodence";

const key = estimateKey("Am F C G");                   // { tonic: 9, mode: "minor", fit: 1, ... }
romanize("Am F C G", key.tonic, key.mode)              // i VI III VII
  .map((c) => c.roman);
checkTones("慢慢行", [62, 62, 67]).violations;          // 行 should fall, the melody rises
```

| Module | What it does |
|---|---|
| `theory` | Scale degrees, chord qualities, Roman labels, letter-correct chord spelling, MIDI voicing |
| `parse` | Chord symbols and Roman numerals (incl. secondary dominants) to key-relative chords |
| `stats` | Key estimation, romanizing progressions, chord-transition counts, next-chord ranking |
| `song` | The song model used by the Moodence editor (plain JSON) |
| `tones` | Cantonese syllables and jyutping, a melody-vs-lyric-tone check, and corpus words that fit a clash (from cantojam) |
| `midi` | Standard MIDI file export with lyric events |

Full API reference: https://candpixie.github.io/moodence/docs/

License: MIT. The bundled Cantonese tone data is CC BY 4.0, see `DATA_LICENSE.md`.
