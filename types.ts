export interface Step {
  active: boolean;
  note: number; // MIDI note number (0-127)
  octave: number; // -1, 0, +1 relative to base
  slide: boolean;
  accent: boolean;
}

export interface SynthParams {
  cutoff: number; // 0-100
  resonance: number; // 0-100
  envMod: number; // 0-100
  decay: number; // 0-100
  accentLevel: number; // 0-100
  tempo: number; // BPM
  waveform: 'sawtooth' | 'square';
  volume: number; // 0-100
}

export interface MidiDevice {
  id: string;
  name: string;
}

export enum PlayState {
  STOPPED,
  PLAYING
}
