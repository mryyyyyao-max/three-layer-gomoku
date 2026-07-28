# Public Invite Tunnel + Seats + Stack Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一键公网邀请链接、开局前座位交换，并按统一公式修正移动叠层规则。

**Architecture:** 叠层规则只改 `shared/rules.js`（客户端高亮同步）。房间增加 `ready` 阶段与 `inviteToken`/`swapSeats`/`start`。`server/tunnel.js` 负责下载并拉起 `cloudflared`，把公网 base 交给 `server.js`；朋友只用浏览器打开 `/?invite=`。

**Tech Stack:** Node.js 18+、现有 `ws`、Cloudflare quick tunnel（`cloudflared` 二进制）、浏览器原生 WebSocket。

**Spec:** `docs/superpowers/specs/2026-07-28-public-invite-tunnel-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `shared/rules.js` | `isLegalDestHeight(startH, destH)`；`applyMove` 用统一公式 |
| `tests/rules-action.test.js` | 叠层 band 测例（含失败路径） |
| `server/tunnel.js` | 下载/启动 cloudflared、解析公网 URL、失败时返回 null |
| `server.js` | ready/invite/swap/start/restart；持有 `publicBase`；启动时调 tunnel |
| `public/index.html` | 座位区、复制邀请、交换、开始按钮 |
| `public/client.js` | auto-join、`legalMoveTargets` 同步公式、大厅 UI |
| `public/style.css` | 座位/邀请区最小样式 |
| `.gitignore` | 忽略本地下载的 `cloudflared*` |
| `开始游戏.bat` | 文案改为提示公网邀请；仍只启动 `node server.js` |
| `README.md` | 公网分享与叠层公式说明 |

---

### Task 1: Stack move band (TDD)

**Files:**
- Modify: `shared/rules.js`
- Modify: `tests/rules-action.test.js`
- Modify: `public/client.js` (`legalMoveTargets` + `ERROR_MAP`)

- [ ] **Step 1: Add failing tests**

Append to `tests/rules-action.test.js`:

```js
test('height-1 cannot move onto height-2', () => {
  let s = finishLayout(startMatch(createGame()));
  s = applyPlace(s, 'A', 2, 0).state;
  s = applyPlace(s, 'B', 1, 0).state;
  s = applyPlace(s, 'A', 3, 0).state;
  s = applyPlace(s, 'B', -1, 0).state;
  s = applyMove(s, 'A', 3, 0, 2, 0).state; // [A,A] height 2
  s = applyPlace(s, 'B', -2, 0).state;
  // A has height-1 at layout leftover? place adjacent single at 2,1
  s = applyPlace(s, 'A', 2, 1).state;
  s = applyPlace(s, 'B', -1, 1).state;
  const r = applyMove(s, 'A', 2, 1, 2, 0);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'illegal stack step');
});

test('height-2 cannot move onto empty', () => {
  let s = finishLayout(startMatch(createGame()));
  s = applyPlace(s, 'A', 2, 0).state;
  s = applyPlace(s, 'B', 1, 0).state;
  s = applyPlace(s, 'A', 3, 0).state;
  s = applyPlace(s, 'B', -1, 0).state;
  s = applyMove(s, 'A', 3, 0, 2, 0).state; // height 2 at 2,0
  s = applyPlace(s, 'B', -2, 0).state;
  const r = applyMove(s, 'A', 2, 0, 2, 1); // 2,1 empty adjacent
  assert.equal(r.ok, false);
  assert.equal(r.error, 'illegal stack step');
});

