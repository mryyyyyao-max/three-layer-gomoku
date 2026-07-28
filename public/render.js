import { allCells, axialToPixel, key, neighbors } from '/shared/board.js?v=7';

const BG = '#d4c7ae';
const FILL_UP = 'rgba(92, 72, 48, 0.07)';
const FILL_DOWN = 'rgba(255, 248, 235, 0.55)';
const GRID = 'rgba(90, 70, 48, 0.38)';
const DOT = 'rgba(70, 52, 34, 0.55)';
const COLOR_A = { body: '#3f2c1d', top: '#5c4030', rim: '#24180f' };
const COLOR_B = { body: '#f0e8dc', top: '#fffcf7', rim: '#b9a890' };

function pieceColors(player) {
  return player === 'A' ? COLOR_A : COLOR_B;
}

function drawCylinder(ctx, x, y, radius, player, alpha = 1) {
  const c = pieceColors(player);
  const height = radius * 0.58;
  const rx = radius * 0.95;
  const ry = radius * 0.44;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.body;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.lineTo(x - rx, y - height);
  ctx.ellipse(x, y - height, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = c.body;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x, y - height, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.top;
  ctx.fill();
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.restore();
}

function drawGroundShadow(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.08, radius * 0.7, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 28, 16, 0.28)';
  ctx.fill();
}

function triangleOrientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** 上下三角交替浅填色，打断「立方体」错觉 */
function drawTriangleFills(ctx, cells, origin, size) {
  const cellSet = new Set(cells.map((c) => key(c.q, c.r)));
  const drawn = new Set();

  for (const a of cells) {
    const aKey = key(a.q, a.r);
    const nbs = neighbors(a.q, a.r);
    for (let i = 0; i < nbs.length; i++) {
      for (let j = i + 1; j < nbs.length; j++) {
        const b = nbs[i];
        const c = nbs[j];
        const bKey = key(b.q, b.r);
        const cKey = key(c.q, c.r);
        if (!cellSet.has(bKey) || !cellSet.has(cKey)) continue;
        // b,c must be neighbors of each other
        if (!neighbors(b.q, b.r).some((n) => n.q === c.q && n.r === c.r)) continue;

        const triKey = [aKey, bKey, cKey].sort().join('|');
        if (drawn.has(triKey)) continue;
        drawn.add(triKey);

        const ap = axialToPixel(a.q, a.r, size);
        const bp = axialToPixel(b.q, b.r, size);
        const cp = axialToPixel(c.q, c.r, size);
        const ax = origin.x + ap.x;
        const ay = origin.y + ap.y;
        const bx = origin.x + bp.x;
        const by = origin.y + bp.y;
        const cx = origin.x + cp.x;
        const cy = origin.y + cp.y;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = triangleOrientation(ax, ay, bx, by, cx, cy) > 0 ? FILL_UP : FILL_DOWN;
        ctx.fill();
      }
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|null} state
 * @param {{
 *   size: number,
 *   origin: {x: number, y: number},
 *   highlights?: Array<{q:number,r:number,color:string}>,
 *   selected?: {q:number,r:number}|null,
 *   ghost?: {q:number,r:number,player:string}|null,
 *   liftSelected?: boolean,
 * }} opts
 */
export function drawBoard(ctx, state, opts) {
  const {
    size,
    origin,
    highlights = [],
    selected = null,
    ghost = null,
    liftSelected = true,
  } = opts;

  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const cells = allCells();
  drawTriangleFills(ctx, cells, origin, size);

  const drawn = new Set();
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';

  for (const cell of cells) {
    const aKey = key(cell.q, cell.r);
    const aPix = axialToPixel(cell.q, cell.r, size);
    const ax = origin.x + aPix.x;
    const ay = origin.y + aPix.y;

    for (const n of neighbors(cell.q, cell.r)) {
      const bKey = key(n.q, n.r);
      const edgeKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      if (drawn.has(edgeKey)) continue;
      drawn.add(edgeKey);

      const bPix = axialToPixel(n.q, n.r, size);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(origin.x + bPix.x, origin.y + bPix.y);
      ctx.stroke();
    }
  }

  for (const cell of cells) {
    const p = axialToPixel(cell.q, cell.r, size);
    ctx.beginPath();
    ctx.arc(origin.x + p.x, origin.y + p.y, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = DOT;
    ctx.fill();
  }

  for (const h of highlights) {
    const p = axialToPixel(h.q, h.r, size);
    const x = origin.x + p.x;
    const y = origin.y + p.y;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = h.color || 'rgba(46, 120, 72, 0.32)';
    ctx.fill();
  }

  if (selected) {
    const p = axialToPixel(selected.q, selected.r, size);
    const x = origin.x + p.x;
    const y = origin.y + p.y;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(122, 78, 36, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const pieceR = size * 0.46;
  const layerLift = size * 0.36;
  const hoverLift = size * 0.78;

  if (ghost) {
    const p = axialToPixel(ghost.q, ghost.r, size);
    const x = origin.x + p.x;
    const y = origin.y + p.y;
    drawGroundShadow(ctx, x, y, pieceR * 0.95);
    drawCylinder(ctx, x, y - size * 0.1, pieceR, ghost.player, 0.4);
  }

  if (!state?.cells) return;

  const stacks = [];
  for (const cell of cells) {
    const stack = state.cells[key(cell.q, cell.r)];
    if (!stack || stack.length === 0) continue;
    const p = axialToPixel(cell.q, cell.r, size);
    stacks.push({
      q: cell.q,
      r: cell.r,
      stack,
      x: origin.x + p.x,
      y: origin.y + p.y,
    });
  }

  stacks.sort((a, b) => a.y - b.y || a.x - b.x);

  for (const { q, r, stack, x, y } of stacks) {
    const isSel =
      liftSelected && selected && selected.q === q && selected.r === r;
    const topIndex = stack.length - 1;

    for (let i = 0; i < stack.length; i++) {
      const baseLift = i * layerLift;
      if (isSel && i === topIndex) {
        drawGroundShadow(ctx, x, y - baseLift, pieceR);
        drawCylinder(ctx, x, y - baseLift - hoverLift, pieceR, stack[i], 1);
      } else {
        drawCylinder(ctx, x, y - baseLift, pieceR, stack[i]);
      }
    }
  }
}
