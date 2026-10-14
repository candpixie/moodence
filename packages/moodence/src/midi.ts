/**
 * Standard MIDI file export.
 *
 * @module midi
 */

import { Midi } from "@tonejs/midi";
import { chordMidi, degreeMidi } from "./theory";
import { stepSeconds, type Song } from "./song";
import { syllabify } from "./tones";

/**
 * Write a song as a two-track MIDI file (melody, then chords) at its tempo.
 * Lyric syllables are added as lyric meta events, one per melody note.
 *
 * @returns The bytes of a `.mid` file.
 */
export function songToMidi(song: Song): Uint8Array {
  const syllables = syllabify(song.lyrics).filter((s) => !s.skipped).map((s) => s.char);
  const midi = new Midi();
  midi.header.setTempo(song.bpm);
  midi.header.name = song.title;
  const step = stepSeconds(song.bpm);

  const melody = midi.addTrack();
  melody.name = "Melody";
  [...song.notes].sort((a, b) => a.start - b.start).forEach((note, i) => {
    melody.addNote({
      midi: degreeMidi(note, song.mode, song.tonic),
      time: note.start * step,
      duration: note.len * step,
      velocity: 0.85,
    });
    if (syllables[i]) {
      midi.header.meta.push({
        type: "lyrics",
        text: syllables[i],
        ticks: midi.header.secondsToTicks(note.start * step),
      });
    }
  });

  const chords = midi.addTrack();
  chords.name = "Chords";
  for (const chord of song.chords) {
    for (const pitch of chordMidi(chord, song.mode, song.tonic)) {
      chords.addNote({ midi: pitch, time: chord.start * step, duration: chord.len * step, velocity: 0.6 });
    }
  }
  return midi.toArray();
}
