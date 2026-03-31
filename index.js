import { eventSource, event_types } from '../../../../script.js';

/* ========== КНОПКА ========== */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Block Blast';
document.body.appendChild(btn);

/* ========== ПАНЕЛЬ ========== */
const panel = document.createElement('div');
panel.className = 'bb-panel';
panel.innerHTML = `
<div class="bb-header">
  <span class="bb-title">⬛ Block Blast</span>
  <div class="bb-score-box">
    <div class="bb-score-label">Score</div>
    <div class="bb-score" id="bb-score">0</div>
  </div>
</div>
<div class="bb-best">Best: <span id="bb-best">0</span></div>
<div class="bb-board" id="bb-board">
  <div class="bb-over" id="bb-over">
    <h3>Game Over</h3>
    <p id="bb-final"></p>
    <button id="bb-again">Play Again</button>
  </div>
</div>
<div class="bb-msg" id="bb-msg">Select a piece, then click the board</div>
<div class="bb-pieces" id="bb-pieces">
  <div class="bb-slot" id="bb-s0"></div>
  <div class="bb-slot" id="bb-s1"></div>
  <div class="bb-slot" id="bb-s2"></div>
</div>
`;
document.body.appendChild(panel);

/* открытие/закрытие */
btn.addEventListener('click', () => panel.classList.toggle('open'));
document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn)
        panel.classList.remove('open');
});

/* === пульсация иконки во время генерации === */
eventSource.on(event_types.GENERATION_STARTED, () => btn.style.background = '#f5a623');
eventSource.on(event_types.GENERATION_ENDED,   () => btn.style.background = '');
eventSource.on(event_types.GENERATION_STOPPED, () => btn.style.background = '');

/* ========== ИГРА ========== */
const ROWS = 8, COLS = 8;
const COLORS = ['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#00bcd4','#ff5722','#e91e63'];
const SHAPES = [
    [[1,1],[1,1]],
    [[1,1,1]],          [[1],[1],[1]],
    [[1,1,1,1]],        [[1],[1],[1],[1]],
    [[1,1,1],[1,0,0]],  [[1,1,1],[0,0,1]],
    [[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]],
    [[1,1,1],[0,1,0]],
    [[1]],[[1,1]],[[1],[1]],
    [[1,0],[1,0],[1,1]], [[0,1],[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]],
];

let board, score, pieces, sel, dead;
let best = +localStorage.getItem('bb_best_v2') || 0;
panel.querySelector('#bb-best').textContent = best;

const rnd = n => Math.floor(Math.random() * n);
const cells = n => n.flat().reduce((a,v) => a+v, 0);

function canPlace(shape, row, col) {
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c] && (row+r >= ROWS || col+c >= COLS || board[row+r][col+c]))
                return false;
    return true;
}
function fitsAnywhere(shape) {
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (canPlace(shape, r, c)) return true;
    return false;
}

function newGame() {
    board = Array.from({length:ROWS}, () => Array(COLS).fill(null));
    score = 0; sel = null; dead = false;
    $('bb-score').textContent = '0';
    $('bb-over').classList.remove('show');
    msg('Select a piece, then click the board');
    drawBoard(); spawn();
}

function spawn() {
    pieces = [mkPiece(), mkPiece(), mkPiece()];
    sel = null; drawPieces();
    if (!pieces.some(p => fitsAnywhere(p.shape))) gameOver();
}

function mkPiece() {
    return { shape: SHAPES[rnd(SHAPES.length)], color: COLORS[rnd(COLORS.length)], used: false };
}

function pick(i) {
    if (pieces[i].used || dead) return;
    sel = i; drawPieces();
    msg('Click a cell to place it');
}

