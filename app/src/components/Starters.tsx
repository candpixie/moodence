import { STARTERS, romanLabel, type Mode, type Starter } from "moodence";
import { Music } from "./Music";

interface Props {
  mode: Mode;
  onPick: (starter: Starter) => void;
}

export function Starters({ mode, onPick }: Props) {
  const starters = STARTERS.filter((s) => s.mode === mode);
  return (
    <section className="starters">
      <h3>Start from a progression</h3>
      <div className="starter-list">
        {starters.map((s) => (
          <button key={s.name} type="button" className="starter" onClick={() => onPick(s)}>
            <b>{s.name}</b>
            <span><Music text={s.chords.map((c) => romanLabel(c, mode)).join(" ")} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}
