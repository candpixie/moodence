import { useRef, useState } from "react";
import {
  STARTERS, STEPS_PER_BAR, chordFeel, chordSymbol, commonNext, isBorrowed, keyName, palette, romanLabel,
  shapeTonic, type ChordEvent, type ChordSpec, type Mode, type Song, type Starter,
} from "moodence";
import { Music } from "./Music";

interface Props {
  song: Song;
  sevenths: boolean;
  playing: boolean;
  playhead: number | null;
  onLoad: (starter: Starter) => void;
  onSwap: (index: number, spec: ChordSpec) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onAudition: (prev: ChordSpec | null, spec: ChordSpec) => void;
  onTogglePlay: () => void;
}

const MODE_TABS: { mode: Mode; label: string }[] = [
  { mode: "major", label: "Major" },
  { mode: "minor", label: "Minor" },
  { mode: "dorian", label: "Dorian" },
];

const HOVER_DELAY = 150;

const sameSpec = (a: ChordSpec, b: ChordSpec) =>
  a.deg === b.deg && a.acc === b.acc && a.quality === b.quality && a.seventh === b.seventh && a.label === b.label;

/* Jam: pick a progression from the library, hear it loop, then swap chords by ear. */
export function Jam({ song, sevenths, playing, playhead, onLoad, onSwap, onAdd, onRemove, onAudition, onTogglePlay }: Props) {
  const [libMode, setLibMode] = useState<Mode>(song.mode);
  const [picked, setPicked] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const chords = [...song.chords].sort((a, b) => a.start - b.start);
  const total = song.bars * STEPS_PER_BAR;
  const shown = shapeTonic(song.tonic, song.capo ?? 0);
  const current = playhead === null ? -1 : chords.findIndex((c) => playhead >= c.start && playhead < c.start + c.len);
  const sel = picked !== null && picked < chords.length ? picked : null;
  const prev = sel !== null && sel > 0 ? chords[sel - 1] : sel === 0 && chords.length > 1 ? chords[chords.length - 1] : null;

  const audition = (spec: ChordSpec) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onAudition(prev, spec), HOVER_DELAY);
  };
  const cancel = () => window.clearTimeout(timer.current);

  const loaded = (s: Starter) =>
    s.mode === song.mode && s.chords.length === chords.length && s.chords.every((c, i) => sameSpec(c, chords[i]));

  const options = palette(song.mode, sevenths).flatMap((g) => g.chords);
  const fits = prev ? options.filter((o) => commonNext(prev, o, song.mode)) : options;
  const others = prev ? options.filter((o) => !commonNext(prev, o, song.mode)) : [];

  const chip = (spec: ChordSpec, i: number, faded: boolean) => (
    <button
      key={i}
      type="button"
      className={`pchord${isBorrowed(spec, song.mode) ? " is-borrowed" : ""}${faded ? " is-rare" : ""}${sel !== null && sameSpec(spec, chords[sel]) ? " is-current" : ""}`}
      style={{ ["--c" as string]: `var(--d${spec.deg})` }}
      onMouseEnter={() => audition(spec)}
      onMouseLeave={cancel}
      onClick={() => { cancel(); if (sel !== null) onSwap(sel, spec); }}
    >
      <span className="chord-roman"><Music text={romanLabel(spec, song.mode)} /></span>
      <span className="chord-symbol"><Music text={chordSymbol(spec, song.mode, shown)} /></span>
      <span className="chord-feel">{chordFeel(spec, song.mode)}</span>
    </button>
  );

  return (
    <div className="jam">
      <section className="jam-library panel">
        <div className="jam-head">
          <h2>Progressions</h2>
          <div className="tabs" role="tablist">
            {MODE_TABS.map((t) => (
              <button key={t.mode} type="button" role="tab" aria-selected={libMode === t.mode}
                className={libMode === t.mode ? "is-on" : ""} onClick={() => setLibMode(t.mode)}>{t.label}</button>
            ))}
          </div>
        </div>
        <p className="hint">Click one to hear it loop. Then change any chord below.</p>
        <div className="cards">
          {STARTERS.filter((s) => s.mode === libMode).map((s) => (
            <button key={s.name} type="button" className={`card${loaded(s) ? " is-on" : ""}`}
              onClick={() => { setPicked(null); onLoad(s); }}>
              <span className="card-strip">
                {s.chords.map((c, i) => <i key={i} style={{ background: `var(--d${c.deg})` }} />)}
              </span>
              <b>{s.name}</b>
              <span className="card-romans"><Music text={s.chords.map((c) => romanLabel(c, s.mode)).join("  ")} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="jam-loop panel">
        <div className="jam-head">
          <h2>Your loop <span className="muted">in <Music text={keyName(song.tonic, song.mode)} /></span></h2>
          <button type="button" className={`play${playing ? " is-on" : ""}`} onClick={onTogglePlay}>
            {playing ? "■ Stop" : "▶ Play loop"}
          </button>
        </div>
        {chords.length === 0 ? (
          <p className="empty">Pick a progression above, or add a chord.</p>
        ) : null}
        <div className="loop">
          {chords.map((c: ChordEvent, i) => (
            <button
              key={c.id}
              type="button"
              className={`loop-chord pchord${isBorrowed(c, song.mode) ? " is-borrowed" : ""}${i === sel ? " is-selected" : ""}${i === current ? " is-playing" : ""}`}
              style={{ ["--c" as string]: `var(--d${c.deg})`, flexGrow: c.len }}
              onClick={() => setPicked(i === sel ? null : i)}
            >
              <span className="chord-roman"><Music text={romanLabel(c, song.mode)} /></span>
              <span className="chord-symbol"><Music text={chordSymbol(c, song.mode, shown)} /></span>
              <span className="chord-feel">{chordFeel(c, song.mode)}</span>
            </button>
          ))}
          {chords.length < 16 && (chords.length === 0 || chords[chords.length - 1].start + chords[chords.length - 1].len <= total) ? (
            <button type="button" className="loop-add" onClick={() => { onAdd(); setPicked(chords.length); }} aria-label="Add a chord">+</button>
          ) : null}
        </div>

        {sel !== null ? (
          <div className="swap">
            <div className="swap-head">
              <h3>
                Swap chord {sel + 1}
                {prev ? <> · after <Music text={romanLabel(prev, song.mode)} /></> : null}
              </h3>
              <button type="button" onClick={() => { onRemove(sel); setPicked(null); }}>Remove</button>
            </div>
            <p className="hint">Hover to hear it after the chord before. Click to swap it in.</p>
            {prev ? <h4>Fits well</h4> : null}
            <div className="palette-chords">{fits.map((o, i) => chip(o, i, false))}</div>
            {others.length ? (
              <>
                <h4>Something different</h4>
                <div className="palette-chords">{others.map((o, i) => chip(o, i, true))}</div>
              </>
            ) : null}
          </div>
        ) : chords.length ? (
          <p className="hint">Click a chord in the loop to swap it.</p>
        ) : null}
      </section>
    </div>
  );
}
