import { eventSource, event_types } from '../../../../script.js';

const $ = id => document.getElementById(id);
const GC = 28; // ghost cell size px
const THRESH = 8;

/* ══ КНОПКА ══ */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Block Blast';
document.body.appendChild(btn);

function safePos() {
    btn.style.left = Math.max(0, window.innerWidth - 54) + 'px';
    btn.style.top  = Math.max(0, window.innerHeight - 104) + 'px';
    btn.style.bottom = ''; btn.style.right = '';
}
(() => {
    try {
        const s = JSON.parse(localStorage.getItem('bb_btnpos') || 'null');
        if (s) {
            const l = parseFloat(s.l), t = parseFloat(s.t);
            if (l >= 0 && l <= window.innerWidth - 44 && t >= 0 && t <= window.innerHeight - 44) {
                btn.style.left = l + 'px'; btn.style.top = t + 'px'; return;
            }
        }
    } catch {}
    safePos();
})();
window.addEventListener('resize', () => {
    const l = parseFloat(btn.style.left), t = parseFloat(btn.style.top);
    if (isNaN(l) || l > window.innerWidth - 44 || isNaN(t) || t > window.innerHeight - 44) safePos();
});

/* drag кнопки */
let _bsx = 0, _bsy = 0, _box = 0, _boy = 0, _bdrag = false, _bmoved = false;
btn.addEventListener('mousedown', e => {
    if (e.button !== 0) return; e.preventDefault();
    _bdrag = true; _bmoved = false; _bsx = e.clientX; _bsy = e.clientY;
    const r = btn.getBoundingClientRect(); _box = e.clientX - r.left; _boy = e.clientY - r.top;
    btn.style.opacity = '0.65';
});
btn.addEventListener('touchstart', e => {
    const t = e.touches[0]; _bdrag = true; _bmoved = false;
    _bsx = t.clientX; _bsy = t.clientY;
    const r = btn.getBoundingClientRect(); _box = t.clientX - r.left; _boy = t.clientY - r.top;
}, { passive: true });

function moveBtn(cx, cy) {
    if (Math.abs(cx - _bsx) > THRESH || Math.abs(cy - _bsy) > THRESH) _bmoved = true;
    const bw = 44, bh = 44;
    btn.style.left = Math.max(0, Math.min(cx - _box, window.innerWidth  - bw)) + 'px';
    btn.style.top  = Math.max(0, Math.min(cy - _boy, window.innerHeight - bh)) + 'px';
    btn.style.bottom = ''; btn.style.right = '';
}
function endBtnDrag() {
    if (!_bdrag) return; _bdrag = false; btn.style.opacity = '';
    if (_bmoved) localStorage.setItem('bb_btnpos', JSON.stringify({ l: btn.style.left, t: btn.style.top }));
}

/* ══ ПАНЕЛЬ ══ */
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
    <h3>Game Over</h3><p id="bb-final"></p>
    <button id="bb-again">Play Again</button>
  </div>
</div>
<div class="bb-msg" id="bb-msg">Drag a piece onto the board</div>
<div class="bb-pieces">
  <div class="bb-slot" id="bb-s0"></div>
  <div class="bb-slot" id="bb-s1"></div>
  <div class="bb-slot" id="bb-s2"></div>
