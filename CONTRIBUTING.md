# Contributing

## Setup

```sh
pnpm install
pnpm dev        # editor at http://localhost:4391
pnpm test       # library and editor tests
pnpm examples   # every script in examples/
```

## Layout

- `packages/moodence/`: the library. Anything musical goes here, with tests.
- `app/`: the editor. UI, playback and browser storage only.
- `examples/`: runnable scripts. CI runs all of them, so they cannot go stale.

## Before a pull request

- `pnpm test` and `node examples/run-all.mjs` pass.
- New library functions have a doc comment with an `@example`.
- A parser that cannot read something returns `null`. It does not guess.
- `src/vendor/cantojam/` is copied from cantojam. Change it there, then copy it back.

## Data

- Chords, melodies and jyutping or tone numbers are welcome.
- Do not add full lyric text of commercial songs.
- Do not add files from non-commercial datasets (Chordonomicon is CC BY-NC). Write code that reads them instead.
- Say where every number came from.
