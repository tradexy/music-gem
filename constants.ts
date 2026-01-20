import { Step, SynthParams } from './types';

export const STEPS_PER_BAR = 16;
export const DEFAULT_TEMPO = 120;

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Default Pattern
export const DEFAULT_PATTERN: Step[] = Array(STEPS_PER_BAR).fill(null).map(() => ({
  active: false,
  note: 0, // Relative to C2 (36)
  octave: 0,
  slide: false,
  accent: false,
}));

export const INITIAL_PARAMS: SynthParams = {
  cutoff: 50,
  resonance: 60,
  envMod: 75,
  decay: 40,
  accentLevel: 80,
  tempo: 120,
  waveform: 'sawtooth',
  volume: 75,
};

// Map scale index to frequency is handled in AudioEngine, but we need Note Strings for UI
export const MIDI_NOTE_NAMES = (midiVal: number) => {
  const octave = Math.floor(midiVal / 12) - 1;
  const noteIndex = midiVal % 12;
  return `${NOTES[noteIndex]}${octave}`;
};
