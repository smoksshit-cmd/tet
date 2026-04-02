import { eventSource, event_types } from '../../../../script.js';

const $ = id => document.getElementById(id);
const GC = 28;
const THRESH = 8;

/* ═══════════════════════════════════════
   КНОПКА
═══════════════════════════════════════ */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Игры (двойной клик — сменить игру)';
document.body.appendChild(btn);

function safePos() {
    btn.style.left   = Math.max(0, window.innerWidth  - 54)  + 'px';
    btn.style.top    = Math.max(0, window.innerHeight - 104) + 'px';
    btn.style.bottom = ''; btn.style.right = '';
}
(() => {
    try {
        const s = JSON.parse(localStorage.getItem('bb_btnpos') || 'null');
        if (s) {
            const l = parseFloat(s.l), t = parseFloat(s.t);
            if (l >= 0 && l <= window.innerWidth-44 && t >= 0 && t <= window.innerHeight-44) {
                btn.style.left = l+'px'; btn.style.top = t+'px'; return;
            }
        }
    } catch {}
    safePos();
})();
window.addEventListener('resize', () => {
    const l = parseFloat(btn.style.left), t = parseFloat(btn.style.top);
    if (isNaN(l)||l>window.innerWidth-44||isNaN(t)||t>window.innerHeight-44) safePos();
});

/* drag кнопки */
let _bsx=0,_bsy=0,_box=0,_boy=0,_bdrag=false,_bmoved=false;
btn.addEventListener('mousedown', e => {
    if (e.button!==0) return; e.preventDefault();
    _bdrag=true; _bmoved=false; _bsx=e.clientX; _bsy=e.clientY;
    const r=btn.getBoundingClientRect(); _box=e.clientX-r.left; _boy=e.clientY-r.top;
    btn.style.opacity='0.65';
});
btn.addEventListener('touchstart', e => {
    const t=e.touches[0]; _bdrag=true; _bmoved=false;
    _bsx=t.clientX; _bsy=t.clientY;
    const r=btn.getBoundingClientRect(); _box=t.clientX-r.left; _boy=t.clientY-r.top;
}, { passive:true });
function moveBtn(cx,cy) {
    if (Math.abs(cx-_bsx)>THRESH||Math.abs(cy-_bsy)>THRESH) _bmoved=true;
    btn.style.left  = Math.max(0, Math.min(cx-_box, window.innerWidth-44))  + 'px';
    btn.style.top   = Math.max(0, Math.min(cy-_boy, window.innerHeight-44)) + 'px';
    btn.style.bottom=''; btn.style.right='';
}
function endBtnDrag() {
    if (!_bdrag) return; _bdrag=false; btn.style.opacity='';
    if (_bmoved) localStorage.setItem('bb_btnpos', JSON.stringify({l:btn.style.left,t:btn.style.top}));
}

/* ═══════════════════════════════════════
   УПРАВЛЕНИЕ ПАНЕЛЯМИ
═══════════════════════════════════════ */
let currentGame = localStorage.getItem('bb_game') || 'blockblast';
let panelOpen=false, msPanelOpen=false, panel2048Open=false, memPanelOpen=false, flappyPanelOpen=false, pickerOpen=false;
let singleClickTimer=null;

let panel, msPanel, panel2048, memPanel, flappyPanel, pickerEl;

function positionEl(el, w) {
    const r=btn.getBoundingClientRect();
    const pw=w||300, vw=window.innerWidth, vh=window.innerHeight;
    const ph=el.offsetHeight||480;
    const left = r.right+10+pw<=vw ? r.right+10
               : r.left-pw-10>=0  ? r.left-pw-10
               : Math.max(6,(vw-pw)/2);
    const top  = Math.max(6, Math.min(r.top, vh-ph-6));
    el.style.left=left+'px'; el.style.top=top+'px';
}

function updatePickerActive() {
    document.querySelectorAll('.bb-game-card').forEach(c=>c.classList.remove('active'));
    if (currentGame==='blockblast')       $('pick-bb')?.classList.add('active');
    else if (currentGame==='minesweeper') $('pick-ms')?.classList.add('active');
    else if (currentGame==='game2048')    $('pick-2048')?.classList.add('active');
    else if (currentGame==='memory')      $('pick-mem')?.classList.add('active');
}

function openCurrentGame() {
    closePicker();
    panel.classList.remove('open');       panelOpen=false;
    msPanel.classList.remove('open');     msPanelOpen=false;
    panel2048.classList.remove('open');   panel2048Open=false;
    memPanel.classList.remove('open');    memPanelOpen=false;
    flappyPanel.classList.remove('open'); flappyPanelOpen=false; fbStopLoop();
    cleanupDrag();
    if (currentGame==='blockblast') {
        panel.classList.add('open'); panelOpen=true;
        positionEl(panel, 300);
    } else if (currentGame==='minesweeper') {
        msPanel.classList.add('open'); msPanelOpen=true;
        positionEl(msPanel, 300);
    } else if (currentGame==='game2048') {
        panel2048.classList.add('open'); panel2048Open=true;
        positionEl(panel2048, 300);
    } else if (currentGame==='memory') {
        memPanel.classList.add('open'); memPanelOpen=true;
        positionEl(memPanel, 400);
    } else if (currentGame==='flappybird') {
        flappyPanel.classList.add('open'); flappyPanelOpen=true;
        positionEl(flappyPanel, 310);
        fbInit();
    }
}

function closePanels() {
    panel.classList.remove('open');       panelOpen=false;
    msPanel.classList.remove('open');     msPanelOpen=false;
    panel2048.classList.remove('open');   panel2048Open=false;
    memPanel.classList.remove('open');    memPanelOpen=false;
    flappyPanel.classList.remove('open'); flappyPanelOpen=false; fbStopLoop();
    cleanupDrag();
    clearInterval(memTimer);
}

function showPicker() {
    pickerOpen=true; updatePickerActive();
    pickerEl.classList.add('open'); positionEl(pickerEl, 280);
}
function closePicker() { pickerOpen=false; pickerEl?.classList.remove('open'); }

/* двойной клик — выбор игры */
function handleBtnActivate() {
    if (singleClickTimer) {
        clearTimeout(singleClickTimer); singleClickTimer=null;
        closePanels(); showPicker();
    } else {
        singleClickTimer = setTimeout(() => {
            singleClickTimer=null;
            if (pickerOpen) { closePicker(); return; }
            (panelOpen||msPanelOpen||panel2048Open||memPanelOpen||flappyPanelOpen) ? closePanels() : openCurrentGame();
        }, 320);
    }
}

btn.addEventListener('click', e => {
    e.stopPropagation();
    if (_bmoved) { _bmoved=false; return; }
    handleBtnActivate();
});
btn.addEventListener('touchend', e => {
    endBtnDrag();
    if (!_bmoved) { e.preventDefault(); e.stopPropagation(); handleBtnActivate(); }
    _bmoved=false;
});

