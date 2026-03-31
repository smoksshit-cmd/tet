import { eventSource, event_types } from '../../../../script.js';

console.log('🎮 [BlockBlast] Loading...');

const COLS = 8, ROWS = 8;
const COLORS = ['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#00bcd4','#ff5722','#e91e63'];
const PIECES = [
    [[1,1],[1,1]],
    [[1,1,1]],[[1],[1],[1]],
    [[1,1,1,1]],[[1],[1],[1],[1]],
    [[1,1,1],[1,0,0]],[[1,1,1],[0,0,1]],
    [[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]],
    [[1,1,1],[0,1,0]],
    [[1]],[[1,1]],[[1],[1]],
    [[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]],
];

// ── STATE ──────────────────────────────────────────────────────────────────
let board, score, pieces, selectedPiece, isGameOver;
let bestScore = parseInt(localStorage.getItem('bb_st_best') || '0');

// ── BUILD UI ───────────────────────────────────────────────────────────────
const trigger = document.createElement('div');
trigger.classList.add('bb--trigger', 'fa-solid', 'fa-fw', 'fa-gamepad');
trigger.title = 'Block Blast — click to play';
document.body.appendChild(trigger);

const panel = document.createElement('div');
panel.classList.add('bb--panel');
panel.innerHTML = `
  <div class="bb--header">
    <span class="bb--title">⬛ Block Blast</span>
    <div class="bb--score-wrap">
      <div class="bb--score-label">Score</div>
      <div class="bb--score" id="bb-score">0</div>
    </div>
  </div>
  <div class="bb--best">Best: <span id="bb-best">${bestScore}</span></div>
  <div class="bb--gen-badge" id="bb-gen">● Generating…</div>
  <div class="bb--panel-wrap">
    <div class="bb--board" id="bb-board"></div>
    <div class="bb--overlay" id="bb-overlay">
      <h3>Game Over</h3>
      <p id="bb-final"></p>
      <button id="bb-restart">Play Again</button>
    </div>
  </div>
  <div class="bb--msg" id="bb-msg">Pick a piece, then click a cell</div>
  <div class="bb--pieces" id="bb-pieces">
    <div class="bb--slot" id="bb-slot-0"></div>
    <div class="bb--slot" id="bb-slot-1"></div>
    <div class="bb--slot" id="bb-slot-2"></div>
  </div>
`;
document.body.appendChild(panel);

// ── DRAG TRIGGER ───────────────────────────────────────────────────────────
let isDragging = false, hasMoved = false, ox = 0, oy = 0;
const savedPos = (() => { try { return JSON.parse(localStorage.getItem('bb_st_pos')); } catch { return null; } })();
if (savedPos) {
    const lv = parseFloat(savedPos.x), tv = parseFloat(savedPos.y);
    if (!isNaN(lv) && !isNaN(tv) && lv >= 0 && lv < window.innerWidth - 50 && tv >= 0 && tv < window.innerHeight - 50) {
        trigger.style.left = savedPos.x; trigger.style.top = savedPos.y;
        trigger.style.bottom = ''; trigger.style.right = '';
    }
}
trigger.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isDragging = true; hasMoved = false;
    const r = trigger.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    trigger.style.opacity = '0.6'; e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    hasMoved = true;
    const nx = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - trigger.offsetWidth));
    const ny = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - trigger.offsetHeight));
    trigger.style.left = nx + 'px'; trigger.style.top = ny + 'px';
    trigger.style.bottom = ''; trigger.style.right = '';
});
document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false; trigger.style.opacity = '';
        if (hasMoved) localStorage.setItem('bb_st_pos', JSON.stringify({ x: trigger.style.left, y: trigger.style.top }));
    }
});

// ── PANEL TOGGLE ───────────────────────────────────────────────────────────
let justOpened = false;
function positionPanel() {
    const r = trigger.getBoundingClientRect();
    const pw = 330, ph = panel.offsetHeight || 480;
    let left = (r.right + 10 + pw <= window.innerWidth) ? r.right + 10
             : (r.left - 10 - pw >= 0) ? r.left - pw - 10
             : Math.max(10, (window.innerWidth - pw) / 2);
    let top = Math.max(10, Math.min(r.top, window.innerHeight - ph - 10));
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
}
trigger.addEventListener('click', e => {
    if (hasMoved) { hasMoved = false; return; }
    e.stopPropagation();
    panel.classList.toggle('bb--isActive');
    if (panel.classList.contains('bb--isActive')) {
        justOpened = true; positionPanel();
        setTimeout(() => justOpened = false, 300);
    }
});
document.addEventListener('click', e => {
    if (justOpened) return;
    if (!panel.contains(e.target) && !trigger.contains(e.target))
        panel.classList.remove('bb--isActive');
});
window.addEventListener('resize', () => { if (panel.classList.contains('bb--isActive')) positionPanel(); });

// ── GENERATION EVENTS ──────────────────────────────────────────────────────
const genBadge = panel.querySelector('#bb-gen');
eventSource.on(event_types.GENERATION_STARTED, () => {
    trigger.classList.add('bb--generating');
    genBadge.classList.add('bb--show');
    // Auto-open panel if closed
    if (!panel.classList.contains('bb--isActive')) {
        panel.classList.add('bb--isActive');
        justOpened = true; positionPanel();
        setTimeout(() => justOpened = false, 300);
    }
});
eventSource.on(event_types.GENERATION_ENDED, () => {
    trigger.classList.remove('bb--generating');
    genBadge.classList.remove('bb--show');
});
eventSource.on(event_types.GENERATION_STOPPED, () => {
    trigger.classList.remove('bb--generating');
    genBadge.classList.remove('bb--show');
});

