import { useEffect, useRef, useState } from "react";
import {
  STEPS_PER_BAR, STEPS_PER_BEAT, chordAt, chordMidi, chordPitchClasses, chordSymbol, degreeMidi,
  degreeName, isBorrowed, noteMidi, placeChord, placeNote, romanLabel, shapeTonic,
  type ChordEvent, type DegreePitch, type LyricAlignment, type NoteEvent, type Song,
} from "moodence";
import { ROWS, newId } from "../song";
import { preview } from "../audio";

export const CELL = 16;
export const ROW_H = 26;
const CHORD_H = 52;
const EDGE = 7; // px at a block's right edge that resizes instead of moving

export type Selection =
  | { kind: "chord"; id: string }
  | { kind: "slot"; start: number }
  | null;

interface Props {
  song: Song;
  lyrics: LyricAlignment;
  guides: boolean;
  selection: Selection;
  playhead: number | null;
  onSelect: (s: Selection) => void;
  onChange: (song: Song) => void;
}

type Drag =
  | { kind: "note"; mode: "create" | "move" | "resize"; note: NoteEvent; grabStep: number; grabRow: number; original: NoteEvent; moved: boolean }
  | { kind: "chord"; chord: ChordEvent; original: ChordEvent };

const capture = (el: HTMLElement, id: number) => {
  try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
};

const rowOf = (p: DegreePitch) => ROWS.findIndex((r) => r.deg === p.deg && r.oct === p.oct);
const degVar = (deg: number) => `var(--d${deg})`;

