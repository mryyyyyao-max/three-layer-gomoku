import { allCells, key, parseKey, isCenter, neighbors, inBoard, LINE_DIRS } from './board.js';

export const PLAYERS = ['A', 'B'];
export const HAND_SIZE = 25;
export const LAYOUT_SCRIPT = [
  { player: 'A', count: 1 },
  { player: 'B', count: 2 },
  { player: 'A', count: 2 },
  { player: 'B', count: 1 },
];

function emptyCells() {
  const cells = {};
  for (const { q, r } of allCells()) {
    cells[key(q, r)] = [];
  }
  return cells;
}

export function createGame() {
  return {
    phase: 'waiting',
    cells: emptyCells(),
    hand: { A: HAND_SIZE, B: HAND_SIZE },
    current: null,
    layoutStep: 0,
    layoutPlacedInStep: 0,
    winner: null,
    winReason: null,
    selectedAction: null,
  };
}

export function clone(state) {
  const cells = {};
  for (const [k, stack] of Object.entries(state.cells)) {
    cells[k] = stack.slice();
  }
  return {
    phase: state.phase,
    cells,
    hand: { A: state.hand.A, B: state.hand.B },
    current: state.current,
    layoutStep: state.layoutStep,
    layoutPlacedInStep: state.layoutPlacedInStep,
    winner: state.winner,
    winReason: state.winReason,
    selectedAction: state.selectedAction,
  };
}

export function startMatch(state) {
  const next = clone(state);
  next.phase = 'layout';
  next.current = 'A';
  next.layoutStep = 0;
  next.layoutPlacedInStep = 0;
  next.winner = null;
  next.winReason = null;
  next.selectedAction = null;
  return next;
}

export function resetMatch(_state) {
  return startMatch(createGame());
}

function topPlayer(stack) {
  return stack.length === 0 ? null : stack[stack.length - 1];
}

function checkFive(state, player) {
  for (const [k, stack] of Object.entries(state.cells)) {
    if (topPlayer(stack) !== player) continue;
    const { q, r } = parseKey(k);
    for (const [dq, dr] of LINE_DIRS) {
      const oppQ = q - dq;
      const oppR = r - dr;
      if (inBoard(oppQ, oppR)) {
        const oppStack = state.cells[key(oppQ, oppR)];
        if (topPlayer(oppStack) === player) continue;
      }
      let len = 0;
      let cq = q;
      let cr = r;
      while (inBoard(cq, cr)) {
        const s = state.cells[key(cq, cr)];
        if (topPlayer(s) !== player) break;
        len += 1;
        cq += dq;
        cr += dr;
      }
      if (len === 5) {
        return { winner: player, winReason: 'five' };
      }
    }
  }
  return null;
}

function checkFiveOnThird(state, player) {
  let count = 0;
  for (const stack of Object.values(state.cells)) {
    if (stack.length === 3 && stack[2] === player) count += 1;
  }
  if (count >= 5) {
    return { winner: player, winReason: 'fiveOnThird' };
  }
  return null;
}

function checkThreeAdjacentThird(state, player) {
  const thirdKeys = new Set();
  for (const [k, stack] of Object.entries(state.cells)) {
    if (stack.length === 3 && stack[2] === player) thirdKeys.add(k);
  }
  if (thirdKeys.size < 3) return null;

  const visited = new Set();
  let maxSize = 0;
  for (const startKey of thirdKeys) {
    if (visited.has(startKey)) continue;
    const { q, r } = parseKey(startKey);
    const queue = [{ q, r }];
    visited.add(startKey);
    let size = 0;
    while (queue.length > 0) {
      const { q: cq, r: cr } = queue.shift();
      size += 1;
      for (const n of neighbors(cq, cr)) {
        const nk = key(n.q, n.r);
        if (!thirdKeys.has(nk) || visited.has(nk)) continue;
        visited.add(nk);
        queue.push(n);
      }
    }
    maxSize = Math.max(maxSize, size);
  }
  if (maxSize >= 3) {
    return { winner: player, winReason: 'threeAdjacentThird' };
  }
  return null;
}

export function evaluateWinner(state, player) {
  return checkFive(state, player)
    || checkFiveOnThird(state, player)
    || checkThreeAdjacentThird(state, player);
}

export function checkWinner(state, player) {
  return evaluateWinner(state, player);
}

function fail(state, error) {
  return { ok: false, error, state };
}

function applyWinCheck(next, player) {
  const win = checkWinner(next, player);
  if (win) {
    next.phase = 'ended';
    next.winner = win.winner;
    next.winReason = win.winReason;
    next.current = null;
  }
  return { ok: true, state: next };
}

