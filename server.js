import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { createGame, startMatch, applyPlace, applyMove } from './shared/rules.js';
import { newInviteToken, swapSeatMap } from './server/room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_DIR = path.join(__dirname, 'shared');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function lanAddresses() {
  const addrs = [];
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal) {
        addrs.push(info.address);
      }
    }
  }
  return addrs;
}

function primaryLanHint() {
  const addrs = lanAddresses();
  return addrs.length > 0 ? `http://${addrs[0]}:${PORT}` : `http://localhost:${PORT}`;
}

function safeResolve(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    res.writeHead(200, headers);
    res.end(data);
  });
}

function handleHttp(req, res) {
  const url = req.url || '/';
  if (url === '/' || url.startsWith('/?')) {
    sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
    return;
  }

  if (url.startsWith('/shared/')) {
    const filePath = safeResolve(SHARED_DIR, url.slice('/shared'.length));
    if (!filePath || !filePath.endsWith('.js')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    sendFile(res, filePath);
    return;
  }

  const filePath = safeResolve(PUBLIC_DIR, url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  sendFile(res, filePath);
}

const room = {
  sockets: new Map(),
  state: createGame(),
  inviteToken: null,
  publicBase: null,
};

function buildInviteUrl() {
  if (!room.inviteToken) return null;
  const base = (room.publicBase || primaryLanHint()).replace(/\/$/, '');
  return `${base}/?invite=${room.inviteToken}`;
}

function assignedPayload(seat) {
  return {
    type: 'assigned',
    seat,
    lanHint: primaryLanHint(),
    inviteToken: room.inviteToken,
    inviteUrl: buildInviteUrl(),
    publicBase: room.publicBase,
  };
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function seatOf(ws) {
  for (const [seat, sock] of room.sockets) {
    if (sock === ws) return seat;
  }
  return null;
}

function publicState(state) {
  return JSON.parse(JSON.stringify(state));
}

function broadcastState() {
  const state = publicState(room.state);
  const seatsOccupied = {
    A: room.sockets.has('A'),
    B: room.sockets.has('B'),
  };
  const inviteUrl = buildInviteUrl();
  for (const [seat, ws] of room.sockets) {
    send(ws, {
      type: 'state',
      state,
      you: seat,
      seatsOccupied,
      inviteUrl,
      publicBase: room.publicBase,
    });
  }
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(ws, { type: 'error', message: '无效消息' });
    return;
  }

  const type = msg?.type;
  const existingSeat = seatOf(ws);

  if (type === 'create') {
    if (room.sockets.has('A')) {
      send(ws, { type: 'error', message: '房间已有主机' });
      return;
    }
    if (existingSeat) {
      send(ws, { type: 'error', message: '已在房间中' });
      return;
    }
    room.sockets.set('A', ws);
    room.inviteToken = newInviteToken();
    if (!room.sockets.has('B')) {
      room.state = createGame();
    }
    send(ws, assignedPayload('A'));
    broadcastState();
    return;
  }

  if (type === 'join') {
    if (!room.sockets.has('A')) {
      send(ws, { type: 'error', message: '房间尚未创建' });
      return;
    }
    if (room.sockets.has('B')) {
      send(ws, { type: 'error', message: '房间已满' });
      return;
    }
    if (existingSeat) {
      send(ws, { type: 'error', message: '已在房间中' });
      return;
    }
    if (msg.inviteToken != null && msg.inviteToken !== room.inviteToken) {
      send(ws, { type: 'error', message: '邀请链接无效' });
      return;
    }
    room.sockets.set('B', ws);
    room.state.phase = 'ready';
    send(ws, assignedPayload('B'));
    broadcastState();
    return;
  }

  if (
    type === 'place' ||
    type === 'move' ||
    type === 'restart' ||
    type === 'swapSeats' ||
    type === 'start'
  ) {
    if (!existingSeat) {
      send(ws, { type: 'error', message: '未入座' });
      return;
    }
  }

  if (type === 'swapSeats') {
    if (room.state.phase !== 'ready') {
      send(ws, { type: 'error', message: '当前不能交换座位' });
      return;
    }
    if (!room.sockets.has('A') || !room.sockets.has('B')) {
      send(ws, { type: 'error', message: '需要双方在座' });
      return;
    }
    room.sockets = swapSeatMap(room.sockets);
    broadcastState();
    for (const [seat, sock] of room.sockets) {
      send(sock, assignedPayload(seat));
    }
    return;
  }

  if (type === 'start') {
    if (room.state.phase !== 'ready') {
      send(ws, { type: 'error', message: '当前不能开始' });
      return;
    }
    if (!room.sockets.has('A') || !room.sockets.has('B')) {
      send(ws, { type: 'error', message: '需要双方在座' });
      return;
    }
    room.state = startMatch(room.state);
    broadcastState();
    return;
  }

  if (type === 'restart') {
    if (!room.sockets.has('A') || !room.sockets.has('B')) {
      room.state = createGame();
      broadcastState();
      return;
    }
    room.state = createGame();
    room.state.phase = 'ready';
    broadcastState();
    return;
  }

  if (type === 'place' || type === 'move') {
    const phase = room.state.phase;
    if (phase === 'waiting' || phase === 'ready' || phase === 'ended') {
      send(ws, { type: 'error', message: '当前阶段不可操作' });
      return;
    }
    if (existingSeat !== room.state.current) {
      send(ws, { type: 'error', message: '未轮到你' });
      return;
    }

    let result;
    if (type === 'place') {
      result = applyPlace(room.state, existingSeat, msg.q, msg.r);
    } else {
      result = applyMove(
        room.state,
        existingSeat,
        msg.fromQ,
        msg.fromR,
        msg.toQ,
        msg.toR,
      );
    }

    if (!result.ok) {
      send(ws, { type: 'error', message: result.error });
      return;
    }
    room.state = result.state;
    broadcastState();
    return;
  }

  send(ws, { type: 'error', message: '未知消息类型' });
}

function onClose(ws) {
  const seat = seatOf(ws);
  if (!seat) return;
  room.sockets.delete(seat);
  if (!room.sockets.has('A') && !room.sockets.has('B')) {
    room.state = createGame();
    room.inviteToken = null;
  } else {
    room.state.phase = 'waiting';
    broadcastState();
  }
}

const server = http.createServer(handleHttp);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => handleMessage(ws, data.toString()));
  ws.on('close', () => onClose(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`三层五子棋 listening on port ${PORT}`);
  console.log('  Rules:   stack move band startH-1..startH (top piece only)');
  console.log(`  Local:   http://localhost:${PORT}`);
  const addrs = lanAddresses();
  if (addrs.length === 0) {
    console.log('  LAN:     (no IPv4 address found)');
  } else {
    for (const ip of addrs) {
      console.log(`  LAN:     http://${ip}:${PORT}`);
    }
  }
});
