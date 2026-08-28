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

  _evaluateBoard(chess) {
    let totalEvaluation = 0;
    const board = chess.board();
    const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
    const center = [
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,1,2,2,1,0,0],
      [0,0,1,2,2,1,0,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0]
    ];
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          let val = (values[piece.type] || 0) + center[i][j];
          totalEvaluation += (piece.color === 'w' ? val : -val);
        }
      }
    }
    return totalEvaluation;
  }

  _minimax(chess, depth, alpha, beta, isMaximizing) {
    if (depth === 0) {
      return this._evaluateBoard(chess);
    }
    
    const moves = chess.moves();
    
    // Quick game over check without heavy methods
    if (moves.length === 0) {
      if (chess.in_check()) return isMaximizing ? -9999 : 9999;
      return 0; // Draw/Stalemate
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < moves.length; i++) {
        chess.move(moves[i]);
        maxEval = Math.max(maxEval, this._minimax(chess, depth - 1, alpha, beta, false));
        chess.undo();
        alpha = Math.max(alpha, maxEval);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < moves.length; i++) {
        chess.move(moves[i]);
        minEval = Math.min(minEval, this._minimax(chess, depth - 1, alpha, beta, true));
        chess.undo();
        beta = Math.min(beta, minEval);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  generateBotMove() {
    if (this.chess.game_over()) return null;
    const moves = this.chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = null;
    const isMaximizing = this.chess.turn() === 'w';
    let bestValue = isMaximizing ? -Infinity : Infinity;

    // Shuffle moves to ensure varied games (not the exact same game every time)
    moves.sort(() => Math.random() - 0.5);

    // Depth 2 search (root loop + 1 depth in minimax)
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      this.chess.move(move.san);
      const boardValue = this._minimax(this.chess, 1, -Infinity, Infinity, !isMaximizing);
      this.chess.undo();

      if (isMaximizing) {
        if (boardValue > bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      } else {
        if (boardValue < bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      }
    }

    if (!bestMove) bestMove = moves[0];
    
    const moveResult = this.chess.move(bestMove.san);
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
