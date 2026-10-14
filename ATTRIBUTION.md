# Attribution

## Cantonese tone model

`packages/moodence/src/vendor/cantojam/` is copied from
[cantojam](https://github.com/candpixie/cantojam) (MIT), commit b33fe77.

Its `data.js` is derived from:

> Jason Lee, *A Corpus of Cantonese Popular Music, 2000-2020*.
> https://github.com/jasonleeubc/Cantopop-corpus. CC BY 4.0.

That file is redistributed under CC BY 4.0, not MIT. Attribution is the only
requirement. The `COLLOQUIAL` table inside it was written for cantojam and is MIT.

## Chordonomicon

`examples/04-chordonomicon.mjs` reads
[Chordonomicon](https://huggingface.co/datasets/ailsntua/Chordonomicon)
(CC BY-NC 4.0) if you download it. None of its data is in this repository, and
statistics you derive from it are non-commercial.

## Piano samples

The editor streams the Salamander Grand Piano samples (Alexander Holm, CC BY 3.0)
from the Tone.js CDN at runtime. No sample files are stored in this repository.

## Libraries

[Tone.js](https://github.com/Tonejs/Tone.js) and
[@tonejs/midi](https://github.com/Tonejs/Midi) (MIT, the latter bundled into the
library build), React (MIT), TypeDoc (Apache-2.0, docs only).
