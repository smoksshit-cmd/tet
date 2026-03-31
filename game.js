
const COLS = 8, ROWS = 8;
const COLORS = ['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#00bcd4','#ff5722'];

const PIECES = [
  [[1,1],[1,1]],                        // 2x2
  [[1,1,1]],                            // 1x3 H
  [[1],[1],[1]],                        // 1x3 V
  [[1,1,1,1]],                          // 1x4 H
  [[1],[1],[1],[1]],                    // 1x4 V
  [[1,1,1],[1,0,0]],                    // L
  [[1,1,1],[0,0,1]],                    // J
  [[1,0],[1,1],[0,1]],                  // S
  [[0,1],[1,1],[1,0]],                  // Z
  [[1,1,1],[0,1,0]],                    // T
  [[1]],                                // 1x1
  [[1,1]],                              // 1x2 H
  [[1],[1]],                            // 1x2 V
  [[1,0],[1,0],[1,1]],                  // corner
  [[0,1],[0,1],[1,1]],                  // corner2
  [[1,1],[1,0],[1,0]],                  // corner3
  [[1,1,1],[1,0,0],[1,0,0]],            // big L
];

let board, score, bestScore, pieces, selectedPiece, gameOver;

function init() {
  board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
  score = 0;
  gameOver = false;
  bestScore = parseInt(localStorage.getItem('bb_best') || '0');
  selectedPiece = null;
  document.getElementById('best').textContent = bestScore;
  document.getElementById('score').textContent = '0';
  document.getElementById('overlay').classList.remove('show');
  setMessage('Pick a piece and click a cell');
  renderBoard();
  spawnPieces();
}

function randInt(n) { return Math.floor(Math.random() * n); }

function randPiece() {
  const shape = PIECES[randInt(PIECES.length)];
  const color = COLORS[randInt(COLORS.length)];
  return { shape, color, used: false };
}

function spawnPieces() {
  pieces = [randPiece(), randPiece(), randPiece()];
  selectedPiece = null;
  renderPieces();
  if (!anyPieceFits()) endGame();
}

function anyPieceFits() {
  return pieces.some(p => !p.used && canPlaceAnywhere(p.shape));
}

function canPlaceAnywhere(shape) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (canPlace(shape, r, c)) return true;
  return false;
}

function canPlace(shape, row, col) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nr = row + r, nc = col + c;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return false;
      }
  return true;
}

function selectPiece(idx) {
  if (pieces[idx].used || gameOver) return;
  selectedPiece = idx;
  renderPieces();
  setMessage('Now click a cell on the board to place it');
}

function placePiece(row, col) {
  if (selectedPiece === null || gameOver) return;
  const p = pieces[selectedPiece];
  if (!canPlace(p.shape, row, col)) {
    setMessage("Can't place here!", 'bad');
    return;
  }
  for (let r = 0; r < p.shape.length; r++)
    for (let c = 0; c < p.shape[r].length; c++)
      if (p.shape[r][c]) board[row + r][col + c] = p.color;

  p.used = true;
  score += countCells(p.shape);
  const cleared = clearLines();
  score += cleared * 20;
  updateScore();
  renderBoard();
  renderPieces();
  selectedPiece = null;

  if (cleared > 0) setMessage(`+${cleared} line${cleared > 1 ? 's' : ''} cleared! 🎉`, 'good');
  else setMessage('Pick a piece and click a cell');

  if (pieces.every(p => p.used)) spawnPieces();
  else if (!anyPieceFits()) endGame();
}

function countCells(shape) {
  return shape.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0);
}

function clearLines() {
  let cleared = 0;
  const toFlash = new Set();

  for (let r = 0; r < ROWS; r++)
    if (board[r].every(v => v)) {
      for (let c = 0; c < COLS; c++) toFlash.add(`${r}-${c}`);
      cleared++;
    }

  for (let c = 0; c < COLS; c++)
    if (board.every(row => row[c])) {
      for (let r = 0; r < ROWS; r++) toFlash.add(`${r}-${c}`);
      cleared++;
    }

  if (toFlash.size) {
    flashCells(toFlash);
    toFlash.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      board[r][c] = 0;
    });
  }
  return cleared;
}

function flashCells(set) {
  set.forEach(key => {
    const [r, c] = key.split('-').map(Number);
    const el = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 300); }
  });
}

function updateScore() {
  document.getElementById('score').textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('bb_best', bestScore);
    document.getElementById('best').textContent = bestScore;
  }
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (board[r][c] ? ' filled' : '');
      if (board[r][c]) cell.style.background = board[r][c];
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('click', () => placePiece(r, c));
      cell.addEventListener('mouseenter', () => showGhost(r, c));
      cell.addEventListener('mouseleave', clearGhost);
      boardEl.appendChild(cell);
    }
}

function showGhost(row, col) {
  if (selectedPiece === null) return;
  const shape = pieces[selectedPiece].shape;
  const color = pieces[selectedPiece].color;
  if (!canPlace(shape, row, col)) return;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const el = document.querySelector(`[data-r="${row+r}"][data-c="${col+c}"]`);
        if (el) { el.classList.add('ghost', 'filled'); el.style.background = color; }
      }
}

function clearGhost() {
  document.querySelectorAll('.cell.ghost').forEach(el => {
    const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
    el.classList.remove('ghost', 'filled');
    el.style.background = board[r][c] || '';
    if (!board[r][c]) el.classList.remove('filled');
  });
}

function renderPieces() {
  pieces.forEach((p, i) => {
    const slot = document.getElementById(`slot-${i}`);
    slot.innerHTML = '';
    slot.className = 'piece-slot' + (p.used ? ' used' : '') + (selectedPiece === i ? ' dragging' : '');
    if (!p.used) {
      const grid = document.createElement('div');
      grid.className = 'piece-grid';
      grid.style.gridTemplateColumns = `repeat(${p.shape[0].length}, 20px)`;
      p.shape.forEach(row => row.forEach(v => {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        cell.style.background = v ? p.color : 'transparent';
        if (!v) cell.style.boxShadow = 'none';
        grid.appendChild(cell);
      }));
      slot.appendChild(grid);
    }
  });
}

function setMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = type || '';
}

function endGame() {
  gameOver = true;
  document.getElementById('final-score-text').textContent = `Score: ${score}  •  Best: ${bestScore}`;
  document.getElementById('overlay').classList.add('show');
}

function restartGame() { init(); }

init();
