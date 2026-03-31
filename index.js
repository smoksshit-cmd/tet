import { eventSource, event_types } from '../../../../script.js';

/* ── ВСПОМОГАТЕЛЬНАЯ ── */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, hi)); }
function $(id) { return document.getElementById(id); }

/* ══════════════ КНОПКА ══════════════ */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Block Blast';
document.body.appendChild(btn);

// Восстановить позицию
const _saved = (() => { try { return JSON.parse(localStorage.getItem('bb_btn_pos3')); } catch { return null; } })();
if (_saved) {
    // валидируем — экран мог изменить размер
    const lv = parseFloat(_saved.left), tv = parseFloat(_saved.top);
    if (lv >= 0 && lv < window.innerWidth - 30 && tv >= 0 && tv < window.innerHeight - 30) {
        btn.style.bottom = ''; btn.style.right = '';
        btn.style.left = lv + 'px'; btn.style.top = tv + 'px';
    }
}

function saveBtnPos() {
    localStorage.setItem('bb_btn_pos3', JSON.stringify({ left: btn.style.left, top: btn.style.top }));
}
function moveBtn(cx, cy, ox, oy) {
    const bw = btn.offsetWidth  || 48;
    const bh = btn.offsetHeight || 48;
    btn.style.left   = clamp(cx - ox, 0, window.innerWidth  - bw) + 'px';
    btn.style.top    = clamp(cy - oy, 0, window.innerHeight - bh) + 'px';
    btn.style.right  = '';
    btn.style.bottom = '';
}

let _drag = false, _moved = false, _ox = 0, _oy = 0;

// MOUSE drag
btn.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    _drag = true; _moved = false;
    const r = btn.getBoundingClientRect();
    _ox = e.clientX - r.left; _oy = e.clientY - r.top;
    btn.style.opacity = '0.65'; e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!_drag) return; _moved = true;
    moveBtn(e.clientX, e.clientY, _ox, _oy); e.preventDefault();
});
document.addEventListener('mouseup', () => {
    if (!_drag) return; _drag = false; btn.style.opacity = '';
    if (_moved) { saveBtnPos(); _moved = false; }
});

// TOUCH drag
btn.addEventListener('touchstart', e => {
    _drag = true; _moved = false;
    const t = e.touches[0], r = btn.getBoundingClientRect();
    _ox = t.clientX - r.left; _oy = t.clientY - r.top;
}, { passive: true });
document.addEventListener('touchmove', e => {
    if (!_drag) return; _moved = true;
    const t = e.touches[0];
    moveBtn(t.clientX, t.clientY, _ox, _oy); e.preventDefault();
}, { passive: false });
document.addEventListener('touchend', () => {
    if (!_drag) return; _drag = false;
    if (_moved) { saveBtnPos(); _moved = false; }
});

/* ══════════════ ПАНЕЛЬ ══════════════ */
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
<div class="bb-msg" id="bb-msg">Select a piece, then tap the board</div>
<div class="bb-pieces">
  <div class="bb-slot" id="bb-s0"></div>
  <div class="bb-slot" id="bb-s1"></div>
  <div class="bb-slot" id="bb-s2"></div>
