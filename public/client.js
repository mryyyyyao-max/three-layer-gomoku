import { drawBoard } from './render.js?v=10';
import { allCells, axialToPixel, key, neighbors, isCenter } from '/shared/board.js?v=10';
import { isLegalDestHeight } from '/shared/rules.js?v=10';

const lobbyEl = document.getElementById('lobby');
const gameEl = document.getElementById('game');
const lobbyStatus = document.getElementById('lobby-status');
const seatsEl = document.getElementById('seats');
const seatAWho = document.getElementById('seat-a-who');
const seatBWho = document.getElementById('seat-b-who');
const inviteBox = document.getElementById('invite-box');
const inviteUrlInput = document.getElementById('invite-url');
const inviteHint = document.getElementById('invite-hint');
const readyActions = document.getElementById('ready-actions');
const lanHintEl = document.getElementById('lan-hint');
const phaseLabel = document.getElementById('phase-label');
const youLabel = document.getElementById('you-label');
const currentLabel = document.getElementById('current-label');
const hintLabel = document.getElementById('hint-label');
const handA = document.getElementById('hand-a');
const handB = document.getElementById('hand-b');
const messageEl = document.getElementById('message');
const yourTurnBanner = document.getElementById('your-turn-banner');
const boardWrap = document.getElementById('board-wrap');
const btnUndo = document.getElementById('btn-undo');
const undoPleaEl = document.getElementById('undo-plea');
const undoPleaFromEl = document.getElementById('undo-plea-from');
const btnUndoAccept = document.getElementById('btn-undo-accept');
const btnUndoDismiss = document.getElementById('btn-undo-dismiss');
const replayBar = document.getElementById('replay-bar');
const replaySlider = document.getElementById('replay-slider');
const replayStep = document.getElementById('replay-step');
const tauntLayer = document.getElementById('taunt-layer');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnCopyInvite = document.getElementById('btn-copy-invite');
const btnSwap = document.getElementById('btn-swap');
const btnStart = document.getElementById('btn-start');
const endOverlay = document.getElementById('end-overlay');
const endTitle = document.getElementById('end-title');
const endReason = document.getElementById('end-reason');
const btnRestart = document.getElementById('btn-restart');
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const inviteParam = new URLSearchParams(location.search).get('invite');
const PLAYER_LABEL = { A: '先手', B: '后手' };

const PHASE_TEXT = {
  waiting: '等待对手',
  ready: '准备开局',
  layout: '布局阶段',
  action: '行动阶段',
  ended: '对局结束',
};

const PLAYER_TEXT = {
  A: '玩家 A（深色）',
  B: '玩家 B（浅色）',
};

const WIN_REASON_TEXT = {
  five: '俯视五连',
  fiveOnThird: '第三层五枚',
  threeAdjacentThird: '第三层三相邻',
};

const ERROR_MAP = {
  'not in layout phase': '当前不是布局阶段',
  'not your turn': '未轮到你',
  'out of board': '超出棋盘',
  'center forbidden in layout': '布局阶段不可落中心',
  'cell occupied': '该位置已有棋子',
  'adjacent to own stone': '不可与己方棋子相邻',
  'no pieces in hand': '手中无棋',
  'not in action phase': '当前不是行动阶段',
  'cannot place in this phase': '当前阶段不可放置',
  'empty source': '起点无棋子',
  'top is not yours': '堆顶不是你的棋子',
  'not adjacent': '目标不相邻',
  'stack would exceed 3': '堆叠不能超过三层',
  'illegal stack step': '只能平迁或下降一层',
  'illegal stack height': '堆叠不能超过三层',
  'cannot stack onto height 2+': '堆叠不能超过三层',
  'dest higher than start level': '堆叠不能超过三层',
};

const BOARD_SIZE = 44;

let seat = null;
let isHost = false;
let creatingRoom = false;
let inviteJoinPending = false;
let gameState = null;
let inviteUrl = '';
let lanHint = '';
let canUndo = false;
let undoPleaFrom = null;
/** @type {any[]|null} */
let replayFrames = null;
let replayIndex = 0;
/** @type {{q:number,r:number}|null} */
let selected = null;
/** @type {Array<{q:number,r:number,color?:string}>} */
const highlights = [];
/** @type {{q:number,r:number}|null} */
let hoverCell = null;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

