export class BoardUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.highlightsLayer = null;
    this.piecesLayer = null;
    this.pieceNodes = [];
    this.pawnCursor = null;
    this.clickHandler = null;
    this.SQUARE_SIZE = 100;
    this.PIECE_SYMBOLS = {
      w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
      b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
    };
  }

  init() {
    this.container.replaceChildren();
    const svgNS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 800 800');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Tablero de la partida actual');

    const squaresLayer = document.createElementNS(svgNS, 'g');
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const square = document.createElementNS(svgNS, 'rect');
        square.setAttribute('x', column * this.SQUARE_SIZE);
        square.setAttribute('y', row * this.SQUARE_SIZE);
        square.setAttribute('width', this.SQUARE_SIZE);
        square.setAttribute('height', this.SQUARE_SIZE);
        square.setAttribute('class', (row + column) % 2 !== 0 ? 'board-square--light' : 'board-square--dark');
        square.dataset.square = `${String.fromCharCode(97 + column)}${8 - row}`;
        squaresLayer.appendChild(square);
      }
    }

    const coordinates = document.createElementNS(svgNS, 'g');
    coordinates.setAttribute('class', 'board-coordinate');
    for (let column = 0; column < 8; column += 1) {
      const file = document.createElementNS(svgNS, 'text');
      file.setAttribute('x', column * this.SQUARE_SIZE + 7);
      file.setAttribute('y', 792);
      file.textContent = String.fromCharCode(97 + column);
      coordinates.appendChild(file);
    }
    for (let row = 0; row < 8; row += 1) {
      const rank = document.createElementNS(svgNS, 'text');
      rank.setAttribute('x', 7);
      rank.setAttribute('y', row * this.SQUARE_SIZE + 17);
      rank.textContent = String(8 - row);
      coordinates.appendChild(rank);
    }

    this.highlightsLayer = document.createElementNS(svgNS, 'g');
    this.piecesLayer = document.createElementNS(svgNS, 'g');
    this.svg.append(squaresLayer, this.highlightsLayer, coordinates, this.piecesLayer);
    this.svg.addEventListener('click', event => {
      const square = event.target.closest?.('[data-square]')?.dataset.square;
      if (square && this.clickHandler) this.clickHandler(square);
    });
    this.container.appendChild(this.svg);
  }

  _squareToCoords(square) {
    return {
      x: (square.charCodeAt(0) - 97) * this.SQUARE_SIZE,
      y: (8 - Number(square.charAt(1))) * this.SQUARE_SIZE
    };
  }

  _createPieceNode() {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    node.setAttribute('text-anchor', 'middle');
    node.setAttribute('font-size', '49');
    node.setAttribute('font-family', 'Georgia, Times New Roman, serif');
    node.style.pointerEvents = 'none';
    this.piecesLayer.appendChild(node);
    this.pieceNodes.push(node);
    return node;
  }

  render(boardState) {
    boardState.forEach((item, index) => {
      const node = this.pieceNodes[index] || this._createPieceNode();
      const { x, y } = this._squareToCoords(item.square);
      node.setAttribute('x', x + this.SQUARE_SIZE / 2);
      node.setAttribute('y', y + this.SQUARE_SIZE / 2 + 17);
      node.setAttribute('class', item.color === 'w' ? 'board-piece--white' : 'board-piece--black');
      node.textContent = this.PIECE_SYMBOLS[item.color]?.[item.piece] || '?';
      node.hidden = false;
      node.style.display = '';
    });

    for (let index = boardState.length; index < this.pieceNodes.length; index += 1) {
      this.pieceNodes[index].style.display = 'none';
    }
  }

  highlightSquare(square, type) {
    const { x, y } = this._squareToCoords(square);
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    highlight.setAttribute('x', x);
    highlight.setAttribute('y', y);
    highlight.setAttribute('width', this.SQUARE_SIZE);
    highlight.setAttribute('height', this.SQUARE_SIZE);
    highlight.setAttribute('class', `highlight highlight-${type}`);

    const fills = {
      origin: 'rgba(255, 235, 100, 0.65)',
      destination: 'rgba(255, 235, 100, 0.45)',
      capture: 'rgba(235, 80, 80, 0.65)',
      check: 'rgba(235, 80, 80, 0.85)'
    };
    highlight.setAttribute('fill', fills[type] || fills.destination);
    this.highlightsLayer.appendChild(highlight);
  }

  clearHighlights() {
    this.highlightsLayer.querySelectorAll('.highlight').forEach(node => node.remove());
  }

  highlightPawnStep(square, color) {
    if (!this.pawnCursor) {
      this.pawnCursor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      this.pawnCursor.setAttribute('width', this.SQUARE_SIZE);
      this.pawnCursor.setAttribute('height', this.SQUARE_SIZE);
      this.pawnCursor.setAttribute('class', 'pawn-highlight');
      this.highlightsLayer.appendChild(this.pawnCursor);
    }
    const { x, y } = this._squareToCoords(square);
    this.pawnCursor.setAttribute('x', x);
    this.pawnCursor.setAttribute('y', y);
    this.pawnCursor.setAttribute('fill', color === 'white' ? 'rgba(232, 224, 208, .2)' : 'rgba(16, 22, 19, .2)');
    this.pawnCursor.style.display = '';
  }

  clearPawnHighlights() {
    if (this.pawnCursor) this.pawnCursor.style.display = 'none';
  }

  onSquareClick(callback) {
    this.clickHandler = callback;
    this.svg?.classList.toggle('is-interactive', Boolean(callback));
  }
}
