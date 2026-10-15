import * as Tone from "tone";
import { STEPS_PER_BAR, chordMidi, noteMidi, stepSeconds, type Song } from "moodence";

/* One piano for chords and melody. The Salamander samples stream from the
   Tone.js CDN. If they don't load (offline, blocked), fall back to a synth so
   playback still works. */
let piano: Tone.Sampler | Tone.PolySynth | null = null;
let starting: Promise<void> | null = null;

const SAMPLE_URLS: Record<string, string> = {};
for (let octave = 1; octave <= 7; octave++) {
  for (const [note, file] of [["C", "C"], ["D#", "Ds"], ["F#", "Fs"], ["A", "A"]]) {
    SAMPLE_URLS[`${note}${octave}`] = `${file}${octave}.mp3`;
  }
}

function fallbackSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -8,
  }).toDestination();
}

export function ensureAudio(): Promise<void> {
  if (starting) return starting;
  starting = (async () => {
    await Tone.start();
    try {
      const sampler = new Tone.Sampler({
        urls: SAMPLE_URLS,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        release: 1,
      }).toDestination();
      await Promise.race([
        Tone.loaded(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      piano = sampler;
    } catch {
      piano = fallbackSynth();
    }
  })();
  return starting;
}

const freq = (midi: number) => Tone.Frequency(midi, "midi").toFrequency();

export async function preview(midis: number[], velocity = 0.7): Promise<void> {
  await ensureAudio();
  piano?.triggerAttackRelease(midis.map(freq), 0.6, undefined, velocity);
}

/* True once the browser has let audio start (after the first click or key).
   Hover previews check this so they never queue up sound before that. */
export function audioReady(): boolean {
  return piano !== null && Tone.getContext().state === "running";
}

/* Play the move into a chord: the previous chord, then this one. */
export async function previewMove(from: number[] | null, to: number[]): Promise<void> {
  await ensureAudio();
  const now = Tone.now();
  if (from) piano?.triggerAttackRelease(from.map(freq), 0.45, now, 0.6);
  piano?.triggerAttackRelease(to.map(freq), 0.7, from ? now + 0.5 : now, 0.7);
}

/* Schedule the whole song on the transport as a loop. Called on every play,
   so edits made while stopped are always what you hear. */
export async function play(song: Song): Promise<void> {
  await ensureAudio();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.bpm.value = song.bpm;
  const step = stepSeconds(song.bpm);

  for (const chord of song.chords) {
    const notes = chordMidi(chord, song.mode, song.tonic).map(freq);
    transport.schedule((time) => {
      piano?.triggerAttackRelease(notes, chord.len * step * 0.98, time, 0.38);
    }, chord.start * step);
  }
  for (const note of song.notes) {
    const f = freq(noteMidi(song, note));
    transport.schedule((time) => {
      piano?.triggerAttackRelease(f, note.len * step * 0.95, time, 0.85);
    }, note.start * step);
  }

  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = song.bars * STEPS_PER_BAR * step;
  transport.start("+0.05");
}

export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
}

/* Current playhead in steps, or null when stopped. */
export function playheadStep(bpm: number): number | null {
  const transport = Tone.getTransport();
  if (transport.state !== "started") return null;
  return transport.seconds / stepSeconds(bpm);
}