function place(row, col) {
    if (sel === null || dead) return;
    const p = pieces[sel];
    if (!canPlace(p.shape, row, col)) { msg("Can't place here!", 'bad'); return; }
    for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
            if (p.shape[r][c]) board[row+r][col+c] = p.color;
    p.used = true;
    score += cells(p.shape);
    const cleared = clearLines();
    score += cleared * 20;
    updateScore(); drawBoard(); drawPieces(); sel = null;
    if (cleared) msg(`+${cleared} line${cleared>1?'s':''} cleared! 🎉`, 'good');
    else msg('Select a piece, then click the board');
    if (pieces.every(p => p.used)) spawn();
    else if (!pieces.filter(p=>!p.used).some(p => fitsAnywhere(p.shape))) gameOver();
}

function clearLines() {
    const flash = new Set();
    for (let r = 0; r < ROWS; r++)
        if (board[r].every(v=>v)) for (let c = 0; c < COLS; c++) flash.add(`${r}_${c}`);
    for (let c = 0; c < COLS; c++)
        if (board.every(row=>row[c])) for (let r = 0; r < ROWS; r++) flash.add(`${r}_${c}`);
    flash.forEach(k => {
        const [r,c] = k.split('_').map(Number);
        const el = panel.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el) { el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),300); }
        board[r][c] = null;
    });
    return Math.round(flash.size / (ROWS + COLS - 1) * (flash.size > 0 ? 1 : 0)) ||
           (flash.size > 0 ? Math.ceil(flash.size / 8) : 0);
}

function updateScore() {
    $('bb-score').textContent = score;
    if (score > best) {
        best = score;
        localStorage.setItem('bb_best_v2', best);
        $('bb-best').textContent = best;
    }
}

function gameOver() {
    dead = true;
    $('bb-final').textContent = `Score: ${score}  •  Best: ${best}`;
    $('bb-over').classList.add('show');
}

function drawBoard() {
    const brd = $('bb-board');
    [...brd.querySelectorAll('.bb-cell')].forEach(el => el.remove());
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const el = document.createElement('div');
            el.className = 'bb-cell' + (board[r][c] ? ' filled' : '');
            if (board[r][c]) el.style.background = board[r][c];
            el.dataset.r = r; el.dataset.c = c;
            el.addEventListener('click', () => place(r, c));
            el.addEventListener('mouseenter', () => showGhost(r, c));
            el.addEventListener('mouseleave', clearGhost);
            brd.appendChild(el);
        }
}

function showGhost(row, col) {
    if (sel === null) return;
    const { shape, color } = pieces[sel];
    if (!canPlace(shape, row, col)) return;
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c]) {
                const el = panel.querySelector(`[data-r="${row+r}"][data-c="${col+c}"]`);
                if (el) { el.classList.add('ghost','filled'); el.style.background = color; }
            }
}
function clearGhost() {
    panel.querySelectorAll('.bb-cell.ghost').forEach(el => {
        const r = +el.dataset.r, c = +el.dataset.c;
        el.classList.remove('ghost','filled');
        el.style.background = board[r][c] || '';
        if (!board[r][c]) el.classList.remove('filled');
    });
}

function drawPieces() {
    for (let i = 0; i < 3; i++) {
        const slot = $(`bb-s${i}`);
        slot.innerHTML = '';
        const p = pieces[i];
        slot.className = 'bb-slot' + (p.used ? ' used' : '') + (sel===i ? ' selected' : '');
        slot.onclick = () => pick(i);
        if (!p.used) {
            const g = document.createElement('div');
            g.className = 'bb-pgrid';
            g.style.gridTemplateColumns = `repeat(${p.shape[0].length}, 18px)`;
            p.shape.forEach(row => row.forEach(v => {
                const cell = document.createElement('div');
                cell.className = 'bb-pcell';
                cell.style.background = v ? p.color : 'transparent';
                if (!v) cell.style.boxShadow = 'none';
                g.appendChild(cell);
            }));
            slot.appendChild(g);
        }
    }
}

function msg(text, type) {
    const el = $('bb-msg');
    el.textContent = text;
    el.className = 'bb-msg' + (type ? ` ${type}` : '');
}

function $(id) { return document.getElementById(id); }

$('bb-again').addEventListener('click', newGame);
newGame();

console.log('🎮 [BlockBlast] Ready!');