/* генерация */
eventSource.on(event_types.GENERATION_STARTED, () => btn.classList.add('bb-gen'));
eventSource.on(event_types.GENERATION_ENDED,   () => btn.classList.remove('bb-gen'));
eventSource.on(event_types.GENERATION_STOPPED, () => btn.classList.remove('bb-gen'));

/* ═══════════════════════════════════════
   ПАНЕЛЬ BLOCK BLAST
═══════════════════════════════════════ */
panel = document.createElement('div');
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

panel.addEventListener('click',    e => e.stopPropagation());
panel.addEventListener('touchend', e => { if (dragIdx===null) e.stopPropagation(); });

/* ═══════════════════════════════════════
   ПАНЕЛЬ САПЁР
═══════════════════════════════════════ */
msPanel = document.createElement('div');
msPanel.className = 'bb-panel ms-panel';
msPanel.innerHTML = `
<div class="bb-header">
  <span class="bb-title">💣 Сапёр</span>
  <div class="ms-stats">
    <span id="ms-mines-count">🚩 10</span>
    <span id="ms-timer-disp">⏱ 0</span>
  </div>
</div>
<div class="bb-board-wrap">
  <div class="ms-board" id="ms-board"></div>
  <div class="bb-over" id="ms-over">
    <h3 id="ms-over-title">Game Over</h3>
    <p id="ms-result"></p>
    <button id="ms-again">Play Again</button>
  </div>
</div>
<div class="ms-footer">
  <span class="ms-hint">Клик: открыть · ПКМ / удержание: 🚩</span>
  <div class="ms-difficulty">
    <button class="ms-diff-btn" data-d="easy">Easy</button>
    <button class="ms-diff-btn" data-d="medium">Med</button>
    <button class="ms-diff-btn" data-d="hard">Hard</button>
  </div>
</div>`;
document.body.appendChild(msPanel);

msPanel.addEventListener('click',    e => e.stopPropagation());
msPanel.addEventListener('touchend', e => e.stopPropagation());

/* ═══════════════════════════════════════
   ПАНЕЛЬ 2048
═══════════════════════════════════════ */
panel2048 = document.createElement('div');
panel2048.className = 'bb-panel g2048-panel';
panel2048.innerHTML = `
<div class="bb-header">
  <span class="bb-title">🔢 2048</span>
  <div class="bb-score-box">
    <div class="bb-score-label">Score</div>
    <div class="bb-score" id="g2048-score">0</div>
  </div>
</div>
<div class="bb-best">Best: <span id="g2048-best">0</span></div>
<div class="bb-board-wrap">
  <div class="g2048-board" id="g2048-board"></div>
  <div class="bb-over" id="g2048-over">
    <h3 id="g2048-over-title">Game Over</h3>
    <p id="g2048-final"></p>
    <button id="g2048-again">Play Again</button>
  </div>
</div>
<div class="ms-footer">
  <span class="ms-hint">Свайп для управления</span>
</div>`;
document.body.appendChild(panel2048);

panel2048.addEventListener('click', e => e.stopPropagation());

/* ═══════════════════════════════════════
   ПАНЕЛЬ МЕМОРИ
═══════════════════════════════════════ */
memPanel = document.createElement('div');
memPanel.className = 'bb-panel mem-panel';
memPanel.innerHTML = `
<div class="bb-header">
  <span class="bb-title">🃏 Мемори</span>
  <div class="mem-hdr-right">
    <div class="mem-timer-box">
      <span class="mem-timer-label">⏱</span>
      <span class="mem-timer-val" id="mem-timer">60</span>
    </div>
    <div class="mem-level-box">Ур. <span id="mem-level-num">1</span></div>
  </div>
</div>
<div class="mem-subhdr">
  <span id="mem-pairs">4 пары</span>
  <span id="mem-best" class="mem-best-txt"></span>
</div>
<div class="bb-board-wrap">
  <div class="mem-board" id="mem-board"></div>
  <div class="bb-over" id="mem-over">
    <h3 id="mem-over-title">🎉 Отлично!</h3>
    <p id="mem-over-result"></p>
    <div class="mem-over-btns">
      <button id="mem-over-next" class="mem-btn-next">Уровень →</button>
      <button id="mem-over-retry">Повторить</button>
    </div>
  </div>
</div>
<div class="ms-footer">
  <span class="ms-hint">Найди все пары карт таро</span>
  <div class="mem-footer-btns">
    <button id="mem-restart-btn" class="mem-restart">↺ Заново</button>
    <button id="mem-reset-btn" class="mem-restart mem-reset">⟪ С 1 ур.</button>
  </div>
</div>`;
document.body.appendChild(memPanel);

memPanel.addEventListener('click',    e => e.stopPropagation());
memPanel.addEventListener('touchend', e => e.stopPropagation());

/* ═══════════════════════════════════════
   ВЫБОР ИГРЫ (ПИКЕР)
═══════════════════════════════════════ */
pickerEl = document.createElement('div');
pickerEl.className = 'bb-picker';
pickerEl.innerHTML = `
<div class="bb-picker-title">Выбери игру</div>
<div class="bb-picker-row">
  <div class="bb-game-card" id="pick-bb">
    <div class="bb-game-icon">⬛</div>
    <div class="bb-game-name">Block Blast</div>
  </div>
  <div class="bb-game-card" id="pick-ms">
    <div class="bb-game-icon">💣</div>
    <div class="bb-game-name">Сапёр</div>
  </div>
  <div class="bb-game-card" id="pick-2048">
    <div class="bb-game-icon">🔢</div>
    <div class="bb-game-name">2048</div>
  </div>
  <div class="bb-game-card" id="pick-mem">
    <div class="bb-game-icon">🃏</div>
    <div class="bb-game-name">Мемори</div>
  </div>
  <div class="bb-game-card" id="pick-fb">
    <div class="bb-game-icon">🐦</div>
    <div class="bb-game-name">Flappy Bird</div>
  </div>
</div>`;
document.body.appendChild(pickerEl);

pickerEl.addEventListener('click', e => e.stopPropagation());

$('pick-bb').addEventListener('click', e => {
    e.stopPropagation();
    currentGame='blockblast'; localStorage.setItem('bb_game', currentGame);
    closePicker(); openCurrentGame();
});
$('pick-ms').addEventListener('click', e => {
    e.stopPropagation();
    currentGame='minesweeper'; localStorage.setItem('bb_game', currentGame);
    closePicker(); openCurrentGame();
});
$('pick-2048').addEventListener('click', e => {
    e.stopPropagation();
    currentGame='game2048'; localStorage.setItem('bb_game', currentGame);
    closePicker(); openCurrentGame();
});
$('pick-mem').addEventListener('click', e => {
    e.stopPropagation();
    currentGame='memory'; localStorage.setItem('bb_game', currentGame);
    closePicker(); openCurrentGame();
    memNewGame();
});
$('pick-fb').addEventListener('click', e => {
    e.stopPropagation();
    currentGame='flappybird'; localStorage.setItem('bb_game', currentGame);
    closePicker(); openCurrentGame();
});

