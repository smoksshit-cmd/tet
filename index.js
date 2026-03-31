import { eventSource, event_types } from '../../../../script.js';

const $ = id => document.getElementById(id);
const GHOST_CELL = 28; // размер ячейки в плавающем ghost (px, должен совпадать с CSS)

/* ══ КНОПКА ══ */
const btn = document.createElement('div');
btn.className = 'bb-btn fa-solid fa-gamepad';
btn.title = 'Block Blast';
document.body.appendChild(btn);

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

/* ── открытие/закрытие ── */
let panelOpen = false;
btn.addEventListener('click', e => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
});
panel.addEventListener('click',    e => e.stopPropagation());
panel.addEventListener('touchend', e => e.stopPropagation());
document.addEventListener('click', () => { if (panelOpen) { panelOpen = false; panel.classList.remove('open'); } });

/* генерация */
eventSource.on(event_types.GENERATION_STARTED, () => btn.classList.add('bb-gen'));
eventSource.on(event_types.GENERATION_ENDED,   () => btn.classList.remove('bb-gen'));
eventSource.on(event_types.GENERATION_STOPPED, () => btn.classList.remove('bb-gen'));

/* ════════════════ ИГРА ════════════════ */
const ROWS=8, COLS=8;
const COLORS=['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#00bcd4','#ff5722','#e91e63'];
const SHAPES=[
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

let board, score, pieces, dead;
let best = +localStorage.getItem('bb_best_v5') || 0;
$('bb-best').textContent = best;
const rnd = n => Math.floor(Math.random()*n);
const sum = n => n.flat().reduce((a,v)=>a+v,0);

function canPlace(shape, r, c) {
    for (let dr=0; dr<shape.length; dr++)
        for (let dc=0; dc<shape[dr].length; dc++)
            if (shape[dr][dc] && (r+dr>=ROWS || c+dc>=COLS || board[r+dr][c+dc])) return false;
    return true;
}
function fitsAnywhere(shape) {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (canPlace(shape,r,c)) return true;
    return false;
}

function newGame() {
    board = Array.from({length:ROWS},()=>Array(COLS).fill(null));
    score=0; dead=false;
    $('bb-score').textContent='0';
    $('bb-over').classList.remove('show');
    msg('Drag a piece onto the board');
    drawBoard(); spawn();
}
function spawn() {
    pieces=[mkP(),mkP(),mkP()]; drawPieces();
    if (!pieces.some(p=>fitsAnywhere(p.shape))) gameOver();
}
function mkP() { return {shape:SHAPES[rnd(SHAPES.length)],color:COLORS[rnd(COLORS.length)],used:false}; }

function doPlace(pIdx, row, col) {
    const p = pieces[pIdx];
    if (!canPlace(p.shape, row, col)) { msg("Can't place here!",'bad'); return false; }
    for (let dr=0;dr<p.shape.length;dr++)
        for (let dc=0;dc<p.shape[dr].length;dc++)
            if (p.shape[dr][dc]) board[row+dr][col+dc]=p.color;
    p.used=true;
    score+=sum(p.shape);
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
    for(let r=0;r<ROWS;r++) if(board[r].every(v=>v)) for(let c=0;c<COLS;c++) f.add(`${r}_${c}`);
    for(let c=0;c<COLS;c++) if(board.every(row=>row[c])) for(let r=0;r<ROWS;r++) f.add(`${r}_${c}`);
    let rows=new Set(), cols=new Set();
    f.forEach(k=>{const[r,c]=k.split('_');rows.add(r);cols.add(c);});
    let cl=0;
    for(const r of rows) if([...Array(COLS).keys()].every(c=>f.has(`${r}_${c}`))) cl++;
    for(const c of cols) if([...Array(ROWS).keys()].every(r=>f.has(`${r}_${c}`))) cl++;
    f.forEach(k=>{
        const[r,c]=k.split('_').map(Number); board[r][c]=null;
        const el=$('bb-board')?.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if(el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),300);}
    });
    return cl;
}
function updateScore() {
    $('bb-score').textContent=score;
    if(score>best){best=score;localStorage.setItem('bb_best_v5',best);$('bb-best').textContent=best;}
}
function gameOver() {
    dead=true;
    $('bb-final').textContent=`Score: ${score}  •  Best: ${best}`;
    $('bb-over').classList.add('show');
}
function msg(t,type){const e=$('bb-msg');e.textContent=t;e.className='bb-msg'+(type?` ${type}`:'');}

/* ══ ДОСКА ══ */
function drawBoard() {
    const brd=$('bb-board');
    brd.querySelectorAll('.bb-cell').forEach(e=>e.remove());
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const el=document.createElement('div');
        el.className='bb-cell'+(board[r][c]?' filled':'');
        if(board[r][c]) el.style.background=board[r][c];
        el.dataset.r=r; el.dataset.c=c;
        brd.appendChild(el);
    }
}
function showGhost(shape,row,col,color){
    clearGhost();
    if(!canPlace(shape,row,col)) return false;
    for(let dr=0;dr<shape.length;dr++) for(let dc=0;dc<shape[dr].length;dc++) if(shape[dr][dc]){
        const el=$('bb-board')?.querySelector(`[data-r="${row+dr}"][data-c="${col+dc}"]`);
        if(el){el.classList.add('ghost','filled');el.style.background=color;}
    }
    return true;
}
function clearGhost(){
    $('bb-board')?.querySelectorAll('.bb-cell.ghost').forEach(el=>{
        const r=+el.dataset.r,c=+el.dataset.c;
        el.classList.remove('ghost','filled');
        el.style.background=board[r][c]||'';
        if(!board[r][c]) el.classList.remove('filled');
    });
}