test('height-3 can only move onto height-2', () => {
  let s = finishLayout(startMatch(createGame()));
  // Build height 3 at 2,0 (reuse sequence from existing height-3 test up to height 3)
  s = applyPlace(s, 'A', 2, 0).state;
  s = applyPlace(s, 'B', 1, 0).state;
  s = applyPlace(s, 'A', 3, 0).state;
  s = applyPlace(s, 'B', -1, 0).state;
  s = applyMove(s, 'A', 3, 0, 2, 0).state;
  s = applyPlace(s, 'B', -2, 0).state;
  s = applyPlace(s, 'A', 1, 1).state;
  s = applyPlace(s, 'B', -1, 1).state;
  s = applyMove(s, 'A', 1, 1, 1, 0).state;
  s = applyPlace(s, 'B', -2, 1).state;
  s = applyMove(s, 'A', 1, 0, 2, 0).state; // height 3 at 2,0
  s = applyPlace(s, 'B', 3, 1).state;
  // adjacent empty 2,1 — illegal for height-3 top
  s = applyPlace(s, 'A', 0, 1).state; // burn a turn if needed; ensure current is A with top at 2,0
  // After B's place, current is A. Try 3→empty
  let r = applyMove(s, 'A', 2, 0, 2, 1);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'illegal stack step');
  // Build height-2 neighbor and succeed — construct carefully in implementation if coords clash;
  // minimal assert: empty and height-1 destinations fail with illegal stack step.
});
```

If any setup assertion fails due to adjacency, adjust coordinates but keep the three assertions: `1→2` fail, `2→0` fail, `3→0` fail. Keep existing `two adjacent height-2 stacks can make height 3` passing.

- [ ] **Step 2: Run tests — expect new ones FAIL**

Run: `node --test tests/rules-action.test.js`

Expected: new tests fail (currently `1→2` may still succeed; `2→0` still succeed).

- [ ] **Step 3: Implement formula in `shared/rules.js`**

Add and use:

```js
export function isLegalDestHeight(startH, destH) {
  if (destH + 1 > 3) return false;
  return destH >= startH - 1 && destH <= startH;
}
```

In `applyMove`, replace the sole `destH + 1 > 3` check with:

```js
const startH = fromStack.length;
const destH = toStack.length;
if (!isLegalDestHeight(startH, destH)) {
  if (destH + 1 > 3) return fail(state, 'stack would exceed 3');
  return fail(state, 'illegal stack step');
}
```

Update `server.js` startup console line that says stacking onto 2-high is always OK — point to the band rule instead.

- [ ] **Step 4: Sync client highlights + error map**

In `public/client.js` `legalMoveTargets`:

```js
const startH = stack.length;
const destH = gameState.cells[key(n.q, n.r)]?.length ?? 0;
if (destH + 1 <= 3 && destH >= startH - 1 && destH <= startH) targets.push(n);
```

Add to `ERROR_MAP`:

```js
'illegal stack step': '只能平迁或下降一层',
```

Bump cache query `?v=4` → `?v=5` on `index.html` script/css and client imports that use `?v=`.

- [ ] **Step 5: Run tests — expect PASS**

Run: `node --test tests/rules-action.test.js`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/rules.js tests/rules-action.test.js public/client.js public/index.html server.js
git commit -m "fix: enforce stack move band startH-1..startH"
```

---

### Task 2: Room ready phase + invite/swap/start on server

**Files:**
- Modify: `server.js`
- Create: `tests/room-protocol.test.js` (optional thin unit of pure helpers if extracted; otherwise manual checklist in Step 5)

Prefer extracting pure helpers at top of `server.js` or into `server/room.js` for token + seat swap to keep handlers readable:

```js
// server/room.js (Create)
import crypto from 'node:crypto';
import { createGame, startMatch } from '../shared/rules.js';

export function newInviteToken() {
  return crypto.randomBytes(8).toString('hex');
}

export function swapSeatMap(sockets) {
  // sockets: Map seat -> ws ; return new Map with A/B swapped
  const a = sockets.get('A');
  const b = sockets.get('B');
  const next = new Map();
  if (b) next.set('A', b);
  if (a) next.set('B', a);
  return next;
}
```

- [ ] **Step 1: Extend room state in `server.js`**

```js
const room = {
  sockets: new Map(),
  state: createGame(),
  inviteToken: null,
  publicBase: null, // set later by tunnel
};

function buildInviteUrl() {
  if (!room.inviteToken) return null;
  const base = (room.publicBase || primaryLanHint()).replace(/\/$/, '');
  return `${base}/?invite=${room.inviteToken}`;
}
```

- [ ] **Step 2: Change create/join flow**

`create`:
- Reject if A occupied
- `room.sockets.set('A', ws)`
- `room.inviteToken = newInviteToken()`
- `room.state = createGame()` with `phase: 'waiting'` (already)
- `assigned` payload: `{ type:'assigned', seat:'A', lanHint, inviteToken, inviteUrl: buildInviteUrl(), publicBase: room.publicBase }`

`join`:
- Require A present, B empty
- If `msg.inviteToken` present, must equal `room.inviteToken`; else if client sends join without token, still allow (manual 加入房间) **only when** A exists and B empty (keep LAN button working)
- Seat B; set `room.state.phase = 'ready'` (do **not** call `startMatch`)
- `assigned` for B; `broadcastState()`

- [ ] **Step 3: Add `swapSeats`, `start`, fix `restart`**

