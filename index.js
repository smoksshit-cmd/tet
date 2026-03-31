import { eventSource, event_types } from '../../../../script.js';

/* ========== КНОПКА (перетаскиваемая) ========== */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Block Blast';
document.body.appendChild(btn);

// Восстановить позицию
const savedPos = (() => { try { return JSON.parse(localStorage.getItem('bb_btn_pos')); } catch { return null; } })();
if (savedPos) {
    btn.style.bottom = ''; btn.style.right = '';
    btn.style.top = savedPos.top; btn.style.left = savedPos.left;
} 

// Drag
let dragging = false, moved = false, ox = 0, oy = 0;

btn.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true; moved = false;
    const r = btn.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'grabbing';
    e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!dragging) return;
    moved = true;
    const nx = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - btn.offsetWidth));
    const ny = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - btn.offsetHeight));
    btn.style.left = nx + 'px'; btn.style.top = ny + 'px';
    btn.style.right = ''; btn.style.bottom = '';
    e.preventDefault();
});
document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    btn.style.opacity = ''; btn.style.cursor = '';
    if (moved) {
        localStorage.setItem('bb_btn_pos', JSON.stringify({ top: btn.style.top, left: btn.style.left }));
        moved = false;
    }
});

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
<div class="bb-board-wrap">
  <div class="bb-board" id="bb-board"></div>
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

// Позиционировать панель рядом с кнопкой
function positionPanel() {
    const r = btn.getBoundingClientRect();
    const pw = 320, ph = panel.offsetHeight || 500;
    let left = r.right + 10 + pw <= window.innerWidth ? r.right + 10
             : r.left - pw - 10 >= 0               ? r.left - pw - 10
             : Math.max(10, (window.innerWidth - pw) / 2);
    let top  = Math.max(10, Math.min(r.top, window.innerHeight - ph - 10));
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
}

// Открытие/закрытие — ТОЛЬКО по кнопке, не закрывается при кликах внутри
let panelOpen = false;
btn.addEventListener('click', e => {
    if (moved) return; // был drag — не открывать
    e.stopPropagation();
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) positionPanel();
});

// Закрытие ТОЛЬКО при клике СТРОГО вне панели и вне кнопки
document.addEventListener('click', e => {
    if (!panelOpen) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    panelOpen = false;
    panel.classList.remove('open');
}, true); // capture=true чтобы поймать до stopPropagation внутри игры

window.addEventListener('resize', () => { if (panelOpen) positionPanel(); });

/* генерация — подсветка кнопки */
eventSource.on(event_types.GENERATION_STARTED, () => btn.classList.add('bb-gen'));
eventSource.on(event_types.GENERATION_ENDED,   () => btn.classList.remove('bb-gen'));
eventSource.on(event_types.GENERATION_STOPPED, () => btn.classList.remove('bb-gen'));

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
let best = +localStorage.getItem('bb_best_v3') || 0;
$('bb-best').textContent = best;

const rnd  = n => Math.floor(Math.random() * n);
const sum  = n => n.flat().reduce((a,v) => a+v, 0);

function canPlace(shape, row, col) {
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c]) {
                if (row+r >= ROWS || col+c >= COLS) return false;
                if (board[row+r][col+c]) return false;
            }
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
    msg('Click a cell to place the piece');
}

function place(row, col, e) {
    e.stopPropagation(); // ← не даём клику дойти до document и закрыть панель
    if (sel === null || dead) return;
    const p = pieces[sel];
    if (!canPlace(p.shape, row, col)) { msg("Can't place here!", 'bad'); return; }
    for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
            if (p.shape[r][c]) board[row+r][col+c] = p.color;
    p.used = true;
    score += sum(p.shape);
    const cleared = clearLines();
    score += cleared * 20;
    updateScore();
    drawBoard();   // перерисовываем ПОСЛЕ всех вычислений
    drawPieces();
    sel = null;
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
    let linesCleared = 0;
    if (flash.size) {
        // считаем полные строки и столбцы
        let rows = new Set(), cols = new Set();
        flash.forEach(k => { const [r,c] = k.split('_'); rows.add(r); cols.add(c); });
        // строка полная если все 8 клеток в flash
        for (const r of rows) if ([...Array(COLS).keys()].every(c => flash.has(`${r}_${c}`))) linesCleared++;
        for (const c of cols) if ([...Array(ROWS).keys()].every(r => flash.has(`${r}_${c}`))) linesCleared++;

        flash.forEach(k => {
            const [r,c] = k.split('_').map(Number);
            const el = $('bb-board').querySelector(`[data-r="${r}"][data-c="${c}"]`);
            if (el) { el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),300); }
            board[r][c] = null;
        });
    }
    return linesCleared;
}

function updateScore() {
    $('bb-score').textContent = score;
    if (score > best) {
        best = score;
        localStorage.setItem('bb_best_v3', best);
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
    brd.querySelectorAll('.bb-cell').forEach(el => el.remove());
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const el = document.createElement('div');
            el.className = 'bb-cell' + (board[r][c] ? ' filled' : '');
            if (board[r][c]) el.style.background = board[r][c];
            el.dataset.r = r; el.dataset.c = c;
            el.addEventListener('click',      ev => place(r, c, ev));
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
                const el = $('bb-board').querySelector(`[data-r="${row+r}"][data-c="${col+c}"]`);
                if (el) { el.classList.add('ghost','filled'); el.style.background = color; }
            }
}
function clearGhost() {
    $('bb-board').querySelectorAll('.bb-cell.ghost').forEach(el => {
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
        slot.onclick = e => { e.stopPropagation(); pick(i); };
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

$('bb-again').addEventListener('click', e => { e.stopPropagation(); newGame(); });
panel.addEventListener('click', e => e.stopPropagation()); // блокируем всплытие от всей панели

newGame();
console.log('🎮 [BlockBlast] Ready!');