function localizeError(msg) {
  if (!msg) return '';
  if (ERROR_MAP[msg]) return ERROR_MAP[msg];
  if (/[\u4e00-\u9fff]/.test(msg)) return msg;
  return `操作无效：${msg}`;
}

function setMessage(text) {
  messageEl.textContent = text || '';
}

function showError(msg) {
  const text = localizeError(msg || '操作失败');
  setMessage(text);
  if (!lobbyEl.hidden) {
    lobbyStatus.textContent = text;
  }
}

function hasOwnAdjacent(q, r) {
  if (!gameState || !seat) return false;
  for (const n of neighbors(q, r)) {
    const stack = gameState.cells[key(n.q, n.r)];
    if (stack?.some((p) => p === seat)) return true;
  }
  return false;
}

function canPlaceAt(q, r) {
  if (!gameState || !seat) return false;
  if (gameState.current !== seat) return false;
  if ((gameState.hand?.[seat] ?? 0) <= 0) return false;
  const stack = gameState.cells[key(q, r)];
  if (!stack || stack.length !== 0) return false;
  if (gameState.phase === 'layout') {
    if (isCenter(q, r)) return false;
    if (hasOwnAdjacent(q, r)) return false;
    return true;
  }
  if (gameState.phase === 'action') return true;
  return false;
}

function legalMoveTargets(fromQ, fromR) {
  const stack = gameState?.cells?.[key(fromQ, fromR)];
  if (!stack || stack.length === 0) return [];
  const startH = stack.length;
  const targets = [];
  for (const n of neighbors(fromQ, fromR)) {
    const destH = gameState.cells[key(n.q, n.r)]?.length ?? 0;
    if (isLegalDestHeight(startH, destH)) targets.push(n);
  }
  return targets;
}

function ghostPreview() {
  if (!hoverCell || !seat || !gameState) return null;
  if (selected) return null;
  if (gameState.current !== seat) return null;
  if (!canPlaceAt(hoverCell.q, hoverCell.r)) return null;
  return { q: hoverCell.q, r: hoverCell.r, player: seat };
}

function boardOpts() {
  return {
    size: BOARD_SIZE,
    origin: { x: canvas.width / 2, y: canvas.height / 2 },
    highlights,
    selected,
    ghost: ghostPreview(),
    liftSelected: true,
  };
}

function displayState() {
  if (
    gameState?.phase === 'ended' &&
    Array.isArray(replayFrames) &&
    replayFrames.length > 0
  ) {
    const i = Math.max(0, Math.min(replayIndex, replayFrames.length - 1));
    return replayFrames[i];
  }
  return gameState;
}

function redraw() {
  drawBoard(ctx, displayState(), boardOpts());
}

function spawnTauntBubble(text, fromSeat) {
  if (!tauntLayer) return;
  const bubble = document.createElement('div');
  bubble.className = 'taunt-bubble';
  if (fromSeat && seat && fromSeat !== seat) bubble.classList.add('from-them');
  bubble.textContent = text;
  const leftish = Math.random() < 0.5;
  const x = leftish
    ? 8 + Math.random() * 28
    : 62 + Math.random() * 30;
  const y = 55 + Math.random() * 30;
  bubble.style.left = `${x}vw`;
  bubble.style.top = `${y}vh`;
  tauntLayer.appendChild(bubble);
  bubble.addEventListener('animationend', () => bubble.remove());
}

function hideUndoPlea() {
  if (undoPleaEl) undoPleaEl.hidden = true;
}

function showUndoPlea(from) {
  if (!undoPleaEl) return;
  undoPleaEl.hidden = false;
  const label = PLAYER_LABEL[from] || from;
  undoPleaFromEl.textContent =
    from === seat ? '你正在求饶…等对方同意' : `${label} 正在求饶`;
  const isTarget = Boolean(seat) && from && from !== seat;
  btnUndoAccept.hidden = !isTarget;
}

