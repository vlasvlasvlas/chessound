import { ChessEngine } from './chess-engine.js';
import { SoundEngine } from './sound-engine.js';
import { BoardUI } from './board-ui.js';
import { PawnSequencer } from './pawn-sequencer.js';
import { CLASSIC_GAMES } from './games.js';

const PIECES = ['k', 'q', 'r', 'b', 'n', 'p'];
const LAYERS = ['moves', 'drone', 'fx', 'pawnseq'];

class ChesSoundApp {
  constructor() {
    this.chessEngine = null;
    this.soundEngine = new SoundEngine();
    this.boardUI = null;
    this.pawnSequencer = null;
    this.playbackLoop = null;
    this.isPlaying = false;
    this.isEnding = false;
    this.currentGame = null;
    this.bpm = 120;
    this.scale = 'pentatonic_minor';
    this.root = 'C';
    this.playbackMode = 'playlist';
    this.gameMode = 'pgn';
    this.scores = { w: 0, b: 0, draw: 0 };
  }


  async init() {
    try {
      console.log('[ChesSound] Iniciando...');

      this.chessEngine = new ChessEngine();
      await this.soundEngine.init();
      this.soundEngine.setBPM(this.bpm);
      this.soundEngine.setScale(this.scale, this.root);

      this.boardUI = new BoardUI('board-container');
      this.boardUI.init();

      this.pawnSequencer = new PawnSequencer(this.soundEngine);
      this.pawnSequencer.init();
      this.pawnSequencer.setVolume(-12);
      this.pawnSequencer.onStep((color, index, hasPawn) => {
        this.boardUI.clearPawnHighlights();
        if (hasPawn) {
          const pawns = this.chessEngine.getPawnPositions();
          const file = String.fromCharCode(97 + index);
          const pawn = (color === 'white' ? pawns.white : pawns.black).find(p => p.file === file);
          if (pawn) this.boardUI.highlightPawnStep(pawn.square, color);
        }
        this._updateSequencerVisual(color, index);
      });

      this.selectedSquare = null;
      this.boardUI.onSquareClick(square => {
        if (this.gameMode === 'pgn' && this.isPlaying) {
          this._haltTransport();
        }
        
        // Prevent human playing computer's turn
        const turn = this.chessEngine.chess.turn();
        if ((this.gameMode === 'hvc' && turn === 'b') || this.gameMode === 'cvc') {
          return;
        }

        if (!this.selectedSquare) {
          const piece = this.chessEngine.chess.get(square);
          if (piece && piece.color === turn) {
            this.selectedSquare = square;
            this.boardUI.clearHighlights();
            this.boardUI.highlightSquare(square, 'origin');
          }
        } else {
          if (square === this.selectedSquare) {
            this.selectedSquare = null;
            this.boardUI.clearHighlights();
            return;
          }
          const moveInfo = this.chessEngine.makeManualMove(this.selectedSquare, square);
          this.selectedSquare = null;
          this.boardUI.clearHighlights();
          
          if (moveInfo) {
            this._updateGameInfo();
            this._updateMoveList();
            this._renderPosition(moveInfo);
            this.soundEngine.playMove(moveInfo);
          }
        }
      });

      this._populateGameSelector();
      this._bindControls();
      this._createPlaybackLoop();
      this.loadGame(CLASSIC_GAMES[0].id);

      document.getElementById('start-overlay').style.display = 'none';
      document.getElementById('app-container').classList.remove('hidden');
      console.log('[ChesSound] Listo!');
    } catch (err) {
      console.error('[ChesSound] Error:', err);
      alert('Error al inicializar: ' + err.message);
    }
  }

  _createPlaybackLoop() {
    this.playbackLoop = new Tone.Loop(time => this._advanceScheduled(time), '4n');
  }

  loadGame(gameId) {
    if (this.isPlaying) this._haltTransport();
    const game = CLASSIC_GAMES.find(g => g.id === gameId) || CLASSIC_GAMES[0];
    const result = this.chessEngine.loadGame(game.pgn);
    if (!result.success) { console.error('No se pudo cargar la partida'); return; }
    this.currentGame = game;
    this._updateGameInfo();
    this._updateMoveList();
    this._renderPosition();
  }

  loadCustomPGN(pgn) {
    if (this.isPlaying) this._haltTransport();
    const result = this.chessEngine.loadGame(pgn);
    if (!result.success) {
      alert('Error: No se pudo leer la notación. Asegurate de que sea PGN estándar válido.');
      return;
    }
    this.currentGame = {
      id: 'custom',
      nameEs: 'Partida Importada',
      name: 'Imported Game',
      year: new Date().getFullYear(),
      white: 'Blancas (Custom)',
      black: 'Negras (Custom)',
      result: '*'
    };
    document.getElementById('game-selector').value = '';
    this._updateGameInfo();
    this._updateMoveList();
    this._renderPosition();
  }