document.addEventListener('click', () => {
    if (pickerOpen)                                          closePicker();
    if (panelOpen||msPanelOpen||panel2048Open||memPanelOpen||flappyPanelOpen) closePanels();
});

/* ═══════════════════════════════════════
   BLOCK BLAST — ЛОГИКА
═══════════════════════════════════════ */
const ROWS=8, COLS=8;
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
const rnd = n => Math.floor(Math.random()*n);
const sum = n => n.flat().reduce((a,v)=>a+v, 0);

function canPlace(shape,r,c) {
    for (let dr=0;dr<shape.length;dr++)
        for (let dc=0;dc<shape[dr].length;dc++)
            if (shape[dr][dc]&&(r+dr>=ROWS||c+dc>=COLS||board[r+dr][c+dc])) return false;
    return true;
}
function fitsAnywhere(shape) {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (canPlace(shape,r,c)) return true;
    return false;
}
function newGame() {
    board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    score=0; dead=false;
    $('bb-score').textContent='0'; $('bb-over').classList.remove('show');
    msg('Drag a piece onto the board'); drawBoard(); spawn();
}
function spawn() {
    pieces=[mkP(),mkP(),mkP()]; drawPieces();
    if (!pieces.some(p=>fitsAnywhere(p.shape))) gameOver();
}
function mkP() { return {shape:SHAPES[rnd(SHAPES.length)], color:COLORS[rnd(COLORS.length)], used:false}; }
function doPlace(pIdx,row,col) {
    const p=pieces[pIdx];
    if (!canPlace(p.shape,row,col)) { msg("Can't place here!",'bad'); return false; }
    for (let dr=0;dr<p.shape.length;dr++)
        for (let dc=0;dc<p.shape[dr].length;dc++)
            if (p.shape[dr][dc]) board[row+dr][col+dc]=p.color;
    p.used=true; score+=sum(p.shape);
    const cl=clearLines(); score+=cl*20;
    updateScore(); drawBoard(); drawPieces();
    if (cl) msg(`+${cl} line${cl>1?'s':''} cleared! 🎉`,'good');
    else msg('Drag a piece onto the board');
    if (pieces.every(p=>p.used)) spawn();
    else if (!pieces.filter(p=>!p.used).some(p=>fitsAnywhere(p.shape))) gameOver();
    return true;
}
function clearLines() {
    const f=new Set();
    for (let r=0;r<ROWS;r++) if (board[r].every(v=>v)) for (let c=0;c<COLS;c++) f.add(`${r}_${c}`);
    for (let c=0;c<COLS;c++) if (board.every(r=>r[c])) for (let r=0;r<ROWS;r++) f.add(`${r}_${c}`);
    let rows=new Set(), cols=new Set();
    f.forEach(k=>{const[r,c]=k.split('_'); rows.add(r); cols.add(c);});
    let cl=0;
    for (const r of rows) if ([...Array(COLS).keys()].every(c=>f.has(`${r}_${c}`))) cl++;
    for (const c of cols) if ([...Array(ROWS).keys()].every(r=>f.has(`${r}_${c}`))) cl++;
    f.forEach(k=>{
        const[r,c]=k.split('_').map(Number); board[r][c]=null;
        const el=$('bb-board')?.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el){el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),300);}
    });
    return cl;
}
function updateScore() {
    $('bb-score').textContent=score;
    if (score>best){best=score; localStorage.setItem('bb_best',best); $('bb-best').textContent=best;}
}
function gameOver(){dead=true; $('bb-final').textContent=`Score: ${score}  •  Best: ${best}`; $('bb-over').classList.add('show');}
function msg(t,type){const e=$('bb-msg'); e.textContent=t; e.className='bb-msg'+(type?` ${type}`:'');}

function drawBoard() {
    const brd=$('bb-board'); brd.querySelectorAll('.bb-cell').forEach(e=>e.remove());
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
        const el=document.createElement('div');
        el.className='bb-cell'+(board[r][c]?' filled':'');
        if (board[r][c]) el.style.background=board[r][c];
        el.dataset.r=r; el.dataset.c=c; brd.appendChild(el);
    }
}
function showGhost(shape,row,col,color) {
    clearGhost(); if (!canPlace(shape,row,col)) return;
    for (let dr=0;dr<shape.length;dr++) for (let dc=0;dc<shape[dr].length;dc++) if (shape[dr][dc]) {
        const el=$('bb-board')?.querySelector(`[data-r="${row+dr}"][data-c="${col+dc}"]`);
        if (el){el.classList.add('ghost','filled'); el.style.background=color;}
    }
}
function clearGhost() {
    $('bb-board')?.querySelectorAll('.bb-cell.ghost').forEach(el=>{
        const r=+el.dataset.r, c=+el.dataset.c;
        el.classList.remove('ghost','filled');
        el.style.background=board[r][c]||'';
        if (!board[r][c]) el.classList.remove('filled');
    });
}

/* ═══════════════════════════════════════
   BLOCK BLAST — DRAG
═══════════════════════════════════════ */
let dragIdx=null, dragGhost=null, dragOffX=0, dragOffY=0;

function cleanupDrag() {
    if (dragGhost){dragGhost.remove(); dragGhost=null;}
    clearGhost();
    if (dragIdx!==null){const s=$(`bb-s${dragIdx}`); if(s) s.classList.remove('dragging'); dragIdx=null;}
}
function buildGhostEl(piece) {
    const el=document.createElement('div');
    el.className='bb-drag-ghost';
    el.style.gridTemplateColumns=`repeat(${piece.shape[0].length},${GC}px)`;
    piece.shape.forEach(row=>row.forEach(v=>{
        const c=document.createElement('div'); c.className='bb-dc';
        c.style.background=v?piece.color:'transparent';
        if (!v) c.style.boxShadow='none'; el.appendChild(c);
    }));
    document.body.appendChild(el); return el;
}
function startPieceDrag(idx,cx,cy,pgridEl) {
    dragIdx=idx;
    const rect=pgridEl.getBoundingClientRect();
    dragOffX=cx-rect.left; dragOffY=cy-rect.top;
    dragGhost=buildGhostEl(pieces[idx]);
    movePieceDrag(cx,cy);
    $(`bb-s${idx}`)?.classList.add('dragging');
}
function movePieceDrag(cx,cy) {
    if (!dragGhost) return;
    const gl=cx-dragOffX, gt=cy-dragOffY;
    dragGhost.style.left=gl+'px'; dragGhost.style.top=gt+'px';
    dragGhost.style.visibility='hidden';
    const el=document.elementFromPoint(gl+GC/2, gt+GC/2);
    dragGhost.style.visibility='';
    if (el?.classList.contains('bb-cell')) showGhost(pieces[dragIdx].shape,+el.dataset.r,+el.dataset.c,pieces[dragIdx].color);
    else clearGhost();
}
function endPieceDrag(cx,cy) {
    if (!dragGhost) return;
    const gl=cx-dragOffX, gt=cy-dragOffY;
    dragGhost.remove(); dragGhost=null; clearGhost();
    $(`bb-s${dragIdx}`)?.classList.remove('dragging');
    const el=document.elementFromPoint(gl+GC/2, gt+GC/2);
    const idx=dragIdx; dragIdx=null;
    if (el?.classList.contains('bb-cell')&&!dead) doPlace(idx,+el.dataset.r,+el.dataset.c);
    else drawPieces();
}
function drawPieces() {
    for (let i=0;i<3;i++) {
        const old=$(`bb-s${i}`);
        const slot=old.cloneNode(false); slot.id=`bb-s${i}`;
        old.parentNode.replaceChild(slot,old);
        const p=pieces[i];
        slot.className='bb-slot'+(p.used?' used':'');
        if (p.used) continue;
        slot.addEventListener('mousedown',e=>{
            if(dead)return; e.preventDefault(); e.stopPropagation();
            startPieceDrag(i,e.clientX,e.clientY,slot.querySelector('.bb-pgrid')||slot);
        });
        slot.addEventListener('touchstart',e=>{
            if(dead)return; e.stopPropagation();
            const t=e.touches[0];
            startPieceDrag(i,t.clientX,t.clientY,slot.querySelector('.bb-pgrid')||slot);
        },{passive:true});
        const g=document.createElement('div'); g.className='bb-pgrid';
        g.style.gridTemplateColumns=`repeat(${p.shape[0].length},18px)`;
        p.shape.forEach(row=>row.forEach(v=>{
            const c=document.createElement('div'); c.className='bb-pcell';
            c.style.width='18px'; c.style.height='18px';
            c.style.background=v?p.color:'transparent';
            if (!v) c.style.boxShadow='none'; g.appendChild(c);
        }));
        slot.appendChild(g);
    }
}