</div>`;
document.body.appendChild(panel);

function positionPanel() {
    const r = btn.getBoundingClientRect();
    const pw = 300, vw = window.innerWidth, vh = window.innerHeight;
    const ph = panel.offsetHeight || 480;
    let left = r.right + 10 + pw <= vw ? r.right + 10
             : r.left  - pw - 10 >= 0  ? r.left - pw - 10
             : Math.max(6, (vw - pw) / 2);
    let top  = Math.max(6, Math.min(r.top, vh - ph - 6));
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
}

let panelOpen = false;

/* ── FIX 1: при закрытии чистим всё ── */
function cleanupDrag() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    clearGhost();
    if (dragIdx !== null) {
        const slot = $(`bb-s${dragIdx}`);
        if (slot) slot.classList.remove('dragging');
        dragIdx = null;
    }
}

function openPanel()  { panelOpen = true;  panel.classList.add('open');    positionPanel(); }
function closePanel() { panelOpen = false; panel.classList.remove('open'); cleanupDrag(); }

btn.addEventListener('click', e => {
    e.stopPropagation();
    if (_bmoved) { _bmoved = false; return; }
    panelOpen ? closePanel() : openPanel();
});
btn.addEventListener('touchend', e => {
    endBtnDrag();
    if (!_bmoved) { e.preventDefault(); e.stopPropagation(); panelOpen ? closePanel() : openPanel(); }
    _bmoved = false;
});

/* ── FIX 2: панель НЕ глотает touchend когда идёт drag фигуры ── */
panel.addEventListener('click',    e => e.stopPropagation());
panel.addEventListener('touchend', e => { if (dragIdx === null) e.stopPropagation(); });
document.addEventListener('click', () => { if (panelOpen) closePanel(); });

/* генерация */
eventSource.on(event_types.GENERATION_STARTED, () => btn.classList.add('bb-gen'));
eventSource.on(event_types.GENERATION_ENDED,   () => btn.classList.remove('bb-gen'));
eventSource.on(event_types.GENERATION_STOPPED, () => btn.classList.remove('bb-gen'));

/* ════════ ИГРА ════════ */
const ROWS=8,COLS=8;
const COLORS=['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#00bcd4','#ff5722','#e91e63'];
const SHAPES=[
    [[1,1],[1,1]],[[1,1,1]],[[1],[1],[1]],[[1,1,1,1]],[[1],[1],[1],[1]],
    [[1,1,1],[1,0,0]],[[1,1,1],[0,0,1]],[[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]],
    [[1,1,1],[0,1,0]],[[1]],[[1,1]],[[1],[1]],
    [[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1,1],[1,0,0],[1,0,0]],
];
let board, score, pieces, dead;
let best = +localStorage.getItem('bb_best') || 0;
$('bb-best').textContent = best;
const rnd = n => Math.floor(Math.random() * n);
const sum = n => n.flat().reduce((a, v) => a + v, 0);

function canPlace(shape, r, c) {
    for (let dr = 0; dr < shape.length; dr++)
        for (let dc = 0; dc < shape[dr].length; dc++)
            if (shape[dr][dc] && (r+dr >= ROWS || c+dc >= COLS || board[r+dr][c+dc])) return false;
    return true;
}
function fitsAnywhere(shape) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canPlace(shape, r, c)) return true;
    return false;
}
function newGame() {
    board = Array.from({length:ROWS}, () => Array(COLS).fill(null));
    score = 0; dead = false;
    $('bb-score').textContent = '0'; $('bb-over').classList.remove('show');
    msg('Drag a piece onto the board'); drawBoard(); spawn();
}
function spawn() {
    pieces = [mkP(), mkP(), mkP()]; drawPieces();
    if (!pieces.some(p => fitsAnywhere(p.shape))) gameOver();
}
function mkP() { return { shape: SHAPES[rnd(SHAPES.length)], color: COLORS[rnd(COLORS.length)], used: false }; }
function doPlace(pIdx, row, col) {
    const p = pieces[pIdx];
    if (!canPlace(p.shape, row, col)) { msg("Can't place here!", 'bad'); return false; }
    for (let dr = 0; dr < p.shape.length; dr++)
        for (let dc = 0; dc < p.shape[dr].length; dc++)
            if (p.shape[dr][dc]) board[row+dr][col+dc] = p.color;
    p.used = true; score += sum(p.shape);
    const cl = clearLines(); score += cl * 20;
    updateScore(); drawBoard(); drawPieces();
    if (cl) msg(`+${cl} line${cl>1?'s':''} cleared! 🎉`, 'good');
    else msg('Drag a piece onto the board');
    if (pieces.every(p => p.used)) spawn();
    else if (!pieces.filter(p => !p.used).some(p => fitsAnywhere(p.shape))) gameOver();
    return true;
}
function clearLines() {
    const f = new Set();
    for (let r = 0; r < ROWS; r++) if (board[r].every(v=>v)) for (let c=0;c<COLS;c++) f.add(`${r}_${c}`);
    for (let c = 0; c < COLS; c++) if (board.every(r=>r[c])) for (let r=0;r<ROWS;r++) f.add(`${r}_${c}`);
    let rows = new Set(), cols = new Set();
    f.forEach(k => { const [r,c] = k.split('_'); rows.add(r); cols.add(c); });
    let cl = 0;
    for (const r of rows) if ([...Array(COLS).keys()].every(c => f.has(`${r}_${c}`))) cl++;
    for (const c of cols) if ([...Array(ROWS).keys()].every(r => f.has(`${r}_${c}`))) cl++;
    f.forEach(k => {
        const [r,c] = k.split('_').map(Number); board[r][c] = null;
        const el = $('bb-board')?.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 300); }
    });
    return cl;
}
function updateScore() {
    $('bb-score').textContent = score;
    if (score > best) { best = score; localStorage.setItem('bb_best', best); $('bb-best').textContent = best; }
}
function gameOver() { dead = true; $('bb-final').textContent = `Score: ${score}  •  Best: ${best}`; $('bb-over').classList.add('show'); }
function msg(t, type) { const e = $('bb-msg'); e.textContent = t; e.className = 'bb-msg' + (type ? ` ${type}` : ''); }

function drawBoard() {
    const brd = $('bb-board'); brd.querySelectorAll('.bb-cell').forEach(e => e.remove());
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const el = document.createElement('div');
        el.className = 'bb-cell' + (board[r][c] ? ' filled' : '');
        if (board[r][c]) el.style.background = board[r][c];
        el.dataset.r = r; el.dataset.c = c; brd.appendChild(el);
    }
}
function showGhost(shape, row, col, color) {
    clearGhost(); if (!canPlace(shape, row, col)) return;
    for (let dr = 0; dr < shape.length; dr++) for (let dc = 0; dc < shape[dr].length; dc++) if (shape[dr][dc]) {
        const el = $('bb-board')?.querySelector(`[data-r="${row+dr}"][data-c="${col+dc}"]`);
        if (el) { el.classList.add('ghost', 'filled'); el.style.background = color; }
    }
}
function clearGhost() {
    $('bb-board')?.querySelectorAll('.bb-cell.ghost').forEach(el => {
        const r = +el.dataset.r, c = +el.dataset.c;
        el.classList.remove('ghost', 'filled');
        el.style.background = board[r][c] || '';
        if (!board[r][c]) el.classList.remove('filled');
    });
}

/* ══ DRAG ФИГУР ══ */
let dragIdx = null, dragGhost = null, dragOffX = 0, dragOffY = 0;

function buildGhostEl(piece) {
    const el = document.createElement('div');
    el.className = 'bb-drag-ghost';
    el.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, ${GC}px)`;
    piece.shape.forEach(row => row.forEach(v => {
        const c = document.createElement('div'); c.className = 'bb-dc';
        c.style.background = v ? piece.color : 'transparent';
        if (!v) c.style.boxShadow = 'none'; el.appendChild(c);
    }));
    document.body.appendChild(el); return el;
}
function startPieceDrag(idx, cx, cy, pgridEl) {
    dragIdx = idx;
    const rect = pgridEl.getBoundingClientRect();
    dragOffX = cx - rect.left; dragOffY = cy - rect.top;
    dragGhost = buildGhostEl(pieces[idx]);
    movePieceDrag(cx, cy);
    $(`bb-s${idx}`)?.classList.add('dragging');
}
function movePieceDrag(cx, cy) {
    if (!dragGhost) return;
    const gl = cx - dragOffX, gt = cy - dragOffY;
    dragGhost.style.left = gl + 'px'; dragGhost.style.top = gt + 'px';
    dragGhost.style.visibility = 'hidden';
    const el = document.elementFromPoint(gl + GC/2, gt + GC/2);
    dragGhost.style.visibility = '';
    if (el?.classList.contains('bb-cell')) showGhost(pieces[dragIdx].shape, +el.dataset.r, +el.dataset.c, pieces[dragIdx].color);
    else clearGhost();
}
function endPieceDrag(cx, cy) {
    if (!dragGhost) return;
    const gl = cx - dragOffX, gt = cy - dragOffY;
    dragGhost.remove(); dragGhost = null; clearGhost();
    $(`bb-s${dragIdx}`)?.classList.remove('dragging');
    const el = document.elementFromPoint(gl + GC/2, gt + GC/2);
    const idx = dragIdx; dragIdx = null;
    if (el?.classList.contains('bb-cell') && !dead) doPlace(idx, +el.dataset.r, +el.dataset.c);
    else drawPieces();
}

