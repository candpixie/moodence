import { Midi } from "@tonejs/midi";
import { chordMidi, degreeMidi } from "./theory";
import { stepSeconds } from "./audio";
import type { Song } from "./song";

/* Two tracks, melody then chords, at the song's tempo. Lyric syllables ride
   along as MIDI lyric meta events on the melody track, one per note. */
export function songToMidi(song: Song, syllables: string[] = []): Uint8Array {
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
