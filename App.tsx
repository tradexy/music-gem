import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw, Activity, Volume2, Music, Keyboard } from 'lucide-react';
import { Step, SynthParams, PlayState, MidiDevice } from './types';
import { INITIAL_PARAMS, DEFAULT_PATTERN, STEPS_PER_BAR, MIDI_NOTE_NAMES, DEFAULT_TEMPO, NOTES } from './constants';
import { midiService } from './services/midiService';
import { audioEngine } from './services/audioEngine';

// Slider Component
const Slider = ({ label, value, min = 0, max = 100, onChange, shortcut, color = 'bg-yellow-500' }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  shortcut?: string;
  color?: string;
}) => (
  <div className="flex flex-col items-center gap-2 min-w-[80px]">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-20 md:w-24 h-2 md:h-3 rounded-lg appearance-none cursor-pointer bg-gray-700`}
      style={{ accentColor: color === 'bg-yellow-500' ? '#eab308' : (color === 'bg-red-500' ? '#ef4444' : '#60a5fa') }}
    />
    <span className="text-sm font-mono text-gray-200">{value}</span>
    {shortcut && (
      <span className="text-[9px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{shortcut}</span>
    )}
  </div>
);

function App() {
  // --- State ---
  const [params, setParams] = useState<SynthParams>(INITIAL_PARAMS);
  const [pattern, setPattern] = useState<Step[]>(DEFAULT_PATTERN);
  const [playState, setPlayState] = useState<PlayState>(PlayState.STOPPED);
  const [currentStep, setCurrentStep] = useState<number>(-1);

  // MIDI State
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string>('');
  const [midiLogs, setMidiLogs] = useState<string[]>([]);

  // Refs for timing loop - CRITICAL for real-time updates
  const nextNoteTime = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const timerID = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const paramsRef = useRef<SynthParams>(params);
  const patternRef = useRef<Step[]>(pattern);

  // Sync refs with state
  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { patternRef.current = pattern; }, [pattern]);

  // Constants for scheduler
  const SCHEDULE_AHEAD_TIME = 0.1; // seconds
  const LOOKAHEAD = 25.0; // milliseconds

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      const key = e.key.toLowerCase();
      const step = 5; // Increment/decrement amount

      switch (key) {
        case 'q': setParams(p => ({ ...p, cutoff: Math.min(100, p.cutoff + step) })); break;
        case 'a': setParams(p => ({ ...p, cutoff: Math.max(0, p.cutoff - step) })); break;
        case 'w': setParams(p => ({ ...p, resonance: Math.min(100, p.resonance + step) })); break;
        case 's': setParams(p => ({ ...p, resonance: Math.max(0, p.resonance - step) })); break;
        case 'e': setParams(p => ({ ...p, envMod: Math.min(100, p.envMod + step) })); break;
        case 'd': setParams(p => ({ ...p, envMod: Math.max(0, p.envMod - step) })); break;
        case 'r': setParams(p => ({ ...p, decay: Math.min(100, p.decay + step) })); break;
        case 'f': setParams(p => ({ ...p, decay: Math.max(0, p.decay - step) })); break;
        case 'i': setParams(p => ({ ...p, waveform: 'sawtooth' })); break;
        case 'o': setParams(p => ({ ...p, waveform: 'square' })); break;
        case 'p': togglePlay(); break;
        case ' ': e.preventDefault(); togglePlay(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playState]);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      await midiService.initialize();
      setMidiDevices(midiService.getOutputs());
    };
    init();

    // Default Pattern setup: Simple rhythm
    const initialPattern = pattern.map(s => ({ ...s, note: 0, octave: 0, active: false }));
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => initialPattern[i].active = true);
    setPattern(initialPattern);

    return () => stopSequencer();
  }, []);

  // --- Helpers ---
  const logMidi = (msg: string) => {
    setMidiLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const updateParam = (key: keyof SynthParams, val: any) => {
    setParams(p => ({ ...p, [key]: val }));
  };

  const updateStep = (index: number, field: keyof Step, val: any) => {
    const newPattern = [...pattern];
    newPattern[index] = { ...newPattern[index], [field]: val };
    setPattern(newPattern);
  };

  // --- Sequencer Engine ---
  const nextNote = () => {
    const secondsPerBeat = 60.0 / paramsRef.current.tempo;
    const secondsPerStep = secondsPerBeat / 4; // 16th notes
    nextNoteTime.current += secondsPerStep;
    currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;
  };

  const scheduleNote = (stepNumber: number, time: number) => {
    // UI Update
    setTimeout(() => {
      setCurrentStep(stepNumber);
    }, (time - audioEngine['ctx'].currentTime) * 1000);

    // Use refs for real-time values
    const currentParams = paramsRef.current;
    const currentPattern = patternRef.current;

    const step = currentPattern[stepNumber];
    const nextStepIdx = (stepNumber + 1) % STEPS_PER_BAR;
    const nextStep = currentPattern[nextStepIdx];

    const duration = (60.0 / currentParams.tempo) / 4;

    // 1. Audio Engine
    audioEngine.scheduleStep(step, nextStep, time, currentParams, duration);

    // 2. MIDI Output
    if (step.active) {
      const baseNote = 36 + step.note + (step.octave * 12);
      let velocity = 100;
      if (step.accent) velocity = 127;

      const delayMs = Math.max(0, (time - audioEngine['ctx'].currentTime) * 1000);

      setTimeout(() => {
        midiService.sendNoteOn(baseNote, velocity);
        logMidi(`Note On: ${MIDI_NOTE_NAMES(baseNote)} (Vel: ${velocity})`);

        const noteLen = step.slide ? duration * 1.05 : duration * 0.7;
        setTimeout(() => {
          midiService.sendNoteOff(baseNote);
        }, noteLen * 1000);
      }, delayMs);
    }
  };

  const scheduler = () => {
    while (nextNoteTime.current < audioEngine['ctx'].currentTime + SCHEDULE_AHEAD_TIME) {
      scheduleNote(currentStepRef.current, nextNoteTime.current);
      nextNote();
    }
    if (isPlayingRef.current) {
      timerID.current = window.setTimeout(scheduler, LOOKAHEAD);
    }
  };

  const startSequencer = () => {
    if (playState === PlayState.PLAYING) return;

    audioEngine.resume();
    isPlayingRef.current = true;
    currentStepRef.current = 0;
    nextNoteTime.current = audioEngine['ctx'].currentTime + 0.05;

    scheduler();
    setPlayState(PlayState.PLAYING);
    logMidi("Sequencer Started");
  };

  const stopSequencer = () => {
    isPlayingRef.current = false;
    if (timerID.current) window.clearTimeout(timerID.current);
    audioEngine.stop();
    midiService.stopAll();
    setPlayState(PlayState.STOPPED);
    setCurrentStep(-1);
    logMidi("Sequencer Stopped");
  };

  const togglePlay = () => {
    if (playState === PlayState.PLAYING) stopSequencer();
    else startSequencer();
  };

  const clearPattern = () => {
    setPattern(DEFAULT_PATTERN.map(s => ({ ...s, active: false })));
    logMidi("Pattern Cleared");
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 font-sans text-gray-200 overflow-y-auto">

      {/* Header */}
      <header className="w-full max-w-5xl flex flex-wrap justify-between items-center mb-6 border-b border-gray-700 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 p-2 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            <Music className="text-gray-900 w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tighter text-gray-100">
            MUSIC<span className="text-yellow-500">-GEM</span>
          </h1>
          <span className="text-[10px] bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-400">
            V2.0
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Keyboard Hint */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500">
            <Keyboard size={14} />
            <span>P = Play | Q/A W/S E/D R/F</span>
          </div>

          {/* MIDI Selector */}
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <select
              className="bg-gray-800 text-sm border border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500 outline-none"
              value={selectedMidiId}
              onChange={(e) => {
                setSelectedMidiId(e.target.value);
                midiService.setOutput(e.target.value);
                logMidi(`Output changed to: ${e.target.options[e.target.selectedIndex].text}`);
              }}
            >
              <option value="">Select MIDI Output...</option>
              {midiDevices.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Control Panel */}
      <div className="w-full max-w-5xl bg-gray-800 rounded-xl shadow-2xl p-4 md:p-6 mb-6 border-t border-gray-700">

        {/* Sliders Row */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-6 p-4 bg-gray-900 rounded-lg shadow-inner border border-gray-800">
          <Slider label="Cutoff" value={params.cutoff} onChange={(v) => updateParam('cutoff', v)} shortcut="Q/A" />
          <Slider label="Resonance" value={params.resonance} onChange={(v) => updateParam('resonance', v)} shortcut="W/S" />
          <Slider label="Env Mod" value={params.envMod} onChange={(v) => updateParam('envMod', v)} shortcut="E/D" />
          <Slider label="Decay" value={params.decay} onChange={(v) => updateParam('decay', v)} shortcut="R/F" />
          <Slider label="Accent" value={params.accentLevel} onChange={(v) => updateParam('accentLevel', v)} color="bg-red-500" />
          <Slider label="Tempo" value={params.tempo} min={60} max={200} onChange={(v) => updateParam('tempo', v)} color="bg-blue-400" />

          <div className="flex flex-col items-center justify-end gap-2 pb-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Wave</div>
            <div className="flex bg-gray-950 rounded p-1 border border-gray-700">
              <button
                className={`px-3 py-1 text-xs font-bold rounded ${params.waveform === 'sawtooth' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                onClick={() => updateParam('waveform', 'sawtooth')}
              >
                SAW
              </button>
              <button
                className={`px-3 py-1 text-xs font-bold rounded ${params.waveform === 'square' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                onClick={() => updateParam('waveform', 'square')}
              >
                SQR
              </button>
            </div>
            <span className="text-[9px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">I/O</span>
          </div>
        </div>

        {/* Transport & Global */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex gap-4">
            <button
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold shadow-lg transition-all ${playState === PlayState.PLAYING ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'}`}
              onClick={togglePlay}
            >
              {playState === PlayState.PLAYING ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              {playState === PlayState.PLAYING ? 'STOP' : 'RUN'}
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full font-medium transition-colors border border-gray-600"
              onClick={clearPattern}
            >
              <RefreshCw className="w-4 h-4" /> CLEAR
            </button>
          </div>
          <div className="flex items-center gap-2 text-gray-500 bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
            <Volume2 className="w-4 h-4" />
            <input
              type="range" min="0" max="100"
              value={params.volume}
              onChange={(e) => updateParam('volume', parseInt(e.target.value))}
              className="w-24 accent-yellow-500 h-2"
            />
          </div>
        </div>

        {/* The Sequencer Grid - Horizontal Scroll on Mobile */}
        <div className="bg-gray-950 p-2 rounded-lg border border-gray-800 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {pattern.map((step, idx) => (
              <div key={idx} className={`flex flex-col items-center gap-2 py-2 min-w-[3rem] rounded border transition-colors ${currentStep === idx ? 'bg-gray-800 border-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-transparent border-transparent'}`}>

                {/* LED */}
                <div className={`w-3 h-3 rounded-full mb-1 transition-all duration-75 ${currentStep === idx ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-900/30'}`}></div>

                {/* On/Off Toggle */}
                <button
                  className={`w-10 h-10 rounded shadow-md border-b-4 transition-all active:border-b-0 active:translate-y-1 ${step.active ? 'bg-yellow-600 border-yellow-800 text-white' : 'bg-gray-700 border-gray-800 text-gray-500 hover:bg-gray-600'}`}
                  onClick={() => updateStep(idx, 'active', !step.active)}
                >
                  {idx + 1}
                </button>

                <div className="h-px w-full bg-gray-800 my-1"></div>

                {/* Note Select */}
                <div className="relative group">
                  <button className="text-xs font-mono font-bold text-blue-300 hover:text-white w-full text-center py-1 bg-gray-900 rounded border border-gray-800">
                    {NOTES[step.note]}
                  </button>
                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 bg-gray-800 border border-gray-600 rounded shadow-xl p-1 w-24 max-h-48 overflow-y-auto">
                    {NOTES.map((n, nIdx) => (
                      <div
                        key={n}
                        className="px-2 py-1 text-xs hover:bg-blue-600 cursor-pointer text-gray-200"
                        onClick={() => updateStep(idx, 'note', nIdx)}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Octave */}
                <div className="flex flex-col w-full px-1 gap-1">
                  <button
                    className={`text-[10px] py-0.5 rounded ${step.octave === 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                    onClick={() => updateStep(idx, 'octave', step.octave === 1 ? 0 : 1)}
                  >UP</button>
                  <button
                    className={`text-[10px] py-0.5 rounded ${step.octave === -1 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                    onClick={() => updateStep(idx, 'octave', step.octave === -1 ? 0 : -1)}
                  >DN</button>
                </div>

                <div className="h-px w-full bg-gray-800 my-1"></div>

                {/* Modifiers */}
                <button
                  className={`w-8 h-6 text-[10px] rounded font-bold transition-colors ${step.slide ? 'bg-purple-600 text-white shadow-[0_0_5px_rgba(147,51,234,0.5)]' : 'bg-gray-800 text-gray-600'}`}
                  onClick={() => updateStep(idx, 'slide', !step.slide)}
                >
                  SLD
                </button>
                <button
                  className={`w-8 h-6 text-[10px] rounded font-bold transition-colors ${step.accent ? 'bg-white text-black shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'bg-gray-800 text-gray-600'}`}
                  onClick={() => updateStep(idx, 'accent', !step.accent)}
                >
                  ACC
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer / MIDI Monitor */}
      <div className="w-full max-w-5xl bg-black rounded-lg border border-gray-800 p-4 font-mono text-xs h-32 overflow-y-auto text-green-500 shadow-inner">
        <div className="text-gray-500 mb-2 font-bold sticky top-0 bg-black w-full border-b border-gray-900 pb-1 flex justify-between">
          <span>MIDI MONITOR // DEBUG CONSOLE</span>
          <span className="text-[10px] cursor-pointer hover:text-white" onClick={() => setMidiLogs([])}>CLEAR LOG</span>
        </div>
        {midiLogs.length === 0 && <div className="text-gray-700 italic">No events yet...</div>}
        {midiLogs.map((log, i) => (
          <div key={i} className="whitespace-nowrap hover:bg-gray-900">{log}</div>
        ))}
      </div>

    </div>
  );
}

export default App;
