# Moodence

<!-- Candy: description / pitch goes here. -->

## Run it

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm test
pnpm build
```

## What works in v0.1

- Melody and chords stored as scale degrees. Changing the key transposes everything.
- Chord palette per key: diatonic, borrowed from the parallel mode, secondary dominants, sus/7th colors.
- Chord names spelled by letter (♭VI in C is A♭, not G♯).
- Degree colors: 1, 3, 5 warm, 2, 4, 6, 7 cool. Borrowed chords are hatched.
- Melody guides: rows that are chord tones are tinted under each chord.
- Lyrics: one syllable per note in time order. Cantonese lines are checked against the melody with cantojam's tone model.
- Playback (sampled piano, synth fallback offline), undo/redo, MIDI export with lyric events, save/open `.json`, autosave in the browser.

## Not built yet

- Next-chord suggestions from progression data
- Mood labels
- Cantopop chord data (the Cantopop corpus has melody, lyrics and jyutping, no chords)
- Web MIDI keyboard input
- Mandarin tone mode

## Data rule for contributions

Chord progressions, melodies and jyutping/tone numbers are welcome. Full lyric
text of commercial songs is not stored in this repo.

## License

Code: MIT. `src/vendor/cantojam/data.js`: CC BY 4.0. See [ATTRIBUTION.md](ATTRIBUTION.md).