  async play() {
    if (this.isPlaying) return;
    await Tone.start();
    if (this.chessEngine.getCurrentMove() >= this.chessEngine.getTotalMoves()) {
      this.chessEngine.reset();
      this._renderPosition();
    }
    this.playbackLoop.start('4n');
    this.pawnSequencer.start();
    this.isPlaying = true;
    this.isEnding = false;
    const boardState = this.chessEngine.getBoardState();
    this.soundEngine.updateDrone(boardState);
    Tone.Transport.start('+0.05');
    this._updatePlayButton();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    Tone.Transport.pause();
    if (this.soundEngine.releaseDrone) this.soundEngine.releaseDrone();
    this._updatePlayButton();
  }

  stop() {
    this._haltTransport();
    this.chessEngine.reset();
    this.boardUI.clearHighlights();
    this.boardUI.clearPawnHighlights();
    this._renderPosition();
  }

  _haltTransport() {
    this.isPlaying = false;
    this.isEnding = false;
    this.playbackLoop.stop(0);
    this.pawnSequencer.stop();
    Tone.Transport.stop();
    Tone.Transport.position = '0:0:0';
    if (this.soundEngine.releaseDrone) this.soundEngine.releaseDrone();
    this._updatePlayButton();
  }

  stepForward() {
    if (this.isPlaying) this.pause();
    const moveInfo = this.chessEngine.stepForward();
    if (!moveInfo) return;
    this.soundEngine.playMove(moveInfo);
    const boardState = this.chessEngine.getBoardState();
    this.soundEngine.updateDrone(boardState);
    setTimeout(() => { if (this.soundEngine.releaseDrone) this.soundEngine.releaseDrone(); }, 900);
    this._renderPosition(moveInfo);
  }

  stepBackward() {
    if (this.isPlaying) this.pause();
    if (!this.chessEngine.stepBackward()) return;
    this.boardUI.clearHighlights();
    this._renderPosition();
  }

  goToMove(index) {
    if (this.isPlaying) this.pause();
    this.chessEngine.goToMove(index);
    this.boardUI.clearHighlights();
    this._renderPosition();
  }

  _advanceScheduled(time) {
    if (!this.isPlaying || this.isEnding) return;
    
    let moveInfo = null;
    const turn = this.chessEngine.chess.turn();

    if (this.gameMode === 'pgn') {
      moveInfo = this.chessEngine.stepForward();
    } else if (this.gameMode === 'cvc') {
      moveInfo = this.chessEngine.generateBotMove();
    } else if (this.gameMode === 'hvc' && turn === 'b') {
      moveInfo = this.chessEngine.generateBotMove();
    } else {
      // Waiting for human
      return;
    }

    if (!moveInfo) {
      if (this.gameMode !== 'pgn') {
        if (this.chessEngine.chess.in_checkmate()) {
          const winner = this.chessEngine.chess.turn() === 'b' ? 'w' : 'b';
          this.scores[winner]++;
        } else {
          this.scores.draw++;
        }
        
        // Generative modes restart automatically!
        this.chessEngine.reset();
        Tone.Draw.schedule(() => {
          this._updateGameInfo();
          this._renderPosition();
        }, time);
        return;
      }
      this.isEnding = true;
      // Update state immediately to prevent freezing if Tone.Draw drops frames
      this._finishPlaybackMode(time);
      return;
    }
    const boardState = this.chessEngine.getBoardState();
    this.soundEngine.playMove(moveInfo, time);
    this.soundEngine.updateDrone(boardState);
    this.pawnSequencer.update(this.chessEngine.getPawnPositions());
    Tone.Draw.schedule(() => this._renderPosition(moveInfo), time);
  }

  _finishPlaybackMode(time) {
    const mode = this.playbackMode;
    if (mode === 'loop') {
      this.chessEngine.reset();
      this.isEnding = false;
      Tone.Draw.schedule(() => this._renderPosition(), time);
      return;
    }
    if (mode === 'playlist') {
      const idx = CLASSIC_GAMES.findIndex(g => g.id === this.currentGame?.id);
      const next = CLASSIC_GAMES[idx >= 0 ? (idx + 1) % CLASSIC_GAMES.length : 0];
      const result = this.chessEngine.loadGame(next.pgn);
      if (result.success) {
        this.currentGame = next;
        Tone.Draw.schedule(() => {
          this._updateGameInfo();
          this._updateMoveList();
          const selector = document.getElementById('game-selector');
          if (selector) selector.value = next.id;
          this._renderPosition();
        }, time);
      }
      this.isEnding = false;
      return;
    }
    // mode === 'stop'
    this.isPlaying = false;
    this.isEnding = false;
    Tone.Transport.pause();
    if (this.soundEngine.releaseDrone) this.soundEngine.releaseDrone();
    Tone.Draw.schedule(() => this._updatePlayButton(), time);
  }

