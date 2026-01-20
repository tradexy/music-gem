import { MidiDevice } from '../types';

export class MidiService {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;

  async initialize(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser.');
      return;
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess();
    } catch (err) {
      console.error('Failed to access Web MIDI API', err);
    }
  }

  getOutputs(): MidiDevice[] {
    if (!this.midiAccess) return [];
    const outputs: MidiDevice[] = [];
    this.midiAccess.outputs.forEach((output) => {
      outputs.push({
        id: output.id,
        name: output.name || `Unknown Device ${output.id}`,
      });
    });
    return outputs;
  }

  setOutput(id: string) {
    this.selectedOutputId = id;
  }

  // Send Note On (0x90)
  sendNoteOn(note: number, velocity: number) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (output) {
      // Limit note range 0-127
      const safeNote = Math.max(0, Math.min(127, note));
      const safeVel = Math.max(0, Math.min(127, velocity));
      output.send([0x90, safeNote, safeVel]);
    }
  }

  // Send Note Off (0x80)
  sendNoteOff(note: number) {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (output) {
      const safeNote = Math.max(0, Math.min(127, note));
      output.send([0x80, safeNote, 0]);
    }
  }

  // Panic button: All notes off
  stopAll() {
    if (!this.midiAccess || !this.selectedOutputId) return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (output) {
      for (let i = 0; i < 128; i++) {
        output.send([0x80, i, 0]);
      }
    }
  }
}

export const midiService = new MidiService();