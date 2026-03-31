import { eventSource, event_types } from '../../../../script.js';

/* ─── util ─── */
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(v, b));

/* ══ КНОПКА (фиксированная) ══ */
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

/* открытие/закрытие */
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
let best = +localStorage.getItem('bb_best_v4') || 0;
$('bb-best').textContent = best;
const rnd = n => Math.floor(Math.random()*n);
const sum = n => n.flat().reduce((a,v)=>a+v,0);

function canPlace(shape, row, col) {
    for (let r=0; r<shape.length; r++)
        for (let c=0; c<shape[r].length; c++)
            if (shape[r][c] && (row+r>=ROWS || col+c>=COLS || board[row+r][col+c])) return false;
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
    pieces=[mkP(),mkP(),mkP()];
    drawPieces();
    if (!pieces.some(p=>fitsAnywhere(p.shape))) gameOver();
}
function mkP(){ return {shape:SHAPES[rnd(SHAPES.length)],color:COLORS[rnd(COLORS.length)],used:false}; }

function doPlace(pIdx, row, col) {
    const p = pieces[pIdx];
    if (!canPlace(p.shape, row, col)) { msg("Can't place here!", 'bad'); return false; }
    for (let r=0;r<p.shape.length;r++)
        for (let c=0;c<p.shape[r].length;c++)
            if (p.shape[r][c]) board[row+r][col+c]=p.color;
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
    for (let r=0;r<ROWS;r++) if (board[r].every(v=>v)) for(let c=0;c<COLS;c++) f.add(`${r}_${c}`);
    for (let c=0;c<COLS;c++) if (board.every(row=>row[c])) for(let r=0;r<ROWS;r++) f.add(`${r}_${c}`);
    let rows=new Set(),cols=new Set();
    f.forEach(k=>{const[r,c]=k.split('_');rows.add(r);cols.add(c);});
    let cl=0;
    for(const r of rows) if([...Array(COLS).keys()].every(c=>f.has(`${r}_${c}`))) cl++;
    for(const c of cols) if([...Array(ROWS).keys()].every(r=>f.has(`${r}_${c}`))) cl++;
    f.forEach(k=>{
        const[r,c]=k.split('_').map(Number);
        board[r][c]=null;
        const el=$('bb-board')?.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if(el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),300);}
    });
    return cl;
}
function updateScore() {
    $('bb-score').textContent=score;
    if(score>best){best=score;localStorage.setItem('bb_best_v4',best);$('bb-best').textContent=best;}
}
function gameOver() {
    dead=true;
    $('bb-final').textContent=`Score: ${score}  •  Best: ${best}`;
    $('bb-over').classList.add('show');
}
function msg(t,type){const e=$('bb-msg');e.textContent=t;e.className='bb-msg'+(type?` ${type}`:'');}

/* ══ РЕНДЕР ДОСКИ ══ */
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
    for(let r=0;r<shape.length;r++) for(let c=0;c<shape[r].length;c++) if(shape[r][c]){
        const el=$('bb-board')?.querySelector(`[data-r="${row+r}"][data-c="${col+c}"]`);
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

/* ══ DRAG & DROP ФИГУР ══ */
let dragIdx=null, dragGhost=null;

function buildGhostEl(piece) {
    const el=document.createElement('div');
    el.className='bb-drag-ghost';
    el.style.gridTemplateColumns=`repeat(${piece.shape[0].length}, 26px)`;
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

function moveDragGhost(cx,cy){
    if(!dragGhost) return;
    const gh=dragGhost;
    const gw=gh.offsetWidth||0, gh_h=gh.offsetHeight||0;
    gh.style.left=(cx-gw/2)+'px';
    gh.style.top=(cy-gh_h/2)+'px';
    // найти клетку под курсором
    gh.style.visibility='hidden';
    const el=document.elementFromPoint(cx,cy);
    gh.style.visibility='';
    const p=pieces[dragIdx];
    if(el?.classList.contains('bb-cell')){
        showGhost(p.shape,+el.dataset.r,+el.dataset.c,p.color);
    } else {
        clearGhost();
    }
}

function endDrag(cx,cy){
    if(dragGhost){dragGhost.remove();dragGhost=null;}
    clearGhost();
    if(dragIdx===null) return;
    const el=(() => {
        const tmp=document.elementFromPoint(cx,cy);
        return tmp?.classList.contains('bb-cell') ? tmp : null;
    })();
    const idx=dragIdx; dragIdx=null;
    const slot=$(`bb-s${idx}`);
    if(slot) slot.classList.remove('dragging');
    if(el && !dead) doPlace(idx,+el.dataset.r,+el.dataset.c);
}

/* ══ РЕНДЕР ФИГУР ══ */
function drawPieces(){
    for(let i=0;i<3;i++){
        const old=$(`bb-s${i}`);
        const slot=old.cloneNode(false);
        slot.id=`bb-s${i}`;
        old.parentNode.replaceChild(slot,old);
        const p=pieces[i];
        slot.className='bb-slot'+(p.used?' used':'');
        if(p.used) return;  // пропустить слушатели для использованных

        // MOUSE drag
        slot.addEventListener('mousedown',e=>{
            if(p.used||dead) return;
            e.preventDefault(); e.stopPropagation();
            dragIdx=i;
            slot.classList.add('dragging');
            dragGhost=buildGhostEl(p);
            moveDragGhost(e.clientX,e.clientY);
        });

        // TOUCH drag
        slot.addEventListener('touchstart',e=>{
            if(p.used||dead) return;
            e.stopPropagation();
            dragIdx=i;
            slot.classList.add('dragging');
            dragGhost=buildGhostEl(p);
            const t=e.touches[0];
            moveDragGhost(t.clientX,t.clientY);
        },{passive:true});

        // рендер миниатюры фигуры
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

/* глобальные mouse/touch move+up */
document.addEventListener('mousemove',e=>{if(dragIdx!==null) moveDragGhost(e.clientX,e.clientY);});
document.addEventListener('mouseup',  e=>{if(dragIdx!==null) endDrag(e.clientX,e.clientY);});
document.addEventListener('touchmove',e=>{
    if(dragIdx===null) return;
    e.preventDefault();
    const t=e.touches[0]; moveDragGhost(t.clientX,t.clientY);
},{passive:false});
document.addEventListener('touchend',e=>{
    if(dragIdx===null) return;
    const t=e.changedTouches[0]; endDrag(t.clientX,t.clientY);
});

$('bb-again').addEventListener('click',    e=>{e.stopPropagation();newGame();});
$('bb-again').addEventListener('touchend', e=>{e.preventDefault();e.stopPropagation();newGame();});

newGame();
console.log('🎮 [BlockBlast] v1.3 drag&drop ready!');