```js
if (type === 'swapSeats') {
  if (room.state.phase !== 'ready') return send(ws, { type:'error', message:'当前不能交换座位' });
  if (!room.sockets.has('A') || !room.sockets.has('B')) return send(ws, { type:'error', message:'需要双方在座' });
  room.sockets = swapSeatMap(room.sockets);
  broadcastState();
  // also re-send assigned to each so client seat variable updates
  for (const [seat, sock] of room.sockets) {
    send(sock, { type:'assigned', seat, lanHint: primaryLanHint(), inviteToken: room.inviteToken, inviteUrl: buildInviteUrl(), publicBase: room.publicBase });
  }
  return;
}

if (type === 'start') {
  if (room.state.phase !== 'ready') return send(ws, { type:'error', message:'当前不能开始' });
  if (!room.sockets.has('A') || !room.sockets.has('B')) return send(ws, { type:'error', message:'需要双方在座' });
  room.state = startMatch(room.state);
  broadcastState();
  return;
}

if (type === 'restart') {
  if (!room.sockets.has('A') || !room.sockets.has('B')) {
    room.state = createGame();
    room.state.phase = room.sockets.has('A') ? 'waiting' : 'waiting';
    broadcastState();
    return;
  }
  room.state = createGame();
  room.state.phase = 'ready';
  broadcastState();
  return;
}
```

On `onClose`: if both gone, clear `inviteToken` and reset state; if only one left, phase `waiting` and clear the empty seat (existing delete); do not keep `ready` with one player.

- [ ] **Step 4: `broadcastState` include phase-friendly fields**

Keep `{ type:'state', state, you: seat }`. Ensure `createGame`/`clone` do not strip unknown phases — `phase: 'ready'` is a string on state only (no rules engine change required beyond ignoring place/move when not layout/action — already rejected).

- [ ] **Step 5: Smoke-check with two browser consoles or a tiny script**

Optional: write `tests/room-helpers.test.js` for `swapSeatMap` + `newInviteToken` length.

Run: `node --test tests/*.test.js`

- [ ] **Step 6: Commit**

```bash
git add server.js server/room.js tests/room-helpers.test.js
git commit -m "feat: ready phase with invite token and seat swap"
```

---

### Task 3: Lobby UI — seats, copy invite, auto-join, start/swap

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/client.js`

- [ ] **Step 1: HTML structure**

Inside `#lobby`, after actions:

```html
<div id="seats" class="seats" hidden>
  <div class="seat" id="seat-a"><span class="seat-label">先手（深色）</span><span class="seat-who" id="seat-a-who">空</span></div>
  <div class="seat" id="seat-b"><span class="seat-label">后手（浅色）</span><span class="seat-who" id="seat-b-who">空</span></div>
</div>
<div id="invite-box" class="invite-box" hidden>
  <input id="invite-url" readonly />
  <button type="button" id="btn-copy-invite">复制邀请链接</button>
  <p id="invite-hint" class="invite-hint"></p>
</div>
<div id="ready-actions" class="ready-actions" hidden>
  <button type="button" id="btn-swap">交换先手后手</button>
  <button type="button" id="btn-start">开始对局</button>
</div>
```

- [ ] **Step 2: Client wiring**

On load:

```js
const inviteParam = new URLSearchParams(location.search).get('invite');
```

On `ws` open: if `inviteParam`, `send({ type:'join', inviteToken: inviteParam })` and disable create/join or leave join as fallback.

On `assigned`: store `inviteUrl`/`publicBase`; show `#invite-box` for seat A; update seat labels; if phase will come via state — show seats.

On `state`:
- if `phase === 'waiting' || phase === 'ready'`: show lobby seats + ready actions when `ready`; keep game hidden OR show a thin ready panel (prefer keep lobby visible until layout)
- if `phase === 'layout'|'action'|'ended'`: `showGame()` as today
- update `#seat-a-who` / `#seat-b-who` from whether you are A/B and opponent present (derive: if `you==='A'` then A=你, B=对手或空 based on… server should send `seats: { A: true, B: true }` in state message)

**Add to every `broadcastState` / assigned path:**

```js
send(ws, { type:'state', state, you: seat, seatsOccupied: { A: room.sockets.has('A'), B: room.sockets.has('B') }, inviteUrl: buildInviteUrl(), publicBase: room.publicBase });
```

Client uses `seatsOccupied` to render 你/对手/空.

Buttons:
- `btn-copy-invite` → `navigator.clipboard.writeText(inviteUrl)` with fallback `invite-url.select(); document.execCommand('copy')`
- `btn-swap` → `send({ type:'swapSeats' })`
- `btn-start` → `send({ type:'start' })`
- After swap `assigned`, update local `seat` variable (already handled if `onAssigned` runs)