/* ══ DRAG & DROP — КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ══
   dragOffX/Y = смещение курсора относительно ВЕРХНЕГО ЛЕВОГО угла ghost
   При поиске клетки ищем точку (ghostLeft + GHOST_CELL/2, ghostTop + GHOST_CELL/2)
   — это центр первой (верхней левой) ячейки ghost → точно совпадает с тем, что видит игрок
*/
let dragIdx=null, dragGhost=null, dragOffX=0, dragOffY=0;

function buildGhostEl(piece) {
    const el=document.createElement('div');
    el.className='bb-drag-ghost';
    el.style.gridTemplateColumns=`repeat(${piece.shape[0].length},${GHOST_CELL}px)`;
    piece.shape.forEach(row=>row.forEach(v=>{
        const c=document.createElement('div');
        c.className='bb-dc';
        c.style.background=v?piece.color:'transparent';
        if(!v)c.style.boxShadow='none';
        el.appendChild(c);
    }));
    document.body.appendChild(el);
    return el;
}

function startDrag(idx, cx, cy, pgridEl) {
    dragIdx = idx;
    // смещение = где курсор внутри pgrid (= верхний левый угол ghost)
    const rect = pgridEl.getBoundingClientRect();
    dragOffX = cx - rect.left;
    dragOffY = cy - rect.top;
    dragGhost = buildGhostEl(pieces[idx]);
    moveDragGhost(cx, cy);
    $(`bb-s${idx}`)?.classList.add('dragging');
}

function moveDragGhost(cx, cy) {
    if (!dragGhost) return;
    const gl = cx - dragOffX;
    const gt = cy - dragOffY;
    dragGhost.style.left = gl + 'px';
    dragGhost.style.top  = gt + 'px';

    // Ищем клетку под верхним левым углом ghost (+half cell чтобы попасть в центр первой ячейки)
    dragGhost.style.visibility = 'hidden';
    const el = document.elementFromPoint(gl + GHOST_CELL/2, gt + GHOST_CELL/2);
    dragGhost.style.visibility = '';

    const p = pieces[dragIdx];
    if (el?.classList.contains('bb-cell'))
        showGhost(p.shape, +el.dataset.r, +el.dataset.c, p.color);
    else
        clearGhost();
}

function endDrag(cx, cy) {
    if (!dragGhost) return;
    const gl = cx - dragOffX;
    const gt = cy - dragOffY;

    dragGhost.remove(); dragGhost = null;
    clearGhost();
    $(`bb-s${dragIdx}`)?.classList.remove('dragging');

    const el = document.elementFromPoint(gl + GHOST_CELL/2, gt + GHOST_CELL/2);
    const idx = dragIdx; dragIdx = null;

    if (el?.classList.contains('bb-cell') && !dead)
        doPlace(idx, +el.dataset.r, +el.dataset.c);
    else
        drawPieces(); // перерисовать без dragging-класса
}

/* ══ ФИГУРЫ ══ */
function drawPieces() {
    for(let i=0;i<3;i++){
        const old=$(`bb-s${i}`);
        const slot=old.cloneNode(false);
        slot.id=`bb-s${i}`;
        old.parentNode.replaceChild(slot,old);
        const p=pieces[i];
        slot.className='bb-slot'+(p.used?' used':'');
        if(p.used) continue;

        // MOUSE
        slot.addEventListener('mousedown', e => {
            if(dead) return;
            e.preventDefault(); e.stopPropagation();
            const pgrid = slot.querySelector('.bb-pgrid');
            startDrag(i, e.clientX, e.clientY, pgrid||slot);
        });
        // TOUCH
        slot.addEventListener('touchstart', e => {
            if(dead) return;
            e.stopPropagation();
            const t=e.touches[0];
            const pgrid = slot.querySelector('.bb-pgrid');
            startDrag(i, t.clientX, t.clientY, pgrid||slot);
        }, {passive:true});

        // рендер миниатюры
        const g=document.createElement('div');
        g.className='bb-pgrid';
        g.style.gridTemplateColumns=`repeat(${p.shape[0].length},18px)`;
        p.shape.forEach(row=>row.forEach(v=>{
            const c=document.createElement('div');
            c.className='bb-pcell';
            c.style.width='18px'; c.style.height='18px';
            c.style.background=v?p.color:'transparent';
            if(!v)c.style.boxShadow='none';
            g.appendChild(c);
        }));
        slot.appendChild(g);
    }
}

/* глобальные move/up */
document.addEventListener('mousemove', e => { if(dragIdx!==null) moveDragGhost(e.clientX,e.clientY); });
document.addEventListener('mouseup',   e => { if(dragIdx!==null) endDrag(e.clientX,e.clientY); });
document.addEventListener('touchmove', e => {
    if(dragIdx===null) return;
    e.preventDefault();
    const t=e.touches[0]; moveDragGhost(t.clientX,t.clientY);
},{passive:false});
document.addEventListener('touchend', e => {
    if(dragIdx===null) return;
    const t=e.changedTouches[0]; endDrag(t.clientX,t.clientY);
});

$('bb-again').addEventListener('click',    e=>{e.stopPropagation();newGame();});
$('bb-again').addEventListener('touchend', e=>{e.preventDefault();e.stopPropagation();newGame();});

newGame();
console.log('🎮 [BlockBlast] v1.4 ready');