/* глобальные события */
document.addEventListener('mousemove', e => {
    if (_bdrag) moveBtn(e.clientX,e.clientY);
    if (dragIdx!==null) movePieceDrag(e.clientX,e.clientY);
});
document.addEventListener('mouseup', e => {
    endBtnDrag();
    if (dragIdx!==null) endPieceDrag(e.clientX,e.clientY);
});
document.addEventListener('touchmove', e => {
    const t=e.touches[0];
    if (dragIdx!==null){movePieceDrag(t.clientX,t.clientY); e.preventDefault();}
    else if (_bdrag){moveBtn(t.clientX,t.clientY); e.preventDefault();}
},{passive:false});
document.addEventListener('touchend', e => {
    endBtnDrag();
    if (dragIdx!==null){const t=e.changedTouches[0]; endPieceDrag(t.clientX,t.clientY);}
});

$('bb-again').addEventListener('click',    e=>{e.stopPropagation(); newGame();});
$('bb-again').addEventListener('touchend', e=>{e.preventDefault(); e.stopPropagation(); newGame();});

/* ═══════════════════════════════════════
   САПЁР — ЛОГИКА
═══════════════════════════════════════ */
const MS_CFG = {
    easy:   {rows:9, cols:9, mines:10},
    medium: {rows:9, cols:9, mines:15},
    hard:   {rows:9, cols:9, mines:20},
};
let msDiff      = localStorage.getItem('ms_diff') || 'easy';
let msCells     = [];
let msMineTotal, msFlags, msRevCount, msDead, msWon, msStarted;
let msTimerInt  = null, msSecs = 0;

function msNewGame() {
    const cfg = MS_CFG[msDiff];
    clearInterval(msTimerInt); msTimerInt=null; msSecs=0;
    msMineTotal=cfg.mines; msFlags=0; msRevCount=0;
    msDead=false; msWon=false; msStarted=false;
    $('ms-mines-count').textContent=`🚩 ${msMineTotal}`;
    $('ms-timer-disp').textContent=`⏱ 0`;
    $('ms-over').classList.remove('show');
    msDrawBoard(cfg);
}

function msDrawBoard({rows,cols}) {
    const brd=$('ms-board');
    brd.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    brd.innerHTML='';
    msCells = Array.from({length:rows}, (_,r) =>
        Array.from({length:cols}, (_,c) => {
            const el=document.createElement('div');
            el.className='ms-cell';
            el.dataset.r=r; el.dataset.c=c;
            let _lpt=null, _lpf=false, _lastT=0;
            let _mlpt=null, _mlf=false;

            el.addEventListener('mousedown', e => {
                if (e.button!==0) return;
                e.stopPropagation();
                _mlf=false;
                _mlpt=setTimeout(()=>{ _mlf=true; _mlpt=null; msFlag(r,c); }, 500);
            });
            el.addEventListener('mouseup', ()=>{
                if (_mlpt){clearTimeout(_mlpt); _mlpt=null;}
            });
            el.addEventListener('mouseleave', ()=>{
                if (_mlpt){clearTimeout(_mlpt); _mlpt=null;}
            });

            el.addEventListener('click', e => {
                e.stopPropagation();
                if (Date.now()-_lastT<350) return;
                if (_mlf) { _mlf=false; return; }
                msReveal(r,c);
            });
            el.addEventListener('contextmenu', e => {
                e.preventDefault(); e.stopPropagation(); msFlag(r,c);
            });
            el.addEventListener('touchstart', e => {
                e.stopPropagation(); _lpf=false;
                _lpt=setTimeout(()=>{ _lpf=true; msFlag(r,c); },500);
            },{passive:true});
            el.addEventListener('touchend', e => {
                e.stopPropagation(); _lastT=Date.now();
                if (_lpt){clearTimeout(_lpt); _lpt=null;}
                if (!_lpf) msReveal(r,c);
                _lpf=false;
            });
            el.addEventListener('touchmove', ()=>{
                if (_lpt){clearTimeout(_lpt); _lpt=null;}
            });
            brd.appendChild(el);
            return {el, value:0, revealed:false, flagged:false};
        })
    );
}

function msPlaceMines(rows,cols,mines,safeR,safeC) {
    const grid=Array.from({length:rows},()=>Array(cols).fill(0));
    const safe=new Set();
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
        const nr=safeR+dr, nc=safeC+dc;
        if (nr>=0&&nr<rows&&nc>=0&&nc<cols) safe.add(`${nr},${nc}`);
    }
    let placed=0;
    while (placed<mines) {
        const r=rnd(rows), c=rnd(cols);
        if (!grid[r][c]&&!safe.has(`${r},${c}`)){grid[r][c]=-1; placed++;}
    }
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        if (grid[r][c]===-1) continue;
        let n=0;
        for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
            const nr=r+dr, nc=c+dc;
            if (nr>=0&&nr<rows&&nc>=0&&nc<cols&&grid[nr][nc]===-1) n++;
        }
        grid[r][c]=n;
    }
    return grid;
}