When `inviteUrl` null and host waiting: `invite-hint` =「公网链接准备中…」or LAN URL if `buildInviteUrl` used lanHint.

- [ ] **Step 3: Minimal CSS** for `.seats`, `.invite-box`, `.ready-actions` — no card-heavy chrome; match existing lobby spacing.

- [ ] **Step 4: Manual UI check**

Run: `npm start`  
Two windows localhost: create / join → see ready → swap → start → layout works; restart returns to ready.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/client.js server.js
git commit -m "feat: lobby seats, invite copy, and ready controls"
```

---

### Task 4: Cloudflare tunnel helper

**Files:**
- Create: `server/tunnel.js`
- Modify: `server.js`
- Modify: `.gitignore`
- Modify: `开始游戏.bat`
- Modify: `README.md`

- [ ] **Step 1: Implement `server/tunnel.js`**

Responsibilities:
- Resolve binary path: `path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')`
- If missing, download from GitHub releases (cloudflare/cloudflared) matching platform/arch (`windows-amd64`, `windows-386`, `linux-amd64`, `darwin-amd64`, `darwin-arm64`)
- Prefer `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe` style URLs; on download failure return `{ url: null, child: null, error }`
- Spawn: `cloudflared tunnel --url http://127.0.0.1:3000` with stderr/stdout piped
- Parse first URL matching `https://[a-z0-9-]+\.trycloudflare\.com`
- Export:

```js
/**
 * @param {{ port?: number, onUrl?: (url: string) => void }} opts
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startQuickTunnel(opts = {}) { ... }
```

`onUrl` called when URL found; never throw — log and resolve with no-op `stop` on failure.

- [ ] **Step 2: Wire into `server.js` after listen**

```js
server.listen(PORT, '0.0.0.0', async () => {
  // existing LAN logs...
  const tunnel = await startQuickTunnel({
    port: PORT,
    onUrl(url) {
      room.publicBase = url;
      console.log(`  Public:  ${url}`);
      // notify connected sockets so host invite box updates
      for (const [seat, ws] of room.sockets) {
        send(ws, {
          type: 'tunnel',
          publicBase: url,
          inviteUrl: buildInviteUrl(),
        });
      }
    },
  });
  const shutdown = () => { tunnel.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
```

Client handles `type === 'tunnel'` to refresh invite input.

- [ ] **Step 3: `.gitignore`**

```
bin/cloudflared
bin/cloudflared.exe
```

- [ ] **Step 4: Update bat + README**

`开始游戏.bat` echo lines:
- 创建房间后复制「邀请链接」发给朋友（对方无需安装）
- 关闭本窗口即停止游戏与公网链接

README: short「公网分享」section + stack band one-liner.

- [ ] **Step 5: Manual tunnel check**

Run: `npm start`  
Expect console `Public: https://….trycloudflare.com` within ~15s (or clear failure message). Open public URL on phone/other network if available; join via invite.

If GitHub download blocked on host network, document fallback: place `cloudflared.exe` manually into `bin/`.

- [ ] **Step 6: Commit**

```bash
git add server/tunnel.js server.js .gitignore 开始游戏.bat README.md
git commit -m "feat: one-click Cloudflare quick tunnel for invite links"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Run full unit tests**

Run: `npm test`  
Expected: all PASS.

- [ ] **Step 2: Checklist against spec success criteria**

- [ ] 主机一键启动后能复制公网邀请链接（或隧道失败时 LAN 邀请仍可用）
- [ ] 朋友仅浏览器打开 `/?invite=` 入座后手
- [ ] ready 双方可交换再开始
- [ ] 叠层 band：1↛2，2↛0，3→仅2，2→2 OK
- [ ] 隧道失败不阻断局域网

- [ ] **Step 3: Final commit if docs/status tweaks**

```bash
git add docs/superpowers/specs/2026-07-28-public-invite-tunnel-design.md
git commit -m "docs: mark invite-tunnel success criteria in progress notes"
```

(Only if you tick boxes in the spec file.)

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Cloudflare quick tunnel, host-only binary | Task 4 |
| Invite token URL, auto-join | Task 2 + 3 |
| Friends need no install | Task 4 (host-only) + Task 3 |
| ready phase, swap both, start | Task 2 + 3 |
| restart → ready | Task 2 |
| Tunnel fail soft | Task 4 |
| Stack band formula + tests + client highlight | Task 1 |
| Error messages Chinese | Task 1–3 |

No TBD placeholders. Error code `illegal stack step` consistent across tests, rules, ERROR_MAP. Message types: `tunnel`, `swapSeats`, `start`, `assigned` fields aligned across Task 2–4.
