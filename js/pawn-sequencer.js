/**
 * Sixteen-step pawn sequencer. Pawn files define the step, their rank defines
 * a scale-aware pitch, and advancement controls velocity.
 */
export class PawnSequencer {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    this.whiteSteps = Array(8).fill(null);
    this.blackSteps = Array(8).fill(null);
    this.currentStep = { white: -1, black: -1 };
    this.stepCallback = null;
    this.density = 0.68;
    this.isMuted = false;
    this.initialized = false;
    this.isScheduled = false;
    this.channel = null;
    this.whiteFilter = null;
    this.blackFilter = null;
    this.whiteSynth = null;
    this.blackSynth = null;
    this.sequence = null;
  }

  init() {
    if (this.initialized) return;
    const destination = this.soundEngine.getPawnInput();
    if (!destination) throw new Error('La ruta de audio de peones no está disponible.');

    this.channel = new Tone.Channel({ volume: 0 }).connect(destination);
    this.whiteFilter = new Tone.Filter({ frequency: 900, type: 'lowpass', rolloff: -12, Q: 0.65 }).connect(this.channel);
    this.blackFilter = new Tone.Filter({ frequency: 900, type: 'lowpass', rolloff: -12, Q: 0.65 }).connect(this.channel);
    this.whiteSynth = new Tone.Synth({
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.002, decay: 0.065, sustain: 0, release: 0.07 }
    }).connect(this.whiteFilter);
    this.blackSynth = new Tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 1.2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.06 }
    }).connect(this.blackFilter);

    const events = [];
    for (let index = 0; index < 8; index += 1) {
      events.push({ color: 'white', index });
      events.push({ color: 'black', index });
    }

    this.sequence = new Tone.Sequence((time, event) => {
      this._triggerStep(event.color, event.index, time);
    }, events, '16n');
    this.sequence.humanize = 0.006;
    this.initialized = true;
  }

  update(pawnPositions) {
    this.whiteSteps.fill(null);
    this.blackSteps.fill(null);
    this._mapPawns(pawnPositions.white, this.whiteSteps);
    this._mapPawns(pawnPositions.black, this.blackSteps);
  }

  _mapPawns(pawns = [], target) {
    pawns.forEach(pawn => {
      const file = typeof pawn.file === 'string' ? pawn.file.charCodeAt(0) - 97 : pawn.file;
      if (file < 0 || file > 7) return;
      target[file] = { square: pawn.square, rank: Number(pawn.square.charAt(1)) };
    });
  }

  _passesDensity(color, index) {
    const pattern = color === 'white'
      ? [0.08, 0.74, 0.42, 0.9, 0.22, 0.62, 0.36, 0.82]
      : [0.52, 0.18, 0.86, 0.32, 0.7, 0.12, 0.94, 0.46];
    return pattern[index] <= this.density;
  }

  _triggerStep(color, index, time) {
    const isWhite = color === 'white';
    const stepData = isWhite ? this.whiteSteps[index] : this.blackSteps[index];
    const synth = isWhite ? this.whiteSynth : this.blackSynth;
    this.currentStep[color] = index;

    const hasPawn = Boolean(stepData);
    const shouldPlay = hasPawn && !this.isMuted && this._passesDensity(color, index);

    if (shouldPlay) {
      const advancement = isWhite
        ? Math.max(0, stepData.rank - 2) / 6
        : Math.max(0, 7 - stepData.rank) / 6;
      const accent = index % 4 === 0 ? 0.08 : 0;
      const velocity = Math.min(0.5, 0.14 + advancement * 0.2 + accent);
      const note = this.soundEngine.squareToNote(stepData.square, 'p', isWhite ? 0 : -1);
      const filter = isWhite ? this.whiteFilter : this.blackFilter;
      this.soundEngine.applyRankFilter(filter, stepData.square, time);
      synth.triggerAttackRelease(note, '32n', time, velocity);
    }

    if (this.stepCallback) {
      Tone.Draw.schedule(() => this.stepCallback(color, index, hasPawn, shouldPlay), time);
    }
  }

  start() {
    if (this.sequence && !this.isScheduled) {
      this.sequence.start(0);
      this.isScheduled = true;
    }
  }

  stop() {
    if (this.sequence && this.isScheduled) {
      this.sequence.stop(0);
      this.isScheduled = false;
    }
    this.currentStep = { white: -1, black: -1 };
  }

  setVolume(db) {
    this.soundEngine.setLayerVolume('pawnseq', db);
  }

  setMute(muted) {
    this.isMuted = Boolean(muted);
    this.soundEngine.setLayerMute('pawnseq', muted);
  }

  setDensity(value) {
    this.density = Math.min(1, Math.max(0.2, Number(value) > 1 ? Number(value) / 100 : Number(value)));
  }

  setSwing(value) {
    const normalized = Math.min(0.45, Math.max(0, Number(value) > 1 ? Number(value) / 100 : Number(value)));
    Tone.Transport.swing = normalized;
    Tone.Transport.swingSubdivision = '16n';
  }

  onStep(callback) {
    this.stepCallback = callback;
  }

  dispose() {
    this.stop();
    [this.sequence, this.whiteSynth, this.blackSynth, this.whiteFilter, this.blackFilter, this.channel]
      .forEach(node => node?.dispose());
    this.sequence = null;
    this.whiteSynth = null;
    this.blackSynth = null;
    this.whiteFilter = null;
    this.blackFilter = null;
    this.channel = null;
    this.initialized = false;
  }
}
