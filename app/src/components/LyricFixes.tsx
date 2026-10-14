import { useEffect, useMemo, useState } from "react";
import {
  applyLyricFix, degreeMidi, fixReadings, sortedNotes, suggestLyricFixes, syllabify,
  type LyricFix, type LyricProblem, type Song,
} from "moodence";

interface Props {
  song: Song;
  onApply: (song: Song) => void;
}

/* cantojam's word finder: for each clash, corpus words that sit on the notes
   you already wrote. The melody stays, the words move. */
export function LyricFixes({ song, onApply }: Props) {
  const melody = useMemo(
    () => sortedNotes(song.notes).map((n) => degreeMidi(n, song.mode, song.tonic)),
    [song.notes, song.mode, song.tonic],
  );
  const signature = `${song.lyrics}|${melody.join(",")}|${JSON.stringify(song.readings ?? {})}`;
  const [problems, setProblems] = useState<LyricProblem[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Suggestions are for one exact lyric and melody. Any edit makes them stale.
  useEffect(() => setProblems(null), [signature]);

  const sung = useMemo(() => syllabify(song.lyrics, song.readings).filter((s) => !s.skipped), [song.lyrics, song.readings]);

  const find = async () => {
    setLoading(true);
    try {
      setProblems(await suggestLyricFixes(song.lyrics, melody, { overrides: song.readings }));
    } finally {
      setLoading(false);
    }
  };

  const apply = (fix: LyricFix) => {
    const readings = { ...(song.readings ?? {}), ...fixReadings(fix) };
    onApply({ ...song, lyrics: applyLyricFix(song.lyrics, fix), readings });
  };

  if (!problems) {
    return (
      <button type="button" className="find-words" onClick={() => void find()} disabled={loading}>
        {loading ? "Loading the corpus word list…" : "Find words that fit these notes"}
      </button>
    );
  }

  return (
    <div className="fixes">
      {problems.map((problem) => (
        <div key={problem.index} className={`fix is-${problem.kind}`}>
          <p className="fix-title">
            <b>{sung[problem.index]?.char}</b> {problem.message}
          </p>
          {problem.phrases.length + problem.singles.length === 0 ? (
            <p className="fine">Nothing in the corpus fits here. Try moving the note instead.</p>
          ) : null}
          {([["Phrases the corpus wrote as a unit", problem.phrases],
             ["Single characters that fit the notes, sense is yours to judge", problem.singles]] as const)
            .filter(([, list]) => list.length)
            .map(([label, list]) => (
              <div key={label}>
                <p className="fine">{label}</p>
                <div className="fix-options">
                  {list.map((fix) => (
                    <button key={`${fix.start}-${fix.word}`} type="button" onClick={() => apply(fix)}
                      title={`Replaces ${fix.replaces}. Used ${fix.count}× in the corpus.`}>
                      <span className="fix-word">{fix.replaces} → {fix.word}</span>
                      <span className="fix-jyut">{fix.jyutping}{fix.pin.length ? ` · sing ${fix.pin.join(", ")}` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
