/**
 * Tonal sound engine for ChessSynth.
 * Every source shares one clock, one scale and one protected master output.
 */

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10]
};

const MAJOR_MODES = new Set(['major', 'pentatonic_major']);

const PIECE_PROFILES = {
  k: { octave: 2, duration: '4n', velocity: 0.54 },
  q: { octave: 3, duration: '4n', velocity: 0.47 },
  r: { octave: 2, duration: '4n', velocity: 0.62 },
  b: { octave: 3, duration: '8n', velocity: 0.42 },
  n: { octave: 3, duration: '16n', velocity: 0.56 },
  p: { octave: 2, duration: '16n', velocity: 0.48 }
};

const DEFAULT_SYNTHS = {
  k: 'fm',
  q: 'poly',
  r: 'mono',
  b: 'am',
  n: 'pluck',
  p: 'membrane'
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export class SoundEngine {
  constructor() {
    this.isInitialized = false;
    this.scaleName = 'dorian';
    this.rootNote = 'D';
    this.intensity = 0.72;
    this.droneAmount = 0.55;

    this.masterBus = null;
    this.movesBus = null;
    this.droneBus = null;
    this.fxBus = null;
    this.pawnBus = null;
    this.limiter = null;
    this.reverb = null;

    this.droneFilter = null;
    this.captureFilter = null;
    this.captureNoise = null;
    this.checkSynth = null;
    this.finalSynth = null;
    this.droneSynth = null;

    this.pieceSynths = {};
    this.pieceSynthNames = {};
    this.pieceChannels = {};
    this.currentDroneNotes = [];
    this.lastBoardState = [];
    this.lastTension = 0.18;
  }

  async init() {
    if (typeof Tone === 'undefined') {
      throw new Error('Tone.js no pudo cargarse. Revisá la conexión e intentá de nuevo.');
    }
    if (this.isInitialized) return;

    await Tone.start();

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterBus = new Tone.Channel({ volume: -3 }).connect(this.limiter);
    
    // Configuración de Reverb en Paralelo (Envío / Send) de alta calidad
    this.reverb = new Tone.Reverb({ decay: 5.5, preDelay: 0.02, wet: 1 }).connect(this.masterBus);
    this.reverbSend = new Tone.Volume(-15).connect(this.reverb);

    // Los buses van directo al Master (señal limpia) y también al Envío de Reverb
    this.movesBus = new Tone.Channel({ volume: -5 }).connect(this.masterBus).connect(this.reverbSend);
    this.droneBus = new Tone.Channel({ volume: -22 }).connect(this.masterBus).connect(this.reverbSend);
    this.fxBus = new Tone.Channel({ volume: -10 }).connect(this.masterBus).connect(this.reverbSend);
    this.pawnBus = new Tone.Channel({ volume: -18 }).connect(this.masterBus).connect(this.reverbSend);

    this.droneFilter = new Tone.Filter({ frequency: 480, type: 'lowpass', rolloff: -24, Q: 0.6 }).connect(this.droneBus);
    this.captureFilter = new Tone.Filter({ frequency: 1250, type: 'bandpass', rolloff: -12, Q: 0.75 }).connect(this.fxBus);

    this.captureNoise = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 }
    }).connect(this.fxBus);

    this.checkSynth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 1.25,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.008, decay: 0.22, sustain: 0.08, release: 1.1 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.16, sustain: 0, release: 0.4 }
    }).connect(this.fxBus);

    this.finalSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.04, decay: 0.4, sustain: 0.45, release: 2.8 }
    }).connect(this.fxBus);

    this.droneSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.6, decay: 0.2, sustain: 0.82, release: 2.8 }
    }).connect(this.droneFilter);

    for (const piece of Object.keys(DEFAULT_SYNTHS)) {
      this.pieceChannels[piece] = new Tone.Channel().connect(this.movesBus);
    }

    this.isInitialized = true;

    for (const [piece, synthName] of Object.entries(DEFAULT_SYNTHS)) {
      this.setPieceSynth(piece, synthName);
    }

    try {
      await this.reverb.generate();
    } catch (error) {
      console.warn('[ChessSynth] La reverberación usará su respuesta por defecto.', error);
    }
  }

  _createSynthInstance(synthName) {
    switch (synthName) {
      case 'fm':
        return new Tone.FMSynth({
          harmonicity: 1.5,
          modulationIndex: 1.8,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.025, decay: 0.3, sustain: 0.22, release: 1.4 },
          modulation: { type: 'sine' },
          modulationEnvelope: { attack: 0.04, decay: 0.22, sustain: 0.08, release: 0.9 }
        });
      case 'poly':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle8' },
          envelope: { attack: 0.035, decay: 0.28, sustain: 0.28, release: 1.55 }
        });
      case 'mono':
        return new Tone.MonoSynth({
          oscillator: { type: 'square4' },
          envelope: { attack: 0.012, decay: 0.28, sustain: 0.16, release: 0.65 },
          filter: { Q: 1.2, type: 'lowpass', rolloff: -24 },
          filterEnvelope: { attack: 0.025, decay: 0.22, sustain: 0.12, release: 0.5, baseFrequency: 110, octaves: 2.6 }
        });
      case 'am':
        return new Tone.AMSynth({
          harmonicity: 1.5,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.055, decay: 0.18, sustain: 0.3, release: 1.1 },
          modulation: { type: 'triangle' },
          modulationEnvelope: { attack: 0.09, decay: 0.18, sustain: 0.18, release: 0.9 }
        });
      case 'pluck':
        return new Tone.PluckSynth({ attackNoise: 0.65, dampening: 2900, resonance: 0.87, release: 1.1 });
      case 'membrane':
        return new Tone.MembraneSynth({
          pitchDecay: 0.035,
          octaves: 1.5,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.09 }
        });
      case 'synth':
      default:
        return new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.025, decay: 0.2, sustain: 0.22, release: 1 }
        });
    }
  }

  setPieceSynth(pieceType, synthName) {
    if (!this.isInitialized || !this.pieceChannels[pieceType]) return;
    if (this.pieceSynthNames[pieceType] === synthName && this.pieceSynths[pieceType]) return;

    const nextSynth = this._createSynthInstance(synthName).connect(this.pieceChannels[pieceType]);
    this.pieceSynths[pieceType]?.dispose();
    this.pieceSynths[pieceType] = nextSynth;
    this.pieceSynthNames[pieceType] = synthName;
  }

  setScale(scaleName, rootNote = this.rootNote) {
    if (SCALES[scaleName]) this.scaleName = scaleName;
    if (/^[A-G](#)?$/.test(rootNote)) this.rootNote = rootNote;
    this.releaseDrone();
  }

  setBPM(bpm) {
    if (!Number.isFinite(Number(bpm)) || typeof Tone === 'undefined') return;
    Tone.Transport.bpm.rampTo(clamp(Number(bpm), 30, 220), 0.08);
  }

  setMasterVolume(db) {
    if (this.masterBus) this.masterBus.volume.rampTo(Number(db), 0.08);
  }

  setIntensity(value) {
    this.intensity = clamp(Number(value) > 1 ? Number(value) / 100 : Number(value), 0.2, 1);
  }

  setAmbience(value) {
    const val = clamp(Number(value), 0, 100);
    if (this.reverbSend) {
      if (val === 0) {
        this.reverbSend.volume.rampTo(-Infinity, 0.1);
      } else {
        // Map 1-100 to -40dB to +6dB roughly for the send effect
        const db = -40 + (val / 100) * 46;
        this.reverbSend.volume.rampTo(db, 0.1);
      }
    }
  }

  setDroneAmount(value) {
    this.droneAmount = clamp(Number(value) > 1 ? Number(value) / 100 : Number(value));
    if (this.droneAmount < 0.01) this.releaseDrone();
  }

  _degreeToNote(degree, octave) {
    const intervals = SCALES[this.scaleName] || SCALES.dorian;
    const wrappedDegree = ((degree % intervals.length) + intervals.length) % intervals.length;
    const octaveCarry = Math.floor(degree / intervals.length);
    const semitones = intervals[wrappedDegree] + (octaveCarry * 12);
    return Tone.Frequency(`${this.rootNote}${octave}`).transpose(semitones).toNote();
  }

  squareToNote(square, pieceType = 'q', transposeOctaves = 0) {
    const fileIndex = square.charCodeAt(0) - 97;
    const rank = Number(square.charAt(1));
    const profile = PIECE_PROFILES[pieceType] || PIECE_PROFILES.q;
    const rankShift = rank >= 5 ? 1 : 0;
    return this._degreeToNote(fileIndex, profile.octave + rankShift + transposeOctaves);
  }

  _squareChord(square) {
    const fileIndex = square.charCodeAt(0) - 97;
    const rankShift = Number(square.charAt(1)) >= 5 ? 1 : 0;
    const octave = PIECE_PROFILES.q.octave + rankShift;
    return [0, 2, 4].map(offset => this._degreeToNote(fileIndex + offset, octave));
  }

  _trigger(synth, note, duration, time, velocity) {
    if (!synth) return;
    synth.triggerAttackRelease(note, duration, time, clamp(velocity, 0.03, 0.95));
  }

  playMove(moveInfo, time = Tone.now(), context = {}) {
    if (!this.isInitialized) return null;

    const { piece, color, from, to, captured, isCheck, isCheckmate, isCastling, isPromotion } = moveInfo;
    const profile = PIECE_PROFILES[piece] || PIECE_PROFILES.p;
    const synth = this.pieceSynths[piece];
    if (!synth) return null;

    const progress = clamp(context.progress || 0);
    const phaseShape = 0.82 + (Math.sin(progress * Math.PI) * 0.18);
    const eventWeight = 1 + (captured ? 0.12 : 0) + (isCheck ? 0.12 : 0) + (isCheckmate ? 0.2 : 0);
    const velocity = clamp(profile.velocity * this.intensity * phaseShape * eventWeight, 0.08, 0.92);
    const destinationNote = this.squareToNote(to, piece);
    const originNote = this.squareToNote(from, piece);

    this.pieceChannels[piece].pan.rampTo(((to.charCodeAt(0) - 97) / 7 - 0.5) * 0.62 + (color === 'w' ? -0.05 : 0.05), 0.04);

    try {
      if (piece === 'q' && this.pieceSynthNames.q === 'poly') {
        this._trigger(synth, this._squareChord(to), profile.duration, time, velocity * 0.8);
      } else if (piece === 'n' || piece === 'b') {
        this._trigger(synth, originNote, '32n', time, velocity * 0.48);
        this._trigger(synth, destinationNote, profile.duration, time + 0.065, velocity);
      } else if (piece === 'k') {
        this._trigger(synth, originNote, '16n', time, velocity * 0.5);
        this._trigger(synth, destinationNote, profile.duration, time + 0.085, velocity);
      } else {
        this._trigger(synth, destinationNote, profile.duration, time, velocity);
      }

      if (isCastling) {
        const rank = to.charAt(1);
        const rookDestination = `${to.charAt(0) === 'g' ? 'f' : 'd'}${rank}`;
        this._trigger(this.pieceSynths.r, this.squareToNote(rookDestination, 'r'), '4n', time + 0.13, velocity * 0.75);
      }

      if (captured) {
        this.captureNoise.triggerAttackRelease('C1', '8n', time, clamp(velocity * 1.5, 0.4, 0.9));
      }

      if (isCheck || isPromotion) {
        const signalNote = this._degreeToNote(4, 5);
        this.checkSynth.triggerAttackRelease(signalNote, isCheckmate ? '4n' : '16n', time + 0.11, velocity * 0.62);
      }

      if (isCheckmate) {
        const quality = MAJOR_MODES.has(this.scaleName) ? [0, 4, 7, 14] : [0, 3, 7, 14];
        const chord = quality.map(interval => Tone.Frequency(`${this.rootNote}3`).transpose(interval).toNote());
        this.finalSynth.triggerAttackRelease(chord, '1m', time + 0.2, clamp(velocity * 0.8, 0.2, 0.72));
      }
    } catch (error) {
      console.warn('[ChessSynth] No se pudo reproducir el movimiento.', error);
    }

    return {
      note: destinationNote,
      notes: piece === 'q' && this.pieceSynthNames.q === 'poly' ? this._squareChord(to) : [destinationNote],
      velocity: Math.round(velocity * 100)
    };
  }

  calculateTension(boardState, progress = 0) {
    const centerWeights = {
      d4: 1, e4: 1, d5: 1, e5: 1,
      c3: 0.22, d3: 0.3, e3: 0.3, f3: 0.22,
      c4: 0.3, f4: 0.3, c5: 0.3, f5: 0.3,
      c6: 0.22, d6: 0.3, e6: 0.3, f6: 0.22
    };
    const centerPressure = boardState.reduce((sum, item) => sum + (centerWeights[item.square] || 0), 0);
    const materialLoss = clamp((32 - boardState.length) / 22);
    const development = Math.sin(clamp(progress) * Math.PI);
    return clamp(0.1 + (centerPressure / 7) * 0.5 + materialLoss * 0.3 + development * 0.12, 0.08, 1);
  }

  updateDrone(boardState, context = {}, time = Tone.now()) {
    if (!this.isInitialized || !this.droneSynth) return 0;

    this.lastBoardState = boardState;
    const tension = this.calculateTension(boardState, context.progress || 0);
    this.lastTension = tension;

    if (this.droneAmount < 0.01) {
      this.releaseDrone(time);
      return tension;
    }

    const triad = MAJOR_MODES.has(this.scaleName) ? [0, 4, 7] : [0, 3, 7];
    const root = `${this.rootNote}2`;
    const targetIntervals = [triad[0], triad[2]];
    if (tension > 0.28) targetIntervals.push(triad[1] + 12);
    if (tension > 0.62) targetIntervals.push(14);
    if (tension > 0.82) targetIntervals.push(19);

    const targetNotes = [...new Set(targetIntervals.map(interval => Tone.Frequency(root).transpose(interval).toNote()))];
    const release = this.currentDroneNotes.filter(note => !targetNotes.includes(note));
    const attack = targetNotes.filter(note => !this.currentDroneNotes.includes(note));

    if (release.length) this.droneSynth.triggerRelease(release, time);
    if (attack.length) this.droneSynth.triggerAttack(attack, time, clamp(0.12 + this.droneAmount * 0.18, 0.08, 0.32));

    const cutoff = 220 + (tension * 780) + (this.droneAmount * 250);
    this.droneFilter.frequency.linearRampToValueAtTime(cutoff, time + 0.35);
    this.currentDroneNotes = targetNotes;
    return tension;
  }

  releaseDrone(time = Tone.now()) {
    if (this.droneSynth && this.currentDroneNotes.length) {
      this.droneSynth.triggerRelease(this.currentDroneNotes, time);
    }
    this.currentDroneNotes = [];
  }

  setLayerVolume(layer, db) {
    const bus = { moves: this.movesBus, drone: this.droneBus, fx: this.fxBus, pawnseq: this.pawnBus }[layer];
    if (bus) bus.volume.rampTo(Number(db), 0.06);
  }

  setLayerMute(layer, muted) {
    const bus = { moves: this.movesBus, drone: this.droneBus, fx: this.fxBus, pawnseq: this.pawnBus }[layer];
    if (bus) bus.mute = Boolean(muted);
  }

  setPieceVolume(pieceType, db) {
    if (this.pieceChannels[pieceType]) this.pieceChannels[pieceType].volume.rampTo(Number(db), 0.05);
  }

  setPieceMute(pieceType, muted) {
    if (this.pieceChannels[pieceType]) this.pieceChannels[pieceType].mute = Boolean(muted);
  }

  getPawnInput() {
    return this.pawnBus;
  }

  dispose() {
    if (!this.isInitialized) return;
    this.releaseDrone();
    [this.droneSynth, this.captureNoise, this.checkSynth, this.finalSynth,
      this.droneFilter, this.captureFilter, this.reverb,
      ...Object.values(this.pieceSynths), ...Object.values(this.pieceChannels),
      this.movesBus, this.droneBus, this.fxBus, this.pawnBus,
      this.masterBus, this.limiter].forEach(node => node?.dispose());
    this.isInitialized = false;
  }
}