function msReveal(r,c) {
    if (msDead||msWon) return;
    const cfg=MS_CFG[msDiff];
    const cell=msCells[r]?.[c];
    if (!cell||cell.revealed||cell.flagged) return;

    if (!msStarted) {
        msStarted=true;
        const grid=msPlaceMines(cfg.rows,cfg.cols,cfg.mines,r,c);
        msCells.forEach((row,ri)=>row.forEach((cel,ci)=>{ cel.value=grid[ri][ci]; }));
        msTimerInt=setInterval(()=>{ msSecs++; $('ms-timer-disp').textContent=`⏱ ${msSecs}`; },1000);
    }

    if (cell.value===-1) {
        cell.revealed=true; cell.el.classList.add('revealed','mine-hit'); cell.el.textContent='💥';
        msDead=true; clearInterval(msTimerInt);
        setTimeout(()=>{
            msCells.flat().forEach(cc=>{
                if (cc.value===-1&&!cc.revealed){cc.el.classList.add('revealed','mine-reveal'); cc.el.textContent='💣';}
                if (cc.flagged&&cc.value!==-1) cc.el.textContent='❌';
            });
            $('ms-over-title').textContent='💥 Подрыв!';
            $('ms-result').textContent=`Время: ${msSecs}с`;
            $('ms-over').classList.add('show');
        }, 600);
        return;
    }

    msFlood(r,c,cfg);
    msCheckWin(cfg);
}

function msFlood(r,c,cfg) {
    const q=[[r,c]], vis=new Set([`${r},${c}`]);
    while (q.length) {
        const [cr,cc]=q.shift();
        const cell=msCells[cr][cc];
        if (cell.revealed||cell.flagged) continue;
        cell.revealed=true; cell.el.classList.add('revealed'); msRevCount++;
        if (cell.value>0){ cell.el.textContent=cell.value; cell.el.classList.add(`ms-n${cell.value}`); }
        if (cell.value===0) {
            for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
                const nr=cr+dr, nc=cc+dc;
                if (nr>=0&&nr<cfg.rows&&nc>=0&&nc<cfg.cols&&!vis.has(`${nr},${nc}`)){
                    vis.add(`${nr},${nc}`); q.push([nr,nc]);
                }
            }
        }
    }
}

function msFlag(r,c) {
    if (msDead||msWon||!msStarted) return;
    const cell=msCells[r]?.[c];
    if (!cell||cell.revealed) return;
    cell.flagged=!cell.flagged;
    if (cell.flagged){cell.el.classList.add('flagged'); cell.el.textContent='🚩'; msFlags++;}
    else{cell.el.classList.remove('flagged'); cell.el.textContent=''; msFlags--;}
    $('ms-mines-count').textContent=`🚩 ${msMineTotal-msFlags}`;
}

function msCheckWin(cfg) {
    if (msRevCount===cfg.rows*cfg.cols-cfg.mines) {
        msWon=true; clearInterval(msTimerInt);
        msCells.flat().forEach(cc=>{
            if (!cc.revealed&&!cc.flagged){cc.el.textContent='🚩'; cc.el.classList.add('flagged');}
        });
        const bKey=`ms_best_${msDiff}`, prev=+localStorage.getItem(bKey)||0;
        if (!prev||msSecs<prev) localStorage.setItem(bKey,msSecs);
        const bestT=localStorage.getItem(bKey);
        $('ms-over-title').textContent='🎉 Победа!';
        $('ms-result').textContent=`Время: ${msSecs}с · Рекорд: ${bestT}с`;
        $('ms-over').classList.add('show');
    }
}

$('ms-again').addEventListener('click',    e=>{e.stopPropagation(); msNewGame();});
$('ms-again').addEventListener('touchend', e=>{e.preventDefault(); e.stopPropagation(); msNewGame();});