function drawPieces() {
    for (let i = 0; i < 3; i++) {
        const old = $(`bb-s${i}`);
        const slot = old.cloneNode(false); slot.id = `bb-s${i}`;
        old.parentNode.replaceChild(slot, old);
        const p = pieces[i];
        slot.className = 'bb-slot' + (p.used ? ' used' : '');
        if (p.used) continue;
        slot.addEventListener('mousedown', e => {
            if (dead) return; e.preventDefault(); e.stopPropagation();
            startPieceDrag(i, e.clientX, e.clientY, slot.querySelector('.bb-pgrid') || slot);
        });
        slot.addEventListener('touchstart', e => {
            if (dead) return; e.stopPropagation();
            const t = e.touches[0];
            startPieceDrag(i, t.clientX, t.clientY, slot.querySelector('.bb-pgrid') || slot);
        }, { passive: true });
        const g = document.createElement('div'); g.className = 'bb-pgrid';
        g.style.gridTemplateColumns = `repeat(${p.shape[0].length}, 18px)`;
        p.shape.forEach(row => row.forEach(v => {
            const c = document.createElement('div'); c.className = 'bb-pcell';
            c.style.width = '18px'; c.style.height = '18px';
            c.style.background = v ? p.color : 'transparent';
            if (!v) c.style.boxShadow = 'none'; g.appendChild(c);
        }));
        slot.appendChild(g);
    }
}

/* глобальные обработчики */
document.addEventListener('mousemove', e => {
    if (_bdrag) moveBtn(e.clientX, e.clientY);
    if (dragIdx !== null) movePieceDrag(e.clientX, e.clientY);
});
document.addEventListener('mouseup', e => {
    endBtnDrag();
    if (dragIdx !== null) endPieceDrag(e.clientX, e.clientY);
});
document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (dragIdx !== null) { movePieceDrag(t.clientX, t.clientY); e.preventDefault(); }
    else if (_bdrag) { moveBtn(t.clientX, t.clientY); e.preventDefault(); }
}, { passive: false });
document.addEventListener('touchend', e => {
    endBtnDrag();
    if (dragIdx !== null) { const t = e.changedTouches[0]; endPieceDrag(t.clientX, t.clientY); }
});

$('bb-again').addEventListener('click',    e => { e.stopPropagation(); newGame(); });
$('bb-again').addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); newGame(); });

newGame();
console.log('🎮 [BlockBlast] v1.7 ready');