function updateReplayUI() {
  const ended = gameState?.phase === 'ended';
  const frames = Array.isArray(replayFrames) ? replayFrames : [];
  if (!ended || frames.length === 0) {
    replayBar.hidden = true;
    return;
  }
  replayBar.hidden = false;
  // hide end overlay while scrubbing away from last frame so board is visible
  const atEnd = replayIndex >= frames.length - 1;
  if (endOverlay) {
    endOverlay.hidden = !(atEnd && gameState.winner);
  }
  replaySlider.max = String(Math.max(0, frames.length - 1));
  replaySlider.value = String(replayIndex);
  replayStep.textContent = `${replayIndex + 1}/${frames.length}`;
}

function clearSelection() {
  selected = null;
  highlights.length = 0;
}

function updateEndUI() {
  if (gameState?.phase === 'ended' && gameState.winner) {
    endOverlay.hidden = false;
    endTitle.textContent = `${PLAYER_TEXT[gameState.winner] || gameState.winner} 获胜`;
    endReason.textContent =
      WIN_REASON_TEXT[gameState.winReason] || gameState.winReason || '';
  } else {
    endOverlay.hidden = true;
  }
}

function updateHint() {
  if (!hintLabel) return;
  if (!gameState || gameState.current !== seat) {
    hintLabel.textContent = '';
    return;
  }
  if (selected) {
    hintLabel.textContent = '棋子已抬起 · 点高亮格落下 · 再点自己取消';
  } else if (gameState.phase === 'layout') {
    hintLabel.textContent = '鼠标移到交点看虚影 · 点击空位落子';
  } else if (gameState.phase === 'action') {
    hintLabel.textContent = '点空位落子 · 点己方棋子抬起移动';
  } else {
    hintLabel.textContent = '';
  }
}

function updateStatus() {
  if (!gameState) return;

  const phase = gameState.phase;
  phaseLabel.textContent = PHASE_TEXT[phase] || phase;

  youLabel.textContent = seat ? `你：${PLAYER_TEXT[seat] || seat}` : '';

  if (phase === 'waiting') {
    currentLabel.textContent = '等待对手加入…';
  } else if (phase === 'ended') {
    currentLabel.textContent = '对局已结束';
  } else if (gameState.current) {
    currentLabel.textContent =
      seat && gameState.current === seat
        ? '轮到你'
        : `当前：${PLAYER_TEXT[gameState.current] || gameState.current}`;
  } else {
    currentLabel.textContent = '—';
  }

  const yourTurn =
    Boolean(seat) &&
    (phase === 'layout' || phase === 'action') &&
    gameState.current === seat;
  if (yourTurnBanner) {
    yourTurnBanner.hidden = !yourTurn;
  }
  if (boardWrap) {
    boardWrap.classList.toggle('is-your-turn', yourTurn);
  }

  if (btnUndo) {
    btnUndo.hidden = !(
      (phase === 'layout' || phase === 'action') &&
      canUndo
    );
  }

  if (undoPleaFrom) {
    showUndoPlea(undoPleaFrom);
  } else {
    hideUndoPlea();
  }

  handA.textContent = `A 手棋：${gameState.hand?.A ?? '—'}`;
  handB.textContent = `B 手棋：${gameState.hand?.B ?? '—'}`;
  updateEndUI();
  updateReplayUI();
  updateHint();
}

function showGame() {
  lobbyEl.hidden = true;
  gameEl.hidden = false;
}

function showLobby() {
  lobbyEl.hidden = false;
  gameEl.hidden = true;
}

function updateInviteUI(url) {
  if (url !== undefined && url !== inviteUrl) {
    inviteUrl = url || '';
    inviteHint.textContent = '';
  }
  const canInvite = isHost && Boolean(inviteUrl);
  inviteBox.hidden = !canInvite;
  if (canInvite) inviteUrlInput.value = inviteUrl;

  lanHintEl.hidden = !lanHint || canInvite;
  lanHintEl.textContent = lanHint ? `局域网地址：${lanHint}` : '';
}

function updateSeats(seatsOccupied = {}) {
  seatsEl.hidden = false;
  const who = (seatName) => {
    if (!seatsOccupied[seatName]) return '空';
    return seatName === seat ? '你' : '对手';
  };
  seatAWho.textContent = who('A');
  seatBWho.textContent = who('B');
}