msPanel.querySelectorAll('.ms-diff-btn').forEach(b=>{
    if (b.dataset.d===msDiff) b.classList.add('active');
    b.addEventListener('click', e=>{
        e.stopPropagation();
        msDiff=b.dataset.d; localStorage.setItem('ms_diff',msDiff);
        msPanel.querySelectorAll('.ms-diff-btn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        msNewGame();
    });
});

/* ═══════════════════════════════════════
   2048 — ЛОГИКА
═══════════════════════════════════════ */
let g2048Grid, g2048Score, g2048Dead, g2048Won;
let g2048Best = +localStorage.getItem('g2048_best') || 0;
$('g2048-best').textContent = g2048Best;

function g2048New() {
    g2048Grid = Array.from({length:4}, () => Array(4).fill(0));
    g2048Score = 0; g2048Dead = false; g2048Won = false;
    $('g2048-score').textContent = '0';
    $('g2048-over').classList.remove('show');
    g2048Spawn(); g2048Spawn();
    g2048Draw();
}

function g2048Spawn() {
    const empty = [];
    for (let r=0; r<4; r++) for (let c=0; c<4; c++) if (!g2048Grid[r][c]) empty.push([r,c]);
    if (!empty.length) return;
    const [r,c] = empty[rnd(empty.length)];
    g2048Grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function g2048Draw() {
    const brd = $('g2048-board');
    brd.innerHTML = '';
    for (let r=0; r<4; r++) for (let c=0; c<4; c++) {
        const el = document.createElement('div');
        const v = g2048Grid[r][c];
        el.className = 'g2048-cell' + (v ? ` g2048-v${v <= 2048 ? v : 'max'}` : '');
        if (v) el.textContent = v;
        brd.appendChild(el);
    }
}

function g2048Move(dir) {
    if (g2048Dead || g2048Won) return;
    const prevStr = JSON.stringify(g2048Grid);

    for (let i=0; i<4; i++) {
        let line;
        if (dir==='left'||dir==='right') {
            line = g2048Grid[i].slice();
        } else {
            line = [g2048Grid[0][i],g2048Grid[1][i],g2048Grid[2][i],g2048Grid[3][i]];
        }
        if (dir==='right'||dir==='down') line.reverse();

        const nonz = line.filter(v => v);
        for (let j=0; j<nonz.length-1; j++) {
            if (nonz[j]===nonz[j+1]) {
                nonz[j]*=2; g2048Score+=nonz[j];
                if (nonz[j]===2048) g2048Won=true;
                nonz.splice(j+1,1);
            }
        }
        while (nonz.length<4) nonz.push(0);
        if (dir==='right'||dir==='down') nonz.reverse();

        if (dir==='left'||dir==='right') g2048Grid[i]=nonz;
        else for (let r=0; r<4; r++) g2048Grid[r][i]=nonz[r];
    }

    if (JSON.stringify(g2048Grid)!==prevStr) g2048Spawn();

    $('g2048-score').textContent = g2048Score;
    if (g2048Score > g2048Best) {
        g2048Best = g2048Score;
        localStorage.setItem('g2048_best', g2048Best);
        $('g2048-best').textContent = g2048Best;
    }

    g2048Draw();

    if (g2048Won) {
        $('g2048-over-title').textContent = '🎉 2048!';
        $('g2048-final').textContent = `Score: ${g2048Score}`;
        $('g2048-over').classList.add('show');
        return;
    }
    if (!g2048CanMove()) {
        g2048Dead = true;
        $('g2048-over-title').textContent = '😵 Game Over';
        $('g2048-final').textContent = `Score: ${g2048Score}`;
        $('g2048-over').classList.add('show');
    }
}

function g2048CanMove() {
    for (let r=0; r<4; r++) for (let c=0; c<4; c++) {
        if (!g2048Grid[r][c]) return true;
        if (c<3 && g2048Grid[r][c]===g2048Grid[r][c+1]) return true;
        if (r<3 && g2048Grid[r][c]===g2048Grid[r+1][c]) return true;
    }
    return false;
}

let _g2sx=0, _g2sy=0, _g2drag=false;

panel2048.addEventListener('mousedown', e => {
    _g2sx=e.clientX; _g2sy=e.clientY; _g2drag=true;
});
panel2048.addEventListener('mouseup', e => {
    if (!_g2drag) return; _g2drag=false;
    const dx=e.clientX-_g2sx, dy=e.clientY-_g2sy;
    if (Math.abs(dx)<30&&Math.abs(dy)<30) return;
    if (Math.abs(dx)>Math.abs(dy)) g2048Move(dx>0?'right':'left');
    else g2048Move(dy>0?'down':'up');
});
panel2048.addEventListener('mouseleave', () => { _g2drag=false; });

panel2048.addEventListener('touchstart', e => {
    e.stopPropagation();
    const t=e.touches[0]; _g2sx=t.clientX; _g2sy=t.clientY;
},{passive:true});
panel2048.addEventListener('touchend', e => {
    e.stopPropagation();
    const t=e.changedTouches[0];
    const dx=t.clientX-_g2sx, dy=t.clientY-_g2sy;
    if (Math.abs(dx)<30&&Math.abs(dy)<30) return;
    if (Math.abs(dx)>Math.abs(dy)) g2048Move(dx>0?'right':'left');
    else g2048Move(dy>0?'down':'up');
});

$('g2048-again').addEventListener('click',    e=>{e.stopPropagation(); g2048New();});
$('g2048-again').addEventListener('touchend', e=>{e.preventDefault(); e.stopPropagation(); g2048New();});

/* ═══════════════════════════════════════
   МЕМОРИ — КОНФИГ
═══════════════════════════════════════ */
const MEM_EXT_PATH = 'scripts/extensions/third-party/tet';

const MEM_CARDS_ALL = [
    'death','emperor','empress','justice','sun',
    'the_devil','the_fool_2v','the_fool','the_hanged_man',
    'the_hermit','the_high_priestess','the_lovers_2v','the_lovers',
    'the_moon','the_star','the_tower','the_world','wheel_of_fortune'
];

// Уровни: { pairs, time(сек), cols }
// Уровень 1: 2 пары / 2×2 / 40с
// Уровень 2: 4 пары / 2×4 / 60с
// Уровень 3: 6 пар  / 3×4 / 90с
// Уровень 4+: 8 пар / 4×4 / 120с (рандомные 8 из 18 карт)
const MEM_LEVELS = [
    { pairs:2,  time:40,  cols:2 },
    { pairs:4,  time:60,  cols:4 },
    { pairs:6,  time:90,  cols:4 },
    { pairs:8,  time:120, cols:4 },
];

/* ═══════════════════════════════════════
   МЕМОРИ — СОСТОЯНИЕ
═══════════════════════════════════════ */
let memLevel = +localStorage.getItem('mem_level') || 1;
let memCards = [];
let memFlipped = [];
let memMatches = 0;
let memTimer = null;
let memTimeLeft = 0;
let memLocked = false;
let memGameActive = false;
let memBest = JSON.parse(localStorage.getItem('mem_best') || '{}');

function memShuffle(arr) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
}

function memGetCfg() {
    return MEM_LEVELS[Math.min(memLevel-1, MEM_LEVELS.length-1)];
}

function memPickCards(pairs) {
    // Для уровней выше 3 (12 пар) всегда берём рандомные 12 из 18
    return memShuffle([...MEM_CARDS_ALL]).slice(0, pairs);
}

function memNewGame() {
    clearInterval(memTimer);
    memFlipped = []; memMatches = 0; memLocked = false; memGameActive = true;

    const cfg = memGetCfg();
    memTimeLeft = cfg.time;

    // Выбираем карты и дублируем для пар
    const picked = memPickCards(cfg.pairs);
    const doubled = memShuffle(
        [...picked, ...picked].map((img, i) => ({ id:i, img, revealed:false, matched:false, el:null }))
    );
    memCards = doubled;

    $('mem-level-num').textContent = memLevel;
    $('mem-pairs').textContent = `${cfg.pairs} пар · ${cfg.time}с`;
    $('mem-timer').textContent = cfg.time;
    $('mem-timer').style.color = '';
    $('mem-over').classList.remove('show');
    memUpdateBest();
    memRenderBoard(cfg.cols);
    memStartTimer();
}

function memStartTimer() {
    clearInterval(memTimer);
    memTimer = setInterval(() => {
        memTimeLeft--;
        const timerEl = $('mem-timer');
        if (timerEl) {
            timerEl.textContent = memTimeLeft;
            timerEl.style.color = memTimeLeft <= 10 ? '#e94560' : '';
        }
        if (memTimeLeft <= 0) {
            clearInterval(memTimer);
            memGameOver(false);
        }
    }, 1000);
}

function memRenderBoard(cols) {
    const board = $('mem-board');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    memCards.forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'mem-card';

        const inner = document.createElement('div');
        inner.className = 'mem-card-inner';

        const back = document.createElement('div');
        back.className = 'mem-card-back';
        const backImg = document.createElement('img');
        backImg.src = `${MEM_EXT_PATH}/images/back.png`;
        backImg.draggable = false;
        back.appendChild(backImg);

        const front = document.createElement('div');
        front.className = 'mem-card-front';
        const frontImg = document.createElement('img');
        frontImg.src = `${MEM_EXT_PATH}/images/${card.img}.jpg`;
        frontImg.draggable = false;
        front.appendChild(frontImg);

        inner.appendChild(back);
        inner.appendChild(front);
        el.appendChild(inner);

        el.addEventListener('click', e => { e.stopPropagation(); memFlip(idx); });
        el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); memFlip(idx); });

        board.appendChild(el);
        memCards[idx].el = el;
    });
}

function memFlip(idx) {
    const card = memCards[idx];
    if (!memGameActive || memLocked || card.revealed || card.matched) return;

    card.revealed = true;
    card.el.classList.add('flipped');
    memFlipped.push(idx);

    if (memFlipped.length === 2) {
        memLocked = true;
        const [a, b] = memFlipped;

        if (memCards[a].img === memCards[b].img) {
            // Совпадение!
            setTimeout(() => {
                memCards[a].el.classList.add('matched');
                memCards[b].el.classList.add('matched');
                memCards[a].matched = true;
                memCards[b].matched = true;
                memFlipped = [];
                memLocked = false;
                memMatches++;

                const cfg = memGetCfg();
                if (memMatches === cfg.pairs) {
                    memGameOver(true);
                }
            }, 350);
        } else {
            // Не совпало — переворачиваем обратно
            setTimeout(() => {
                memCards[a].revealed = false;
                memCards[b].revealed = false;
                memCards[a].el.classList.remove('flipped');
                memCards[b].el.classList.remove('flipped');
                memFlipped = [];
                memLocked = false;
            }, 900);
        }
    }
}

