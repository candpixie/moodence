import { chordSymbol, isBorrowed, palette, romanLabel, type ChordSpec, type Mode } from "moodence";

interface Props {
  mode: Mode;
  tonic: number;
  sevenths: boolean;
  onPick: (spec: ChordSpec) => void;
}

export function Palette({ mode, tonic, sevenths, onPick }: Props) {
  return (
    <div className="palette">
      {palette(mode, sevenths).map((group) => (
        <section key={group.title} className="palette-group">
          <h3>{group.title}</h3>
          <div className="palette-chords">
            {group.chords.map((spec, i) => (
              <button
                key={i}
                type="button"
                className={`pchord${isBorrowed(spec, mode) ? " is-borrowed" : ""}`}
                style={{ ["--c" as string]: `var(--d${spec.deg})` }}
                onClick={() => onPick(spec)}
              >
                <span className="chord-roman">{romanLabel(spec, mode)}</span>
                <span className="chord-symbol">{chordSymbol(spec, mode, tonic)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