function updateLobbyPhase(phase) {
  const isLobbyPhase = phase === 'waiting' || phase === 'ready';
  if (isLobbyPhase) {
    showLobby();
    readyActions.hidden = phase !== 'ready';
    if (phase === 'ready') {
      lobbyStatus.textContent = '双方到齐，可以交换座位或开始对局';
    }
    return;
  }
  readyActions.hidden = true;
  showGame();
}

function hitTest(clientX, clientY, maxDistFactor = 0.48) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  const { size, origin } = boardOpts();
  const maxDist = size * maxDistFactor;

  let best = null;
  let bestDist = Infinity;
  for (const cell of allCells()) {
    const p = axialToPixel(cell.q, cell.r, size);
    const dx = px - (origin.x + p.x);
    const dy = py - (origin.y + p.y);
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  if (best && bestDist <= maxDist) return best;
  return null;
}

function selectPiece(q, r) {
  selected = { q, r };
  highlights.length = 0;
  for (const t of legalMoveTargets(q, r)) {
    highlights.push({ q: t.q, r: t.r, color: 'rgba(46, 120, 72, 0.32)' });
  }
  setMessage(highlights.length ? '' : '没有可走位置');
  updateHint();
  redraw();
}

function onAssigned(msg) {
  seat = msg.seat;
  isHost ||= creatingRoom && seat === 'A';
  creatingRoom = false;
  inviteJoinPending = false;
  if (msg.lanHint) {
    lanHint = msg.lanHint;
  }
  updateInviteUI(msg.inviteUrl);
  lobbyStatus.textContent =
    seat === 'A' ? '已创建房间，等待对手…' : '已加入房间';
  btnCreate.disabled = true;
  btnJoin.disabled = true;
  if (gameState) updateLobbyPhase(gameState.phase);
}

function onState(msg) {
  gameState = msg.state;
  if (msg.you) seat = msg.you;
  canUndo = Boolean(msg.canUndo);
  undoPleaFrom = msg.undoPleaFrom || null;
  if (Array.isArray(msg.replay) && msg.replay.length > 0) {
    replayFrames = msg.replay;
    replayIndex = replayFrames.length - 1;
  } else if (gameState?.phase !== 'ended') {
    replayFrames = null;
    replayIndex = 0;
  }
  updateInviteUI(msg.inviteUrl);
  updateSeats(msg.seatsOccupied);
  updateLobbyPhase(gameState.phase);
  clearSelection();
  hoverCell = null;
  updateStatus();
  redraw();
}

const ws = new WebSocket(wsUrl());

ws.addEventListener('open', () => {
  lobbyStatus.textContent = '已连接。请创建或加入房间。';
  btnCreate.disabled = false;
  btnJoin.disabled = false;
  if (inviteParam) {
    lobbyStatus.textContent = '正在通过邀请链接加入房间…';
    btnCreate.disabled = true;
    btnJoin.disabled = true;
    inviteJoinPending = true;
    send({ type: 'join', inviteToken: inviteParam });
  }
});

ws.addEventListener('close', () => {
  lobbyStatus.textContent = '连接已断开';
  btnCreate.disabled = true;
  btnJoin.disabled = true;
});

ws.addEventListener('error', () => {
  lobbyStatus.textContent = '连接失败';
});

ws.addEventListener('message', (ev) => {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch {
    showError('收到无效消息');
    return;
  }
  if (msg.type === 'assigned') {
    onAssigned(msg);
    return;
  }
  if (msg.type === 'state') {
    setMessage('');
    onState(msg);
    return;
  }
  if (msg.type === 'tunnel') {
    updateInviteUI(msg.inviteUrl);
    return;
  }
  if (msg.type === 'taunt') {
    spawnTauntBubble(msg.text, msg.from);
    return;
  }
  if (msg.type === 'undoPlea') {
    undoPleaFrom = msg.from;
    showUndoPlea(msg.from);
    return;
  }
  if (msg.type === 'undoDone') {
    hideUndoPlea();
    undoPleaFrom = null;
    setMessage('对方心软了，悔了一步');
    return;
  }
  if (msg.type === 'error') {
    if (inviteJoinPending) {
      inviteJoinPending = false;
      btnCreate.disabled = false;
      btnJoin.disabled = false;
    }
    showError(msg.message || '操作失败');
  }
});