function memGameOver(won) {
    clearInterval(memTimer);
    memGameActive = false;

    if (won) {
        const cfg = memGetCfg();
        const timeTaken = cfg.time - memTimeLeft;
        const key = `lv${memLevel}`;
        if (!memBest[key] || timeTaken < memBest[key]) {
            memBest[key] = timeTaken;
            localStorage.setItem('mem_best', JSON.stringify(memBest));
        }
        // Запоминаем достигнутый уровень
        const nextLv = memLevel + 1;
        localStorage.setItem('mem_level', nextLv);
    }

    $('mem-over-title').textContent = won ? '🎉 Отлично!' : '⏰ Время вышло!';
    const cfg = memGetCfg();
    $('mem-over-result').textContent = won
        ? `Уровень ${memLevel} пройден за ${cfg.time - memTimeLeft}с`
        : `Найдено ${memMatches} из ${cfg.pairs} пар`;
    $('mem-over-next').style.display = won ? 'inline-block' : 'none';
    $('mem-over').classList.add('show');

    if (won) memLevel++;
}

function memUpdateBest() {
    const key = `lv${memLevel}`;
    const b = memBest[key];
    const el = $('mem-best');
    if (el) el.textContent = b ? `Рекорд: ${b}с` : '';
}

/* Кнопки мемори */
$('mem-over-next').addEventListener('click', e => {
    e.stopPropagation(); memNewGame();
});
$('mem-over-next').addEventListener('touchend', e => {
    e.preventDefault(); e.stopPropagation(); memNewGame();
});
$('mem-over-retry').addEventListener('click', e => {
    e.stopPropagation();
    if (!$('mem-over-next').style.display || $('mem-over-next').style.display === 'none') {
        // проиграл — просто перезапуск
    } else {
        // выиграл но хочет повторить уровень
        memLevel = Math.max(1, memLevel - 1);
        localStorage.setItem('mem_level', memLevel);
    }
    memNewGame();
});
$('mem-over-retry').addEventListener('touchend', e => {
    e.preventDefault(); e.stopPropagation();
    if ($('mem-over-next').style.display === 'none') {
    } else {
        memLevel = Math.max(1, memLevel - 1);
        localStorage.setItem('mem_level', memLevel);
    }
    memNewGame();
});
$('mem-restart-btn').addEventListener('click', e => {
    e.stopPropagation(); memNewGame();
});
$('mem-restart-btn').addEventListener('touchend', e => {
    e.preventDefault(); e.stopPropagation(); memNewGame();
});

function memResetToLevel1() {
    memLevel = 1;
    localStorage.setItem('mem_level', 1);
    memNewGame();
}
$('mem-reset-btn').addEventListener('click', e => {
    e.stopPropagation(); memResetToLevel1();
});
$('mem-reset-btn').addEventListener('touchend', e => {
    e.preventDefault(); e.stopPropagation(); memResetToLevel1();
});


/* ═══════════════════════════════════════
   FLAPPY BIRD
═══════════════════════════════════════ */
flappyPanel = document.createElement('div');
flappyPanel.className = 'bb-panel fb-panel';
flappyPanel.innerHTML = `
  <div class="bb-header">
    <span class="bb-title">🐦 Flappy Bird</span>
    <div class="bb-score-box">
      <div class="bb-score-label">Score</div>
      <div class="bb-score" id="fb-score">0</div>
      <div class="bb-best">Best <span id="fb-best">0</span></div>
    </div>
  </div>
  <div class="fb-wrap">
    <canvas id="fb-canvas" width="288" height="320" class="fb-canvas"></canvas>
  </div>
  <div class="fb-help" id="fb-help">Click / Space to start</div>
`;
document.body.appendChild(flappyPanel);
flappyPanel.addEventListener('click', e => e.stopPropagation());
flappyPanel.addEventListener('touchend', e => e.stopPropagation());

/* — game constants — */
const FB_W=288, FB_H=320, FB_GROUND_H=32;
const FB_BIRD_X=60, FB_BIRD_R=11;
const FB_PIPE_W=44, FB_GAP=115, FB_SPEED=1.4;
const FB_GRAVITY=0.25, FB_FLAP=-5.5;

/* — game state — */
let fbState=0; // 0=HOME 1=PLAY 2=DEAD
let fbScore=0, fbBest=parseInt(localStorage.getItem('fb_best')||'0');
let fbBirdY=FB_H/2, fbBirdVY=0, fbFrame=0;
let fbPipes=[], fbGroundX=0;
let fbRAF=null, fbLastT=0;

$('fb-best').textContent=fbBest;