export function Editor({ song, lyrics, guides, selection, playhead, onSelect, onChange }: Props) {
  const steps = song.bars * STEPS_PER_BAR;
  const width = steps * CELL;
  const gridRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  // Drag lives in a ref so back-to-back pointer events always see the latest
  // value; the state copy only exists to re-render.
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d); };
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || playhead === null) return;
    const x = playhead * CELL;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 40);
  }, [playhead]);

  const notes = drag?.kind === "note"
    ? placeNote(song.notes, drag.note)
    : song.notes;
  const chords = drag?.kind === "chord"
    ? placeChord(song.chords, drag.chord)
    : song.chords;

  const cellAt = (e: React.PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const step = Math.max(0, Math.min(steps - 1, Math.floor((e.clientX - rect.left) / CELL)));
    const row = Math.max(0, Math.min(ROWS.length - 1, Math.floor((e.clientY - rect.top) / ROW_H)));
    return { step, row, x: e.clientX - rect.left };
  };

  const sound = (p: DegreePitch) => void preview([noteMidi(song, p)]);

  // ---- melody grid

  const onGridDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const grid = gridRef.current!;
    const { step, row } = cellAt(e, grid);
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
    capture(grid, e.pointerId);
    if (hit) {
      const note = song.notes.find((n) => n.id === hit.dataset.note)!;
      const right = hit.getBoundingClientRect().right;
      const mode = right - e.clientX <= EDGE ? "resize" : "move";
      setDrag({ kind: "note", mode, note, original: note, grabStep: step, grabRow: row, moved: false });
      return;
    }
    const pitch = ROWS[row];
    const note: NoteEvent = { id: newId(), ...pitch, start: step, len: Math.min(2, steps - step) };
    sound(pitch);
    setDrag({ kind: "note", mode: "create", note, original: note, grabStep: step, grabRow: row, moved: false });
  };

  const onGridMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "note") return;
    const { step, row } = cellAt(e, gridRef.current!);
    const o = drag.original;
    let next = drag.note;
    if (drag.mode === "move") {
      const start = Math.max(0, Math.min(steps - o.len, o.start + step - drag.grabStep));
      const r = Math.max(0, Math.min(ROWS.length - 1, rowOf(o) + row - drag.grabRow));
      next = { ...o, ...ROWS[r], start };
      if (ROWS[r].deg !== drag.note.deg || ROWS[r].oct !== drag.note.oct) sound(ROWS[r]);
    } else {
      next = { ...o, len: Math.max(1, Math.min(steps - o.start, step - o.start + 1)) };
    }
    const moved = drag.moved || next.start !== o.start || next.len !== o.len || next.deg !== o.deg || next.oct !== o.oct;
    setDrag({ ...drag, note: next, moved });
  };

  const onGridUp = () => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "note") return;
    if (drag.mode === "move" && !drag.moved) {
      onChange({ ...song, notes: song.notes.filter((n) => n.id !== drag.note.id) });
    } else {
      onChange({ ...song, notes: placeNote(song.notes, drag.note) });
    }
    setDrag(null);
  };

  // ---- chord lane

  const onLaneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const lane = laneRef.current!;
    const { step } = cellAt(e, lane);
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-chord]");
    if (hit) {
      const chord = song.chords.find((c) => c.id === hit.dataset.chord)!;
      onSelect({ kind: "chord", id: chord.id });
      void preview(chordMidi(chord, song.mode, song.tonic));
      if (hit.getBoundingClientRect().right - e.clientX <= EDGE) {
        capture(lane, e.pointerId);
        setDrag({ kind: "chord", chord, original: chord });
      }
      return;
    }
    const half = STEPS_PER_BAR / 2;
    onSelect({ kind: "slot", start: Math.floor(step / half) * half });
  };

  const onLaneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "chord") return;
    const { x } = cellAt(e, laneRef.current!);
    const o = drag.original;
    const end = Math.round(x / CELL / STEPS_PER_BEAT) * STEPS_PER_BEAT;
    const len = Math.max(STEPS_PER_BEAT, Math.min(steps - o.start, end - o.start));
    setDrag({ ...drag, chord: { ...o, len } });
  };

  const onLaneUp = () => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "chord") return;
    onChange({ ...song, chords: placeChord(song.chords, drag.chord) });
    setDrag(null);
  };

  // ---- guide tint: which rows are chord tones under each chord

  const guideRects: JSX.Element[] = [];
  if (guides) {
    for (const chord of chords) {
      const pcs = chordPitchClasses(chord, song.mode, song.tonic);
      ROWS.forEach((r, i) => {
        const pc = degreeMidi(r, song.mode, song.tonic) % 12;
        if (!pcs.includes(pc)) return;
        guideRects.push(
          <div key={`${chord.id}-${i}`} className="guide"
            style={{ left: chord.start * CELL, top: i * ROW_H, width: chord.len * CELL, height: ROW_H, background: degVar(r.deg) }} />,
        );
      });
    }
  }

  const selectedChordId = selection?.kind === "chord" ? selection.id : null;
  // With a capo, chord names show the shapes to play. Sound never changes.
  const capo = song.capo ?? 0;
  const nameTonic = shapeTonic(song.tonic, capo);
  const chordName = (c: ChordEvent) => chordSymbol(c, song.mode, nameTonic);

  return (
    <div className="editor">
      <div className="labels" aria-hidden>
        <div className="label-chord">Chords</div>
        {ROWS.map((r, i) => (
          <div key={i} className={`label-row${r.deg === 1 ? " is-tonic" : ""}`} style={{ height: ROW_H }}>
            <span className="label-deg" style={{ color: degVar(r.deg) }}>
              {r.deg}{r.oct > 0 ? "′" : r.oct < 0 ? "," : ""}
            </span>
            <span className="label-name">{degreeName(r, song.mode, song.tonic)}</span>
          </div>
        ))}
      </div>

      <div className="scroll" ref={scrollRef}>
        <div style={{ width }}>
          <div
            ref={laneRef}
            className="lane"
            style={{ height: CHORD_H, width }}
            onPointerDown={onLaneDown}
            onPointerMove={onLaneMove}
            onPointerUp={onLaneUp}
          >
            {Array.from({ length: song.bars * 2 }, (_, i) => {
              const start = i * (STEPS_PER_BAR / 2);
              const selected = selection?.kind === "slot" && selection.start === start;
              return (
                <div key={i} className={`slot${selected ? " is-selected" : ""}`}
                  style={{ left: start * CELL, width: (STEPS_PER_BAR / 2) * CELL }}>
                  {selected && !chordAt(chords, start) ? <span>pick a chord</span> : null}
                </div>
              );
            })}
            {chords.map((c) => (
              <div
                key={c.id}
                data-chord={c.id}
                className={`chord${isBorrowed(c, song.mode) ? " is-borrowed" : ""}${c.id === selectedChordId ? " is-selected" : ""}`}
                style={{ left: c.start * CELL, width: c.len * CELL, ["--c" as string]: degVar(c.deg) }}
                title={`${romanLabel(c, song.mode)} (${chordSymbol(c, song.mode, song.tonic)}${capo ? `, play ${chordName(c)} shape with capo ${capo}` : ""}). Drag the right edge to resize.`}
              >
                <span className="chord-roman">{romanLabel(c, song.mode)}</span>
                <span className="chord-symbol">{chordName(c)}</span>
              </div>
            ))}
          </div>

          <div
            ref={gridRef}
            className="grid"
            style={{ height: ROWS.length * ROW_H, width, ["--cell" as string]: `${CELL}px`, ["--row" as string]: `${ROW_H}px` }}
            onPointerDown={onGridDown}
            onPointerMove={onGridMove}
            onPointerUp={onGridUp}
            onPointerCancel={() => setDrag(null)}
          >
            {guideRects}
            {notes.map((n) => {
              const lyric = lyrics.byNote.get(n.id);
              const status = lyric?.status ?? "none";
              return (
                <div
                  key={n.id}
                  data-note={n.id}
                  className={`note is-${status}`}
                  style={{ left: n.start * CELL, top: rowOf(n) * ROW_H + 2, width: n.len * CELL - 2, height: ROW_H - 4, ["--c" as string]: degVar(n.deg) }}
                  title={lyric?.message ?? (lyric?.jyutping ? `${lyric.text} ${lyric.jyutping}` : undefined)}
                >
                  {lyric ? <span className="note-lyric">{lyric.text}</span> : null}
                  {lyric?.tone ? <span className="note-tone">{lyric.tone}</span> : null}
                </div>
              );
            })}
            {playhead !== null ? <div className="playhead" style={{ left: playhead * CELL }} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
