import { useRef } from "react";
import {
  chordFeel, chordSymbol, commonNext, isBorrowed, palette, romanLabel, type ChordSpec, type Mode,
} from "moodence";
import { Music } from "./Music";

interface Props {
  mode: Mode;
  tonic: number;
  sevenths: boolean;
  /** The chord before the slot you're filling, if any. */
  prev: ChordSpec | null;
  onPick: (spec: ChordSpec) => void;
  onAudition: (spec: ChordSpec) => void;
}

const HOVER_DELAY = 150;

export function Palette({ mode, tonic, sevenths, prev, onPick, onAudition }: Props) {
  const timer = useRef<number | undefined>(undefined);
  const audition = (spec: ChordSpec) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onAudition(spec), HOVER_DELAY);
  };
  const cancel = () => window.clearTimeout(timer.current);

  return (
    <div className="palette">
      {palette(mode, sevenths).map((group) => (
        <section key={group.title} className="palette-group">
          <h3>{group.title}</h3>
          <div className="palette-chords">
            {group.chords.map((spec, i) => {
              const hint = prev ? (commonNext(prev, spec, mode) ? " is-common" : " is-rare") : "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`pchord${isBorrowed(spec, mode) ? " is-borrowed" : ""}${hint}`}
                  style={{ ["--c" as string]: `var(--d${spec.deg})` }}
                  onClick={() => { cancel(); onPick(spec); }}
                  onMouseEnter={() => audition(spec)}
                  onMouseLeave={cancel}
                >
                  <span className="chord-roman"><Music text={romanLabel(spec, mode)} /></span>
                  <span className="chord-symbol"><Music text={chordSymbol(spec, mode, tonic)} /></span>
                  <span className="chord-feel">{chordFeel(spec, mode)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
