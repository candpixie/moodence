import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type Selection } from "./components/Editor";
import { Palette } from "./components/Palette";
import { LyricFixes } from "./components/LyricFixes";
import { Music } from "./components/Music";
import { play, playheadStep, preview, stop } from "./audio";
import {
  CORPUS, STEPS_PER_BAR, TONE_NAMES, alignLyrics, chordAt, chordMidi, clampToBars, isSong, keyName,
  pitchName, placeChord, shapeTonic, songToMidi, transpose, type ChordSpec, type Mode, type Song,
} from "moodence";
import { demoSong, emptySong, loadStored, newId, store } from "./song";

const HISTORY_LIMIT = 200;

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileName = (song: Song) =>
  (song.title.trim() || "moodence").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "moodence";

export function App() {
  const [song, setSongState] = useState<Song>(() => loadStored() ?? demoSong());
  const past = useRef<Song[]>([]);
  const future = useRef<Song[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [sevenths, setSevenths] = useState(false);
  const [chordLen, setChordLen] = useState(STEPS_PER_BAR);
  const [guides, setGuides] = useState(true);
  const [toneCheck, setToneCheck] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const setSong = useCallback((next: Song) => {
    setSongState((prev) => {
      past.current = [...past.current.slice(-HISTORY_LIMIT), prev];
      future.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setSongState((prev) => {
      const last = past.current.pop();
      if (!last) return prev;
      future.current.push(prev);
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setSongState((prev) => {
      const next = future.current.pop();
      if (!next) return prev;
      past.current.push(prev);
      return next;
    });
  }, []);

  useEffect(() => store(song), [song]);
  const songRef = useRef(song);
  songRef.current = song;

  const lyrics = useMemo(() => alignLyrics(song, toneCheck), [song, toneCheck]);

  // ---- playback

  useEffect(() => {
    if (!playing) {
      setPlayhead(null);
      return;
    }
    let frame = 0;
    const tick = () => {
      setPlayhead(playheadStep(song.bpm));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, song.bpm]);

  const togglePlay = useCallback(async () => {
    if (playing) {
      stop();
      setPlaying(false);
    } else {
      await play(song);
      setPlaying(true);
    }
  }, [playing, song]);

  // Edits while playing restart the loop so you hear them.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (playingRef.current) void play(song);
  }, [song]);

  // ---- chords

  const pickChord = (spec: ChordSpec) => {
    const end = song.bars * STEPS_PER_BAR;
    const base = { deg: spec.deg, acc: spec.acc, quality: spec.quality, seventh: spec.seventh, ...(spec.label ? { label: spec.label } : {}) };
    void preview(chordMidi(spec, song.mode, song.tonic));

    if (selection?.kind === "chord") {
      const target = song.chords.find((c) => c.id === selection.id);
      if (target) {
        const { label: _old, ...rest } = target;
        setSong({ ...song, chords: placeChord(song.chords, { ...rest, ...base }) });
        return;
      }
    }
    let start: number | null = selection?.kind === "slot" ? selection.start : null;
    if (start === null) {
      for (let s = 0; s < end; s += STEPS_PER_BAR / 2) {
        if (!chordAt(song.chords, s)) { start = s; break; }
      }
    }
    if (start === null) return;
    const len = Math.min(chordLen, end - start);
    setSong({ ...song, chords: placeChord(song.chords, { id: newId(), start, len, ...base }) });
    const next = start + len;
    setSelection(next < end ? { kind: "slot", start: next } : null);
  };

  const deleteSelected = useCallback(() => {
    if (selection?.kind !== "chord") return;
    setSong({ ...song, chords: song.chords.filter((c) => c.id !== selection.id) });
    setSelection(null);
  }, [selection, song, setSong]);

  // ---- keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select");
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        deleteSelected();
      } else if (e.key === "[" || e.key === "]") {
        setSong(transpose(songRef.current, e.key === "]" ? 1 : -1));
      } else if (e.key === "Escape") {
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, undo, redo, deleteSelected]);

  // ---- files

  const openFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isSong(parsed)) throw new Error("not a Moodence song");
      setSong(parsed);
      setSelection(null);
      setFileError(null);
    } catch {
      setFileError(`${file.name} isn't a Moodence song file.`);
    }
  };

  const mismatch = lyrics.syllables > 0 && lyrics.syllables !== lyrics.notes;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Moodence</h1>
          <input
            className="title"
            value={song.title}
            aria-label="Song title"
            onChange={(e) => setSongState({ ...song, title: e.target.value })}
          />
          <div className="actions">
            <div className="group">
              <button type="button" onClick={undo} disabled={!past.current.length} title="Undo (⌘Z)">Undo</button>
              <button type="button" onClick={redo} disabled={!future.current.length} title="Redo (⇧⌘Z)">Redo</button>
            </div>
            <div className="group">
              <button type="button" onClick={() => download(`${fileName(song)}.mid`, songToMidi(song), "audio/midi")}>
                Export MIDI
              </button>
              <button type="button" onClick={() => download(`${fileName(song)}.json`, JSON.stringify(song, null, 2), "application/json")}>
                Save
              </button>
              <button type="button" onClick={() => fileInput.current?.click()}>Open</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ""; }} />
              <button type="button" onClick={() => { setSong(emptySong()); setSelection({ kind: "slot", start: 0 }); }}>New</button>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <button type="button" className={`play${playing ? " is-on" : ""}`} onClick={() => void togglePlay()} aria-label={playing ? "Stop" : "Play"}>
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <label className="field">
            <span>Key</span>
            <select value={song.tonic} onChange={(e) => {
              // Shortest way to the new key, so the melody moves at most a tritone.
              const up = (((Number(e.target.value) - song.tonic) % 12) + 12) % 12;
              setSong(transpose(song, up > 6 ? up - 12 : up));
            }}>
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>{pitchName(pc, pc, song.mode)}</option>
              ))}
            </select>
            <select value={song.mode} onChange={(e) => setSong({ ...song, mode: e.target.value as Mode })}>
              <option value="major">major</option>
              <option value="minor">minor</option>
              <option value="dorian">Dorian</option>
            </select>
            <button type="button" className="icon" aria-label="Transpose down a semitone" title="Transpose down a semitone ([)"
              onClick={() => setSong(transpose(song, -1))}>▼</button>
            <button type="button" className="icon" aria-label="Transpose up a semitone" title="Transpose up a semitone (])"
              onClick={() => setSong(transpose(song, 1))}>▲</button>
          </label>
          <label className="field">
            <span>Capo</span>
            <select value={song.capo ?? 0} onChange={(e) => setSong({ ...song, capo: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, f) => <option key={f} value={f}>{f === 0 ? "none" : f}</option>)}
            </select>
          </label>
          <label className="field">
            <span>BPM</span>
            <input
              type="number" min={40} max={220} value={song.bpm}
              onChange={(e) => {
                const bpm = Number(e.target.value);
                if (bpm >= 40 && bpm <= 220) setSong({ ...song, bpm });
              }}
            />
          </label>
          <div className="field">
            <span>Bars</span>
            <button type="button" aria-label="Remove a bar" disabled={song.bars <= 1}
              onClick={() => setSong(clampToBars({ ...song, bars: song.bars - 1 }))}>−</button>
            <b className="count">{song.bars}</b>
            <button type="button" aria-label="Add a bar" disabled={song.bars >= 64}
              onClick={() => setSong({ ...song, bars: song.bars + 1 })}>+</button>
          </div>
        </div>
      </header>
      {fileError ? <p className="file-error" role="alert">{fileError} <button type="button" onClick={() => setFileError(null)}>Dismiss</button></p> : null}

      <main className="workspace">
        <aside className="side">
          <div className="side-head">
            <h2>
              Chords in <Music text={keyName(song.tonic, song.mode)} />
              {song.capo ? <span className="capo-note">capo {song.capo}: play <Music text={keyName(shapeTonic(song.tonic, song.capo), song.mode)} /> shapes</span> : null}
            </h2>
            <div className="toggles">
              <label><input type="checkbox" checked={sevenths} onChange={(e) => setSevenths(e.target.checked)} /> 7ths</label>
              <label className="seg">
                <span>Length</span>
                <select value={chordLen} onChange={(e) => setChordLen(Number(e.target.value))}>
                  <option value={STEPS_PER_BAR / 4}>1 beat</option>
                  <option value={STEPS_PER_BAR / 2}>½ bar</option>
                  <option value={STEPS_PER_BAR}>1 bar</option>
                  <option value={STEPS_PER_BAR * 2}>2 bars</option>
                </select>
              </label>
            </div>
          </div>
          <p className="hint">
            {selection?.kind === "chord"
              ? "Pick a chord to replace the selected one. Delete removes it."
              : "Click a slot in the chord lane, then pick a chord. The next slot is selected for you."}
          </p>
          <Palette mode={song.mode} tonic={shapeTonic(song.tonic, song.capo ?? 0)} sevenths={sevenths} onPick={pickChord} />
          <div className="legend">
            <h3>Legend</h3>
            <p>Warm is home, cool is tension.</p>
            <div className="legend-row">
              {[1, 3, 5, 2, 4, 6, 7].map((d) => (
                <span key={d} className="legend-chip" style={{ background: `var(--d${d})` }}>{d}</span>
              ))}
            </div>
            <p>Hatched chords are borrowed from outside the key.</p>
          </div>
        </aside>

        <section className="main">
          <div className="main-head">
            <label><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Melody guides</label>
            <span className="hint">Click the grid to add a note. Drag to move, drag the right edge to stretch, click to delete.</span>
          </div>
          <Editor
            song={song}
            lyrics={lyrics}
            guides={guides}
            selection={selection}
            playhead={playhead}
            onSelect={setSelection}
            onChange={setSong}
          />

          <div className="lyrics">
            <div className="lyrics-head">
              <h2>Lyrics</h2>
              <label><input type="checkbox" checked={toneCheck} onChange={(e) => setToneCheck(e.target.checked)} /> Cantonese tone check</label>
            </div>
            <textarea
              value={song.lyrics}
              rows={2}
              placeholder="Type a lyric. Each syllable lands on the next note. Cantonese characters get a tone check against the melody."
              onChange={(e) => setSongState({ ...song, lyrics: e.target.value })}
            />
            <div className="report">
              {lyrics.syllables > 0 ? (
                <p className={mismatch ? "warn" : ""}>
                  {lyrics.syllables} syllables, {lyrics.notes} notes
                  {mismatch ? (lyrics.syllables > lyrics.notes ? ". Add notes for the leftover syllables." : ". Some notes have no syllable.") : "."}
                </p>
              ) : null}
              {toneCheck && lyrics.hasCantonese ? (
                lyrics.violations.length + lyrics.unusual.length === 0 ? (
                  <p className="ok">Melody follows the lyric tones.</p>
                ) : (
                  <>
                    <ul className="issues">
                      {lyrics.violations.map((r) => <li key={`v${r.index}`} className="is-violation">{r.message}</li>)}
                      {lyrics.unusual.map((r) => <li key={`u${r.index}`} className="is-unusual">{r.message}</li>)}
                    </ul>
                    {mismatch ? null : <LyricFixes song={song} onApply={setSong} />}
                  </>
                )
              ) : null}
              {toneCheck && lyrics.hasCantonese ? (
                <p className="fine">
                  Tone rules come from <a href="https://github.com/candpixie/CantoJam" target="_blank" rel="noreferrer">cantojam</a>,
                  measured on {CORPUS.songs} Cantopop songs ({CORPUS.syllables.toLocaleString()} sung syllables,
                  2000 to 2020). Tones: {Object.entries(TONE_NAMES).map(([t, n]) => `${t} ${n}`).join(" · ")}.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
