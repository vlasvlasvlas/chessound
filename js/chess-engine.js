/**
 * ChessEngine wrapper for chess.js
 * Handles game state, PGN parsing, and navigation
 */
export class ChessEngine {
  constructor() {
    // Check for global Chess constructor (loaded via CDN)
    if (typeof window !== 'undefined' && window.Chess) {
      this.chess = new window.Chess();
    } else if (typeof Chess !== 'undefined') {
      this.chess = new Chess();
    } else {
      throw new Error('chess.js library not found. Please ensure it is loaded globally.');
    }
    
    this.moves = [];
    this.currentMoveIndex = 0;
  }

  /**
   * Load a game from a PGN string
   * @param {string} pgn - The PGN string
   * @returns {Object} { success, totalMoves }
   */
  loadGame(pgn) {
    this.reset();
    
    try {
      // chess.js v0.10.3 uses load_pgn, v1.x uses loadPgn
      const loadFn = this.chess.load_pgn || this.chess.loadPgn;
      if (!loadFn) {
        console.error('No PGN loading function found on chess.js instance');
        return { success: false, totalMoves: 0 };
      }
      
      const success = loadFn.call(this.chess, pgn, { sloppy: true });
      if (success === false) {
        console.error('Failed to parse PGN');
        return { success: false, totalMoves: 0 };
      }
      
      // Store all parsed moves with verbose info
      this.moves = this.chess.history({ verbose: true });
      
      // Reset position to the start
      this.chess.reset();
      this.currentMoveIndex = 0;
      
      return { 
        success: true, 
        totalMoves: this.moves.length 
      };
    } catch (error) {
      console.error('Error parsing PGN:', error);
      return { success: false, totalMoves: 0 };
    }
  }

  /**
   * Get the current half-move index
   * @returns {number}
   */
  getCurrentMove() {
    return this.currentMoveIndex;
  }

  /**
   * Get total number of half-moves in the loaded game
   * @returns {number}
   */
  getTotalMoves() {
    return this.moves.length;
  }

  /**
   * Advance one half-move
   * @returns {Object|null} Move info or null if at the end
   */
  stepForward() {
    if (this.currentMoveIndex >= this.moves.length) {
      return null;
    }
    
    const move = this.moves[this.currentMoveIndex];
    this.chess.move(move.san);
    
    this.currentMoveIndex++;
    return this._formatMoveInfo(move, this.currentMoveIndex);
  }

  /**
   * Go back one half-move
   * @returns {boolean} True if successful, false if at the beginning
   */
  stepBackward() {
    if (this.currentMoveIndex <= 0) {
      return false;
    }
    
    this.chess.undo();
    this.currentMoveIndex--;
    return true;
  }

  /**
   * Jump to a specific half-move index
   * @param {number} index - The target half-move index
   * @returns {Object|null} Move info of the target move, or null
   */
  goToMove(index) {
    if (index < 0 || index > this.moves.length) {
      return null;
    }
    
    if (index === this.currentMoveIndex) {
      return index > 0 ? this._formatMoveInfo(this.moves[index - 1], index) : null;
    }
    
    if (index > this.currentMoveIndex) {
      let lastMove = null;
      while (this.currentMoveIndex < index) {
        lastMove = this.stepForward();
      }
      return lastMove;
    } else {
      while (this.currentMoveIndex > index) {
        this.stepBackward();
      }
      return index > 0 ? this._formatMoveInfo(this.moves[index - 1], index) : null;
    }
  }

  /**
   * Reset the board to the starting position
   */
  reset() {
    this.chess.reset();
    this.currentMoveIndex = 0;
  }

  makeManualMove(from, to) {
    const move = this.chess.move({ from, to, promotion: 'q' });
    if (!move) return null;
    
    // Truncate future moves if we diverge from loaded game
    this.moves = this.moves.slice(0, this.currentMoveIndex);
    this.moves.push(move);
    this.currentMoveIndex++;
    return this._formatMoveInfo(move, this.currentMoveIndex);
  }

  generateBotMove() {
    if (this.chess.game_over()) return null;
    const moves = this.chess.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    // Very simple bot: check/capture randomly, else random move
    const aggressive = moves.filter(m => m.flags.includes('c') || m.san.includes('+') || m.san.includes('#'));
    let selectedMove;
    
    if (aggressive.length > 0 && Math.random() > 0.4) {
      selectedMove = aggressive[Math.floor(Math.random() * aggressive.length)];
    } else {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }
    
    const moveResult = this.chess.move(selectedMove.san);
    this.moves = this.moves.slice(0, this.currentMoveIndex);
    this.moves.push(moveResult);
    this.currentMoveIndex++;
    return this._formatMoveInfo(moveResult, this.currentMoveIndex);
  }

  /**
   * Get the current board state as an array of pieces
   * @returns {Array} Array of {piece, color, square}
   */
  getBoardState() {
    const boardMethod = this.chess.board ? 'board' : 'board';
    const board = this.chess[boardMethod]();
    const pieces = [];
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file];
        if (square) {
          pieces.push({
            piece: square.type,
            color: square.color,
            square: files[file] + (8 - rank)
          });
        }
      }
    }
    
    return pieces;
  }

  /**
   * Get positions of all pawns currently on the board
   * @returns {Object} { white: [], black: [] }
   */
  getPawnPositions() {
    const pawns = {
      w: [],
      b: []
    };
    
    const pieces = this.getBoardState();
    
    pieces.forEach(p => {
      if (p.piece === 'p') {
        pawns[p.color].push({
          square: p.square,
          file: p.square.charAt(0)
        });
      }
    });
    
    return {
      white: pawns.w,
      black: pawns.b
    };
  }

  /**
   * Get the full list of moves in SAN notation
   * @returns {Array<string>} Array of SAN strings
   */
  getMoveList() {
    return this.moves.map(m => m.san);
  }

  /**
   * Format a move object to a standardized moveInfo structure
   * @private
   */
  _formatMoveInfo(move, index) {
    const isCheckMethod = this.chess.inCheck ? 'inCheck' : 'in_check';
    const isCheckmateMethod = this.chess.isCheckmate ? 'isCheckmate' : 'in_checkmate';
    
    return {
      san: move.san,
      piece: move.piece,
      color: move.color,
      from: move.from,
      to: move.to,
      captured: move.captured || null,
      flags: move.flags,
      isCheck: typeof this.chess[isCheckMethod] === 'function' ? this.chess[isCheckMethod]() : false,
      isCheckmate: typeof this.chess[isCheckmateMethod] === 'function' ? this.chess[isCheckmateMethod]() : false,
      isCastling: move.flags.includes('k') || move.flags.includes('q'),
      isPromotion: move.flags.includes('p'),
      promotion: move.promotion || null,
      moveIndex: index
    };
  }
}