  _renderPosition(moveInfo = null) {
    const boardState = this.chessEngine.getBoardState();
    this.boardUI.render(boardState);
    if (moveInfo) {
      this._animateMove(moveInfo);
      this._signalPiece(moveInfo.piece);
    }
    this._updateProgress();
    this._highlightCurrentMove();
    this.pawnSequencer.update(this.chessEngine.getPawnPositions());
  }

  _signalPiece(piece) {
    const synthSelect = document.getElementById(`synth-piece-${piece}`);
    if (!synthSelect) return;
    const row = synthSelect.closest('.piece-row');
    if (!row) return;
    
    row.classList.add('is-sounding');
    setTimeout(() => {
      row.classList.remove('is-sounding');
    }, 400);
  }

  _animateMove(moveInfo) {
    this.boardUI.clearHighlights();
    this.boardUI.highlightSquare(moveInfo.from, 'origin');
    this.boardUI.highlightSquare(moveInfo.to, moveInfo.captured ? 'capture' : 'destination');
    if (moveInfo.isCheck || moveInfo.isCheckmate) {
      const kingColor = moveInfo.color === 'w' ? 'b' : 'w';
      const king = this.chessEngine.getBoardState().find(p => p.piece === 'k' && p.color === kingColor);
      if (king) this.boardUI.highlightSquare(king.square, 'check');
    }
  }

  _updateProgress() {
    const current = this.chessEngine.getCurrentMove();
    const total = this.chessEngine.getTotalMoves();
    const bar = document.getElementById('progress-bar');
    if (bar) { bar.value = current; bar.max = total; }
    const counter = document.getElementById('move-counter');
    if (counter) counter.textContent = `${current} / ${total}`;
  }

