import { SynthParams, Step } from '../types';

export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  
  // Reuse nodes for monophonic acid synth
  private osc: OscillatorNode | null = null;
  private filter: BiquadFilterNode;
  private ampGain: GainNode;
  
  // State to track slide/legato
  private isPlaying: boolean = false;

  constructor() {
    // Initialize AudioContext
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass();

    // Create graph
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1; 

    this.ampGain = this.ctx.createGain();
    this.ampGain.gain.value = 0;

    // Connect: Osc -> Filter -> Amp -> Master
    // (We connect Osc dynamically in start/stop)
    this.filter.connect(this.ampGain);
    this.ampGain.connect(this.masterGain);
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // This function schedules the event for a specific time
  scheduleStep(step: Step, nextStep: Step | null, time: number, params: SynthParams, stepDuration: number) {
    if (!step.active) {
      // Silence if not active
      this.ampGain.gain.setTargetAtTime(0, time, 0.01);
      return;
    }

    // 1. Setup Oscillator
    if (!this.osc) {
      this.osc = this.ctx.createOscillator();
      this.osc.start(time);
      this.osc.connect(this.filter);
    }

    this.osc.type = params.waveform;
    
    // Calculate frequency
    // Base note C2 is 36. 
    const baseMidi = 36 + step.note + (step.octave * 12);
    const frequency = 440 * Math.pow(2, (baseMidi - 69) / 12);

    // 2. Frequency Logic (Slide)
    // If we are sliding FROM a previous note, we ramp. 
    // But here we are at the START of 'step'.
    // A simpler logic for 303 emulation:
    // If THIS step has slide=true, we don't kill the envelope at the end.
    // Ideally, we ramp pitch if the PREVIOUS step had slide. 
    // However, for this engine, we set pitch immediately unless we implement complex lookback.
    // To keep it responsive: Set pitch immediately at 'time'. 
    // (Refinement: classic slide glides TO the current note. We'll set instant for now to ensure tuning).
    this.osc.frequency.setValueAtTime(frequency, time);
    
    if (step.slide && nextStep && nextStep.active) {
       // If sliding to the next note, calculate next frequency
       const nextMidi = 36 + nextStep.note + (nextStep.octave * 12);
       const nextFreq = 440 * Math.pow(2, (nextMidi - 69) / 12);
       // Glide over the duration of the step
       this.osc.frequency.linearRampToValueAtTime(nextFreq, time + stepDuration);
    }

    // 3. Parameters
    const maxFilterFreq = 20000;
    const baseCutoff = (params.cutoff / 100) * 8000 + 50; // Map 0-100 to 50Hz-8050Hz
    const resValue = (params.resonance / 100) * 20; // Q up to 20
    
    // Accent modification
    let activeEnvMod = params.envMod / 100;
    let activeDecay = params.decay / 100;
    let activeVol = params.volume / 100;

    if (step.accent) {
      const accentIntensity = params.accentLevel / 100;
      activeVol = Math.min(1, activeVol + (0.3 * accentIntensity));
      activeEnvMod = Math.min(1, activeEnvMod + (0.5 * accentIntensity));
      activeDecay = Math.max(0.1, activeDecay * 0.5); // Accents often have shorter, punchier decay on 303
      this.filter.Q.setValueAtTime(resValue + (10 * accentIntensity), time);
    } else {
      this.filter.Q.setValueAtTime(resValue, time);
    }

    // 4. Envelopes
    
    // Amp Envelope
    // 303 is basically a gate envelope.
    this.ampGain.gain.cancelScheduledValues(time);
    this.ampGain.gain.setValueAtTime(activeVol, time);
    
    // Filter Envelope
    // The filter sweeps down from (Base + ModAmount) to Base
    this.filter.frequency.cancelScheduledValues(time);
    const peakFilter = Math.min(maxFilterFreq, baseCutoff + (activeEnvMod * 10000));
    
    this.filter.frequency.setValueAtTime(baseCutoff, time);
    this.filter.frequency.linearRampToValueAtTime(peakFilter, time + 0.01); // Attack
    
    // Decay curve
    const decayTime = 0.1 + (activeDecay * 2.0); // Map to 0.1s - 2.1s
    this.filter.frequency.exponentialRampToValueAtTime(baseCutoff, time + decayTime);

    // 5. Note Off (Gate) logic
    // If slide is on, we don't close the gate at step end (Legato)
    if (!step.slide) {
      // Standard gate: close slightly before next step to separate notes
      const gateLen = stepDuration * 0.8; 
      this.ampGain.gain.setValueAtTime(activeVol, time + gateLen);
      this.ampGain.gain.linearRampToValueAtTime(0, time + gateLen + 0.02);
    }
  }

  stop() {
    if (this.osc) {
      this.osc.stop();
      this.osc.disconnect();
      this.osc = null;
    }
    this.ampGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ampGain.gain.value = 0;
  }
}

export const audioEngine = new AudioEngine();