</div>
`;
document.body.appendChild(panel);

// Позиция панели
function positionPanel() {
    const r   = btn.getBoundingClientRect();
    const vw  = window.innerWidth, vh = window.innerHeight;
    const pw  = Math.min(320, vw - 20);
    panel.style.width = pw + 'px';
    const ph  = panel.offsetHeight || 500;
    let left  = r.right + 10 + pw <= vw ? r.right + 10
              : r.left - pw - 10 >= 0   ? r.left - pw - 10
              : Math.max(10, (vw - pw) / 2);
    let top   = clamp(r.top, 10, vh - ph - 10);
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
}

let panelOpen = false;
function openPanel()  { panelOpen = true;  panel.classList.add('open');    positionPanel(); }
function closePanel() { panelOpen = false; panel.classList.remove('open'); }

btn.addEventListener('click',      e => { if (_moved) return; e.stopPropagation(); panelOpen ? closePanel() : openPanel(); });
btn.addEventListener('touchend',   e => { if (_moved) return; e.preventDefault(); e.stopPropagation(); panelOpen ? closePanel() : openPanel(); });

// Закрытие при клике вне (НЕ capture, panel сама глотает клики)
panel.addEventListener('click',     e => e.stopPropagation());
panel.addEventListener('touchend',  e => e.stopPropagation());
document.addEventListener('click',  () => { if (panelOpen) closePanel(); });
document.addEventListener('touchend', () => { if (panelOpen) closePanel(); });

window.addEventListener('resize', () => { if (panelOpen) positionPanel(); });

/* генерация */
eventSource.on(event_types.GENERATION_STARTED, () => btn.classList.add('bb-gen'));
eventSource.on(event_types.GENERATION_ENDED,   () => btn.classList.remove('bb-gen'));
eventSource.on(event_types.GENERATION_STOPPED, () => btn.classList.remove('bb-gen'));

/* ══════════════ ИГРА ══════════════ */
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

const rnd = n => Math.floor(Math.random() * n);
const sum = n => n.flat().reduce((a,v) => a+v, 0);

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
    msg('Select a piece, then tap the board');
    drawBoard(); spawn();
}
function spawn() {
    pieces = [mkP(), mkP(), mkP()]; sel = null; drawPieces();
    if (!pieces.some(p => fitsAnywhere(p.shape))) gameOver();
}
function mkP() { return { shape: SHAPES[rnd(SHAPES.length)], color: COLORS[rnd(COLORS.length)], used: false }; }

function pick(i, e) {
    e.stopPropagation();
    if (pieces[i].used || dead) return;
    sel = i; drawPieces();
    msg('Tap a cell on the board to place it');
}

function place(row, col, e) {
    e.stopPropagation();
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
    sel = null;
    drawBoard(); drawPieces();
    if (cleared) msg(`+${cleared} line${cleared>1?'s':''} cleared! 🎉`, 'good');
    else msg('Select a piece, then tap the board');
    if (pieces.every(p => p.used)) spawn();
    else if (!pieces.filter(p=>!p.used).some(p => fitsAnywhere(p.shape))) gameOver();
}

function clearLines() {
    const flash = new Set();
    for (let r = 0; r < ROWS; r++) if (board[r].every(v=>v))   for (let c=0;c<COLS;c++) flash.add(`${r}_${c}`);
    for (let c = 0; c < COLS; c++) if (board.every(row=>row[c])) for (let r=0;r<ROWS;r++) flash.add(`${r}_${c}`);
    let rows = new Set(), cols = new Set();
    flash.forEach(k => { const [r,c] = k.split('_'); rows.add(r); cols.add(c); });
    let cleared = 0;
    for (const r of rows) if ([...Array(COLS).keys()].every(c => flash.has(`${r}_${c}`))) cleared++;
    for (const c of cols) if ([...Array(ROWS).keys()].every(r => flash.has(`${r}_${c}`))) cleared++;
    flash.forEach(k => {
        const [r,c] = k.split('_').map(Number);
        const el = $('bb-board') && $('bb-board').querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el) { el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),300); }
        board[r][c] = null;
    });
    return cleared;
}

function updateScore() {
    $('bb-score').textContent = score;
    if (score > best) { best = score; localStorage.setItem('bb_best_v3', best); $('bb-best').textContent = best; }
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
            el.addEventListener('click',    ev => place(r, c, ev));
            el.addEventListener('touchend', ev => { ev.preventDefault(); place(r, c, ev); });
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
        // удаляем старые слушатели заменой ноды
        const newSlot = slot.cloneNode(false);
        slot.parentNode.replaceChild(newSlot, slot);
        newSlot.id = `bb-s${i}`;
        newSlot.addEventListener('click',    ev => pick(i, ev));
        newSlot.addEventListener('touchend', ev => { ev.preventDefault(); pick(i, ev); });
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
            newSlot.appendChild(g);
        }
    }
}

function msg(text, type) {
    const el = $('bb-msg'); el.textContent = text;
    el.className = 'bb-msg' + (type ? ` ${type}` : '');
}

$('bb-again').addEventListener('click',    e => { e.stopPropagation(); newGame(); });
$('bb-again').addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); newGame(); });

newGame();
console.log('🎮 [BlockBlast] v1.2 Ready!');