  _updateMoveList() {
    const container = document.getElementById('move-list');
    if (!container) return;
    const moves = this.chessEngine.getMoveList();
    container.innerHTML = '';
    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const num = document.createElement('span');
      num.className = 'move-number';
      num.textContent = `${Math.floor(i / 2) + 1}.`;
      row.appendChild(num);
      [i, i + 1].forEach(idx => {
        if (!moves[idx]) return;
        const btn = document.createElement('button');
        btn.className = 'move-san';
        btn.type = 'button';
        btn.dataset.moveIndex = String(idx + 1);
        btn.textContent = moves[idx];
        btn.addEventListener('click', () => this.goToMove(idx + 1));
        row.appendChild(btn);
      });
      container.appendChild(row);
    }
  }

  _highlightCurrentMove() {
    const current = this.chessEngine.getCurrentMove();
    document.querySelectorAll('.move-san').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.moveIndex) === current);
    });
    document.querySelector('.move-san.active')?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }

  _updateGameInfo() {
    const el = document.getElementById('game-info');
    if (!el) return;
    
    if (this.gameMode === 'pgn') {
      const game = this.currentGame;
      el.innerHTML = `<strong>${game.nameEs || game.name}</strong> (${game.year})<br>${game.white} vs ${game.black} — ${game.result}`;
    } else {
      let title = '';
      if (this.gameMode === 'cvc') title = 'PC vs PC (Música Generativa Infinita)';
      if (this.gameMode === 'hvc') title = 'Humano vs PC';
      if (this.gameMode === 'hvh') title = 'Humano vs Humano';
      
      el.innerHTML = `<strong>${title}</strong><br>Victorias Blancas: <strong>${this.scores.w}</strong> | Negras: <strong>${this.scores.b}</strong> | Tablas: <strong>${this.scores.draw}</strong>`;
    }
  }

  _populateGameSelector() {
    const sel = document.getElementById('game-selector');
    if (!sel) return;
    sel.innerHTML = '';
    CLASSIC_GAMES.forEach(game => {
      const opt = document.createElement('option');
      opt.value = game.id;
      opt.textContent = `${game.nameEs || game.name} (${game.year})`;
      sel.appendChild(opt);
    });
  }

  _updateSequencerVisual(color, index) {
    const prefix = color === 'white' ? 'w' : 'b';
    for (let i = 0; i < 8; i++) {
      document.getElementById(`seq-${prefix}-${i}`)?.classList.remove('seq-current');
    }
    document.getElementById(`seq-${prefix}-${index}`)?.classList.add('seq-current');
  }

  _updatePlayButton() {
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.textContent = this.isPlaying ? 'Ⅱ' : '▶';
      btn.title = this.isPlaying ? 'Pausar' : 'Reproducir';
    }
  }

  _bindControls() {
    document.getElementById('btn-play')?.addEventListener('click', () => this.isPlaying ? this.pause() : this.play());
    document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
    document.getElementById('btn-step-forward')?.addEventListener('click', () => this.stepForward());
    document.getElementById('btn-step-backward')?.addEventListener('click', () => this.stepBackward());
    document.getElementById('progress-bar')?.addEventListener('input', e => this.goToMove(Number(e.target.value)));

    document.getElementById('btn-load-pgn')?.addEventListener('click', () => {
      const pgn = document.getElementById('pgn-input').value;
      if (pgn.trim()) this.loadCustomPGN(pgn);
    });

    const infoModal = document.getElementById('info-modal');
    document.getElementById('btn-info')?.addEventListener('click', () => infoModal?.classList.remove('hidden'));
    document.getElementById('btn-close-modal')?.addEventListener('click', () => infoModal?.classList.add('hidden'));
    window.addEventListener('click', e => {
      if (e.target === infoModal) infoModal.classList.add('hidden');
    });

    document.getElementById('game-selector')?.addEventListener('change', e => this.loadGame(e.target.value));
    
    document.getElementById('game-mode')?.addEventListener('change', e => {
      this.gameMode = e.target.value;
      const selectorGroup = document.getElementById('game-selector-group');
      if (selectorGroup) {
        selectorGroup.style.display = this.gameMode === 'pgn' ? 'flex' : 'none';
      }
      this.chessEngine.reset();
      this._updateMoveList();
      this._updateGameInfo();
      this._renderPosition();
      
      if (this.gameMode !== 'pgn' && !this.isPlaying) {
        this.play();
      } else if (this.gameMode === 'pgn' && this.isPlaying) {
        this.pause();
      }
    });

    document.getElementById('view-mode')?.addEventListener('change', e => {
      if (e.target.value === 'visual') {
        document.body.classList.add('visual-mode');
        try { document.documentElement.requestFullscreen(); } catch (err) {}
      } else {
        document.body.classList.remove('visual-mode');
        try { document.exitFullscreen(); } catch (err) {}
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove('visual-mode');
        const viewMode = document.getElementById('view-mode');
        if (viewMode) viewMode.value = 'classic';
      }
    });

    document.getElementById('playback-mode')?.addEventListener('change', e => { this.playbackMode = e.target.value; });

    document.getElementById('root-selector')?.addEventListener('change', e => {
      this.root = e.target.value;
      this.soundEngine.setScale(this.scale, this.root);
    });
    document.getElementById('scale-selector')?.addEventListener('change', e => {
      this.scale = e.target.value;
      this.soundEngine.setScale(this.scale, this.root);
    });

    const bpmSlider = document.getElementById('bpm-slider');
    const bpmValue = document.getElementById('bpm-value');
    bpmSlider?.addEventListener('input', e => {
      this.bpm = Number(e.target.value);
      this.soundEngine.setBPM(this.bpm);
      if (bpmValue) bpmValue.textContent = this.bpm;
    });

    LAYERS.forEach(layer => {
      document.getElementById(`vol-${layer}`)?.addEventListener('input', e => {
        this.soundEngine.setLayerVolume(layer, parseFloat(e.target.value));
      });
      document.getElementById(`mute-${layer}`)?.addEventListener('click', function() {
        const muted = this.classList.toggle('muted');
        app.soundEngine.setLayerMute(layer, muted);
        if (layer === 'pawnseq') app.pawnSequencer.isMuted = muted;
      });
    });

    PIECES.forEach(piece => {
      document.getElementById(`synth-piece-${piece}`)?.addEventListener('change', e => {
        this.soundEngine.setPieceSynth(piece, e.target.value);
      });
      document.getElementById(`vol-piece-${piece}`)?.addEventListener('input', e => {
        this.soundEngine.setPieceVolume(piece, parseFloat(e.target.value));
      });
      document.getElementById(`mute-piece-${piece}`)?.addEventListener('click', function() {
        const muted = this.classList.toggle('muted');
        app.soundEngine.setPieceMute(piece, muted);
      });
    });
  }
}

const app = new ChesSoundApp();
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-start')?.addEventListener('click', () => app.init(), { once: true });
});