function fbRandGap(){
    return FB_GROUND_H+40+Math.random()*(FB_H-FB_GROUND_H-FB_GAP-80);
}
function fbStopLoop(){
    if(fbRAF){ cancelAnimationFrame(fbRAF); fbRAF=null; }
}
function fbInit(){
    fbState=0; fbScore=0; fbBirdY=FB_H/2; fbBirdVY=0; fbFrame=0; fbGroundX=0;
    fbPipes=[
        {x:FB_W+60,  gapY:fbRandGap(), scored:false},
        {x:FB_W+220, gapY:fbRandGap(), scored:false}
    ];
    $('fb-score').textContent=0;
    $('fb-help').textContent='Click / Space to start';
    fbStopLoop();
    fbRAF=requestAnimationFrame(fbLoop);
}
function fbFlap(){
    if(fbState===0){ fbState=1; $('fb-help').textContent=''; }
    else if(fbState===1){ fbBirdVY=FB_FLAP; }
    else if(fbState===2){ fbInit(); }
}
function fbLoop(ts){
    fbRAF=requestAnimationFrame(fbLoop);
    if(ts-fbLastT<25){ return; }
    fbLastT=ts;
    fbUpdate();
    fbDraw();
}
function fbUpdate(){
    if(fbState!==1) return;
    fbBirdVY+=FB_GRAVITY;
    fbBirdY+=fbBirdVY;
    fbGroundX=(fbGroundX-FB_SPEED);
    if(fbGroundX<-20) fbGroundX=0;
    for(const p of fbPipes){
        p.x-=FB_SPEED;
        if(p.x+FB_PIPE_W<0){ p.x+=FB_W+FB_PIPE_W+20; p.gapY=fbRandGap(); p.scored=false; }
        if(!p.scored && p.x+FB_PIPE_W < FB_BIRD_X-FB_BIRD_R){
            p.scored=true; fbScore++;
            $('fb-score').textContent=fbScore;
            if(fbScore>fbBest){ fbBest=fbScore; localStorage.setItem('fb_best',fbBest); $('fb-best').textContent=fbBest; }
        }
    }
    // ground / ceiling collision
    if(fbBirdY+FB_BIRD_R>=FB_H-FB_GROUND_H || fbBirdY-FB_BIRD_R<=0){ fbDie(); return; }
    // pipe collision
    for(const p of fbPipes){
        if(FB_BIRD_X+FB_BIRD_R>p.x+4 && FB_BIRD_X-FB_BIRD_R<p.x+FB_PIPE_W-4){
            if(fbBirdY-FB_BIRD_R<p.gapY || fbBirdY+FB_BIRD_R>p.gapY+FB_GAP){ fbDie(); return; }
        }
    }
}
function fbDie(){
    fbState=2;
    $('fb-help').textContent='Game Over! Click to restart';
}
function fbDraw(){
    const cv=$('fb-canvas'); if(!cv) return;
    const cx=cv.getContext('2d');
    // sky
    const sky=cx.createLinearGradient(0,0,0,FB_H-FB_GROUND_H);
    sky.addColorStop(0,'#4ec0ff'); sky.addColorStop(1,'#b3e5fc');
    cx.fillStyle=sky; cx.fillRect(0,0,FB_W,FB_H-FB_GROUND_H);
    // clouds (static decoration)
    cx.fillStyle='rgba(255,255,255,0.55)';
    for(const [cx2,cy2,r] of [[60,45,14],[130,30,10],[220,55,16],[30,70,8]]){
        cx.beginPath(); cx.arc(cx2,cy2,r,0,Math.PI*2); cx.fill();
        cx.beginPath(); cx.arc(cx2+r*0.7,cy2,r*0.7,0,Math.PI*2); cx.fill();
        cx.beginPath(); cx.arc(cx2-r*0.7,cy2,r*0.7,0,Math.PI*2); cx.fill();
    }
    // pipes
    for(const p of fbPipes){
        // top pipe body
        cx.fillStyle='#5cb85c'; cx.fillRect(p.x,0,FB_PIPE_W,p.gapY);
        // top pipe cap
        cx.fillStyle='#4cae4c'; cx.fillRect(p.x-4,p.gapY-20,FB_PIPE_W+8,20);
        cx.fillStyle='#3d8b3d'; cx.fillRect(p.x-4,p.gapY-22,FB_PIPE_W+8,4);
        // bottom pipe body
        cx.fillStyle='#5cb85c'; cx.fillRect(p.x,p.gapY+FB_GAP,FB_PIPE_W,FB_H);
        // bottom pipe cap
        cx.fillStyle='#4cae4c'; cx.fillRect(p.x-4,p.gapY+FB_GAP,FB_PIPE_W+8,20);
        cx.fillStyle='#3d8b3d'; cx.fillRect(p.x-4,p.gapY+FB_GAP+18,FB_PIPE_W+8,4);
        // pipe sheen
        cx.fillStyle='rgba(255,255,255,0.15)';
        cx.fillRect(p.x+4,0,8,p.gapY);
        cx.fillRect(p.x+4,p.gapY+FB_GAP,8,FB_H);
    }
    // ground
    cx.fillStyle='#c8a84b'; cx.fillRect(0,FB_H-FB_GROUND_H,FB_W,FB_GROUND_H);
    cx.fillStyle='#5a9e3a'; cx.fillRect(0,FB_H-FB_GROUND_H,FB_W,8);
    // ground stripe
    cx.fillStyle='rgba(0,0,0,0.07)';
    for(let gx=fbGroundX; gx<FB_W; gx+=20){ cx.fillRect(gx,FB_H-FB_GROUND_H,10,8); }
    // bird
    const tilt=Math.min(Math.max(fbBirdVY*3,-30),70);
    cx.save();
    cx.translate(FB_BIRD_X,fbBirdY);
    cx.rotate(tilt*Math.PI/180);
    // body
    cx.fillStyle='#f5c518'; cx.beginPath(); cx.ellipse(0,0,FB_BIRD_R,FB_BIRD_R-2,0,0,Math.PI*2); cx.fill();
    // wing
    const wOff=Math.sin(fbFrame*0.25)*4;
    cx.fillStyle='#e6a800';
    cx.beginPath(); cx.ellipse(-3,wOff,7,4,0.3,0,Math.PI*2); cx.fill();
    // eye white
    cx.fillStyle='#fff'; cx.beginPath(); cx.arc(5,-3,4,0,Math.PI*2); cx.fill();
    cx.fillStyle='#222'; cx.beginPath(); cx.arc(6,-3,2,0,Math.PI*2); cx.fill();
    cx.fillStyle='#fff'; cx.beginPath(); cx.arc(7,-4,0.8,0,Math.PI*2); cx.fill();
    // beak
    cx.fillStyle='#e94560';
    cx.beginPath(); cx.moveTo(FB_BIRD_R,0); cx.lineTo(FB_BIRD_R+8,-3); cx.lineTo(FB_BIRD_R+8,3); cx.closePath(); cx.fill();
    cx.restore();
    if(fbState===1) fbFrame++;
    // HOME overlay
    if(fbState===0){
        cx.fillStyle='rgba(0,0,0,0.32)'; cx.fillRect(0,0,FB_W,FB_H-FB_GROUND_H);
        cx.textAlign='center';
        cx.fillStyle='#fff'; cx.font='bold 22px "Segoe UI",sans-serif';
        cx.fillText('Flappy Bird',FB_W/2,FB_H/2-18);
        cx.fillStyle='#ffe082'; cx.font='12px "Segoe UI",sans-serif';
        cx.fillText('Click / Space to flap!',FB_W/2,FB_H/2+10);
    }
    // DEAD overlay
    if(fbState===2){
        cx.fillStyle='rgba(0,0,0,0.45)'; cx.fillRect(0,0,FB_W,FB_H-FB_GROUND_H);
        cx.textAlign='center';
        cx.fillStyle='#e94560'; cx.font='bold 24px "Segoe UI",sans-serif';
        cx.fillText('Game Over!',FB_W/2,FB_H/2-28);
        cx.fillStyle='#fff'; cx.font='14px "Segoe UI",sans-serif';
        cx.fillText('Score: '+fbScore+'   Best: '+fbBest,FB_W/2,FB_H/2+4);
        cx.fillStyle='#f5a623'; cx.font='12px "Segoe UI",sans-serif';
        cx.fillText('Click to restart',FB_W/2,FB_H/2+26);
    }
}
// Flappy Bird controls
$('fb-canvas').addEventListener('click',  e=>{ e.stopPropagation(); fbFlap(); });
$('fb-canvas').addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); fbFlap(); });
document.addEventListener('keydown', e=>{
    if((e.code==='Space'||e.key===' ')&&flappyPanelOpen){ e.preventDefault(); fbFlap(); }
});

/* ═══════════════════════════════════════
   ИНИЦИАЛИЗАЦИЯ
═══════════════════════════════════════ */
newGame();
msNewGame();
g2048New();
memNewGame();
console.log('🎮 [Games] v5.0 — Block Blast + Сапёр + 2048 + Мемори + Flappy Bird готово');
