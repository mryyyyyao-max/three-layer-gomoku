export const RADIUS = 4;

export const NEIGHBOR_DELTAS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export const LINE_DIRS = [
  [1, 0], [0, 1], [1, -1],
];

export function key(q, r) {
  return `${q},${r}`;
}

export function parseKey(k) {
  const [qs, rs] = k.split(',');
  return { q: Number(qs), r: Number(rs) };
}

function hexDistance(q, r) {
  const s = -q - r;
  return (Math.abs(q) + Math.abs(r) + Math.abs(s)) / 2;
}

/** 大六边形六个尖角（与参考图一致：缺角） */
export function isCornerTip(q, r) {
  const s = -q - r;
  return hexDistance(q, r) === RADIUS && (q === 0 || r === 0 || s === 0);
}

export function allCells() {
  const cells = [];
  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      if (hexDistance(q, r) <= RADIUS && !isCornerTip(q, r)) {
        cells.push({ q, r });
      }
    }
  }
  return cells;
}

export function isCenter(q, r) {
  return q === 0 && r === 0;
}

export function inBoard(q, r) {
  return hexDistance(q, r) <= RADIUS && !isCornerTip(q, r);
}

export function neighbors(q, r) {
  const out = [];
  for (const [dq, dr] of NEIGHBOR_DELTAS) {
    const nq = q + dq;
    const nr = r + dr;
    if (inBoard(nq, nr)) out.push({ q: nq, r: nr });
  }
  return out;
}

export function axialToPixel(q, r, size) {
  const x = size * (3 / 2) * q;
  const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  return { x, y };
}