function send(obj) {
  if (ws.readyState !== WebSocket.OPEN) {
    showError('尚未连接');
    return;
  }
  ws.send(JSON.stringify(obj));
}

btnCreate.disabled = true;
btnJoin.disabled = true;

btnCreate.addEventListener('click', () => {
  setMessage('');
  creatingRoom = true;
  send({ type: 'create' });
});

btnJoin.addEventListener('click', () => {
  setMessage('');
  send({ type: 'join' });
});

btnCopyInvite.addEventListener('click', async () => {
  if (!inviteUrl) return;
  try {
    await navigator.clipboard.writeText(inviteUrl);
    inviteHint.textContent = '邀请链接已复制';
  } catch {
    inviteUrlInput.focus();
    inviteUrlInput.select();
    inviteHint.textContent = '请手动复制邀请链接';
  }
});

btnSwap.addEventListener('click', () => {
  send({ type: 'swapSeats' });
});

btnStart.addEventListener('click', () => {
  send({ type: 'start' });
});

btnRestart.addEventListener('click', () => {
  send({ type: 'restart' });
});

btnUndo?.addEventListener('click', () => {
  send({ type: 'undoRequest' });
});

btnUndoAccept?.addEventListener('click', () => {
  send({ type: 'undoAccept' });
});

btnUndoDismiss?.addEventListener('click', () => {
  undoPleaFrom = null;
  hideUndoPlea();
});

replaySlider?.addEventListener('input', () => {
  replayIndex = Number(replaySlider.value) || 0;
  updateReplayUI();
  redraw();
});

for (const btn of document.querySelectorAll('.taunt-btn')) {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-taunt');
    if (!text) return;
    send({ type: 'taunt', text });
  });
}

canvas.addEventListener('mousemove', (ev) => {
  if (!gameState || !seat) return;
  if (gameState.phase === 'waiting' || gameState.phase === 'ended') return;
  if (gameState.current !== seat) {
    if (hoverCell) {
      hoverCell = null;
      redraw();
    }
    return;
  }

  const cell = hitTest(ev.clientX, ev.clientY, 0.42);
  const nextKey = cell ? key(cell.q, cell.r) : null;
  const prevKey = hoverCell ? key(hoverCell.q, hoverCell.r) : null;
  if (nextKey === prevKey) return;
  hoverCell = cell;
  canvas.style.cursor = cell ? 'pointer' : 'default';
  redraw();
});

canvas.addEventListener('mouseleave', () => {
  if (!hoverCell) return;
  hoverCell = null;
  canvas.style.cursor = 'default';
  redraw();
});

canvas.addEventListener('click', (ev) => {
  if (!gameState || !seat) return;
  const phase = gameState.phase;
  if (phase === 'waiting' || phase === 'ended') return;

  if (gameState.current !== seat) {
    setMessage('未轮到你');
    return;
  }

  const cell = hitTest(ev.clientX, ev.clientY);
  if (!cell) return;

  const stack = gameState.cells[key(cell.q, cell.r)] || [];
  const isEmpty = stack.length === 0;
  const isOwnTop = stack.length > 0 && stack[stack.length - 1] === seat;

  if (selected) {
    if (selected.q === cell.q && selected.r === cell.r) {
      clearSelection();
      setMessage('');
      updateHint();
      redraw();
      return;
    }

    if (highlights.some((h) => h.q === cell.q && h.r === cell.r)) {
      send({
        type: 'move',
        fromQ: selected.q,
        fromR: selected.r,
        toQ: cell.q,
        toR: cell.r,
      });
      return;
    }

    if (phase === 'action' && isOwnTop) {
      selectPiece(cell.q, cell.r);
      return;
    }

    setMessage('请点绿色高亮格落下，或再点抬起的棋子取消');
    return;
  }

  if (phase === 'action' && isOwnTop) {
    selectPiece(cell.q, cell.r);
    return;
  }

  if (isEmpty) {
    send({ type: 'place', q: cell.q, r: cell.r });
    return;
  }

  setMessage(phase === 'layout' ? '布局请点空位' : '点空位落子，或点己方棋子移动');
});

drawBoard(ctx, null, boardOpts());