// ── GAME LOGIC ─────────────────────────────────────────────────────────────
function rand(n) { return Math.floor(Math.random() * n); }
function randPiece() {
    return { shape: PIECES[rand(PIECES.length)], color: COLORS[rand(COLORS.length)], used: false };
}
function countCells(shape) { return shape.flat().reduce((a, v) => a + v, 0); }
function canPlace(shape, row, col) {
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c]) {
                const nr = row + r, nc = col + c;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return false;
            }
    return true;
}
function canPlaceAnywhere(shape) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canPlace(shape, r, c)) return true;
    return false;
}
function anyFits() { return pieces.some(p => !p.used && canPlaceAnywhere(p.shape)); }

function initGame() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    score = 0; isGameOver = false; selectedPiece = null;
    panel.querySelector('#bb-score').textContent = '0';
    panel.querySelector('#bb-overlay').classList.remove('bb--show');
    setMsg('Pick a piece, then click a cell');
    renderBoard(); spawnPieces();
}

function spawnPieces() {
    pieces = [randPiece(), randPiece(), randPiece()];
    selectedPiece = null; renderPieces();
    if (!anyFits()) endGame();
}

function selectPiece(i) {
    if (pieces[i].used || isGameOver) return;
    selectedPiece = i; renderPieces();
    setMsg('Click a cell on the board');
}

function placePiece(row, col) {
    if (selectedPiece === null || isGameOver) return;
    const p = pieces[selectedPiece];
    if (!canPlace(p.shape, row, col)) { setMsg("Can't place here!", 'bad'); return; }
    for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
            if (p.shape[r][c]) board[row + r][col + c] = p.color;
    p.used = true;
    score += countCells(p.shape);
    const cleared = clearLines();
    score += cleared * 20;
    updateScore(); renderBoard(); renderPieces();
    selectedPiece = null;
    if (cleared > 0) setMsg(`+${cleared} line${cleared > 1 ? 's' : ''} cleared! 🎉`, 'good');
    else setMsg('Pick a piece, then click a cell');
    if (pieces.every(p => p.used)) spawnPieces();
    else if (!anyFits()) endGame();
}

function clearLines() {
    let cleared = 0;
    const toFlash = new Set();
    for (let r = 0; r < ROWS; r++) if (board[r].every(v => v)) { for (let c = 0; c < COLS; c++) toFlash.add(`${r}-${c}`); cleared++; }
    for (let c = 0; c < COLS; c++) if (board.every(row => row[c])) { for (let r = 0; r < ROWS; r++) toFlash.add(`${r}-${c}`); cleared++; }
    if (toFlash.size) {
        toFlash.forEach(k => {
            const [r, c] = k.split('-').map(Number);
            const el = panel.querySelector(`[data-r="${r}"][data-c="${c}"]`);
            if (el) { el.classList.add('bb--flash'); setTimeout(() => el.classList.remove('bb--flash'), 300); }
            board[r][c] = 0;
        });
    }
    return cleared;
}

function updateScore() {
    panel.querySelector('#bb-score').textContent = score;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bb_st_best', bestScore);
        panel.querySelector('#bb-best').textContent = bestScore;
    }
}

function endGame() {
    isGameOver = true;
    panel.querySelector('#bb-final').textContent = `Score: ${score}  •  Best: ${bestScore}`;
    panel.querySelector('#bb-overlay').classList.add('bb--show');
}

function renderBoard() {
    const boardEl = panel.querySelector('#bb-board');
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'bb--cell' + (board[r][c] ? ' bb--filled' : '');
            if (board[r][c]) cell.style.background = board[r][c];
            cell.dataset.r = r; cell.dataset.c = c;
            cell.addEventListener('click', () => placePiece(r, c));
            cell.addEventListener('mouseenter', () => showGhost(r, c));
            cell.addEventListener('mouseleave', clearGhost);
            boardEl.appendChild(cell);
        }
}

function showGhost(row, col) {
    if (selectedPiece === null) return;
    const { shape, color } = pieces[selectedPiece];
    if (!canPlace(shape, row, col)) return;
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c]) {
                const el = panel.querySelector(`[data-r="${row+r}"][data-c="${col+c}"]`);
                if (el) { el.classList.add('bb--ghost', 'bb--filled'); el.style.background = color; }
            }
}
function clearGhost() {
    panel.querySelectorAll('.bb--cell.bb--ghost').forEach(el => {
        const r = +el.dataset.r, c = +el.dataset.c;
        el.classList.remove('bb--ghost', 'bb--filled');
        el.style.background = board[r][c] || '';
        if (!board[r][c]) el.classList.remove('bb--filled');
    });
}

function renderPieces() {
    pieces.forEach((p, i) => {
        const slot = panel.querySelector(`#bb-slot-${i}`);
        slot.innerHTML = '';
        slot.className = 'bb--slot' + (p.used ? ' bb--used' : '') + (selectedPiece === i ? ' bb--selected' : '');
        slot.onclick = () => selectPiece(i);
        if (!p.used) {
            const grid = document.createElement('div');
            grid.className = 'bb--piece-grid';
            grid.style.gridTemplateColumns = `repeat(${p.shape[0].length}, 18px)`;
            p.shape.forEach(row => row.forEach(v => {
                const cell = document.createElement('div');
                cell.className = 'bb--piece-cell';
                cell.style.background = v ? p.color : 'transparent';
                if (!v) cell.style.boxShadow = 'none';
                grid.appendChild(cell);
            }));
            slot.appendChild(grid);
        }
    });
}

function setMsg(text, type) {
    const el = panel.querySelector('#bb-msg');
    el.textContent = text; el.className = 'bb--msg' + (type ? ` ${type}` : '');
}

panel.querySelector('#bb-restart').addEventListener('click', initGame);

initGame();
console.log('🎮 [BlockBlast] Loaded!');