function applyWinCheckAfterMove(next, mover) {
  const win = checkWinner(next, mover) || checkWinner(next, otherPlayer(mover));
  if (win) {
    next.phase = 'ended';
    next.winner = win.winner;
    next.winReason = win.winReason;
    next.current = null;
  }
  return { ok: true, state: next };
}

function isBoardInt(q, r) {
  return Number.isInteger(q) && Number.isInteger(r);
}

function cellStack(state, q, r) {
  return state.cells[key(q, r)];
}

function hasOwnAdjacent(state, player, q, r) {
  for (const n of neighbors(q, r)) {
    const stack = cellStack(state, n.q, n.r);
    if (stack.some((p) => p === player)) return true;
  }
  return false;
}

function otherPlayer(player) {
  return player === 'A' ? 'B' : 'A';
}

export function advanceAfterLayoutPlace(state) {
  const step = LAYOUT_SCRIPT[state.layoutStep];
  state.layoutPlacedInStep += 1;
  if (state.layoutPlacedInStep < step.count) {
    return;
  }
  state.layoutStep += 1;
  state.layoutPlacedInStep = 0;
  if (state.layoutStep >= LAYOUT_SCRIPT.length) {
    state.phase = 'action';
    state.current = 'A';
    return;
  }
  state.current = LAYOUT_SCRIPT[state.layoutStep].player;
}

function applyLayoutPlace(state, player, q, r) {
  if (state.phase !== 'layout') {
    return fail(state, 'not in layout phase');
  }
  if (player !== state.current) {
    return fail(state, 'not your turn');
  }
  if (!inBoard(q, r)) {
    return fail(state, 'out of board');
  }
  if (isCenter(q, r)) {
    return fail(state, 'center forbidden in layout');
  }
  const k = key(q, r);
  if (state.cells[k].length !== 0) {
    return fail(state, 'cell occupied');
  }
  if (hasOwnAdjacent(state, player, q, r)) {
    return fail(state, 'adjacent to own stone');
  }
  if (state.hand[player] <= 0) {
    return fail(state, 'no pieces in hand');
  }

  const next = clone(state);
  next.cells[k].push(player);
  next.hand[player] -= 1;
  advanceAfterLayoutPlace(next);
  return applyWinCheck(next, player);
}

function applyActionPlace(state, player, q, r) {
  if (state.phase !== 'action') {
    return fail(state, 'not in action phase');
  }
  if (player !== state.current) {
    return fail(state, 'not your turn');
  }
  if (!inBoard(q, r)) {
    return fail(state, 'out of board');
  }
  if (state.hand[player] <= 0) {
    return fail(state, 'no pieces in hand');
  }
  const k = key(q, r);
  if (state.cells[k].length !== 0) {
    return fail(state, 'cell occupied');
  }

  const next = clone(state);
  next.cells[k].push(player);
  next.hand[player] -= 1;
  next.current = otherPlayer(player);
  return applyWinCheck(next, player);
}

export function applyPlace(state, player, q, r) {
  if (!isBoardInt(q, r) || state.cells[key(q, r)] == null) {
    return fail(state, 'out of board');
  }
  if (state.phase === 'layout') {
    return applyLayoutPlace(state, player, q, r);
  }
  if (state.phase === 'action') {
    return applyActionPlace(state, player, q, r);
  }
  return fail(state, 'cannot place in this phase');
}

export function applyMove(state, player, fromQ, fromR, toQ, toR) {
  if (state.phase !== 'action') {
    return fail(state, 'not in action phase');
  }
  if (player !== state.current) {
    return fail(state, 'not your turn');
  }
  if (!isBoardInt(fromQ, fromR) || !isBoardInt(toQ, toR)) {
    return fail(state, 'out of board');
  }
  if (!inBoard(fromQ, fromR) || !inBoard(toQ, toR)) {
    return fail(state, 'out of board');
  }

  const fromK = key(fromQ, fromR);
  const toK = key(toQ, toR);
  const fromStack = state.cells[fromK];
  const toStack = state.cells[toK];
  if (fromStack == null || toStack == null) {
    return fail(state, 'out of board');
  }
  if (fromStack.length === 0) {
    return fail(state, 'empty source');
  }
  if (fromStack[fromStack.length - 1] !== player) {
    return fail(state, 'top is not yours');
  }

  const adj = neighbors(fromQ, fromR);
  if (!adj.some((n) => n.q === toQ && n.r === toR)) {
    return fail(state, 'not adjacent');
  }

  const destH = toStack.length;
  // 只移动堆顶 1 枚：二层叠二层 → 三层（合法）；已满三层不可再叠
  if (destH + 1 > 3) {
    return fail(state, 'stack would exceed 3');
  }

  const next = clone(state);
  const piece = next.cells[fromK].pop();
  next.cells[toK].push(piece);
  next.current = otherPlayer(player);
  return applyWinCheckAfterMove(next, player);
}
