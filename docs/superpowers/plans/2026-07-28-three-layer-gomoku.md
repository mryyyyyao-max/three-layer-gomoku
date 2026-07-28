# 三层五子棋局域网原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可在局域网浏览器中双人对战的「三层五子棋」最小可玩原型（布局→行动→三种胜负）。

**Architecture:** Node.js 提供静态页面与 WebSocket；`shared/` 中纯函数负责棋盘几何与规则；服务端持有唯一权威 `GameState` 并广播；浏览器 Canvas 渲染并发送操作意图。

**Tech Stack:** Node.js ≥18、内置 `http`、`ws`、原生 ES modules、`node:test`、Canvas 2D（浏览器）

## Global Constraints

- 遵循设计文档：`docs/superpowers/specs/2026-07-28-three-layer-gomoku-design.md`
- 单进程单房间；不做账号/AI/热座/断线重连
- 棋盘：平顶六边形，轴向坐标半径 `R=4`（每边 5 交点），中心 `(0,0)`
- 每人手棋 25；堆高 ≤3；布局顺序 A1→B2→A2→B1
- 移动：`destH ∈ {0,1}` 且 `destH <= startLevel`；只能移堆顶己方棋
- 五连：顶层同色整段长度**恰好**为 5；第三层五枚按 ≥5；第三层三连按连通 ≥3
- 若仓库尚无 git：Task 1 先 `git init` 再提交；此后每任务末提交一次
- UI 文案使用中文

---

## File Structure

```
package.json                 # type:module, scripts: start / test
server.js                    # HTTP 静态 + WebSocket 房间
shared/
  board.js                   # 交点集合、邻接、像素几何
  rules.js                   # 创建状态、布局/放置/移动、胜负
tests/
  board.test.js
  rules-layout.test.js
  rules-action.test.js
  rules-win.test.js
public/
  index.html
  style.css
  client.js                  # WS、大厅、输入状态机
  render.js                  # Canvas 棋盘与棋子
README.md                    # 如何在局域网启动
```

---

### Task 1: 脚手架 + 六边形棋盘几何

**Files:**
- Create: `package.json`
- Create: `shared/board.js`
- Create: `tests/board.test.js`
- Create: `README.md`（仅启动说明骨架，Task 5 再补全局域网步骤）

**Interfaces:**
- Produces:
  - `export const RADIUS = 4`
  - `export function key(q, r) => string`  // `"q,r"`
  - `export function parseKey(k) => {q,r}`
  - `export function allCells() => Array<{q,r}>`  // `|q|+|r|+|s|)/2 <= RADIUS` 且 `s=-q-r`
  - `export function isCenter(q,r) => boolean`  // q===0 && r===0
  - `export const NEIGHBOR_DELTAS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]`
  - `export function neighbors(q,r) => Array<{q,r}>`  // 仅返回在棋盘内的邻点
  - `export const LINE_DIRS = [[1,0],[0,1],[1,-1]]`  // 三方向（正向；反向用负）
  - `export function axialToPixel(q,r,size) => {x,y}`  // 平顶：`x=size*(3/2*q)`, `y=size*(sqrt3/2*q + sqrt3*r)`

- [ ] **Step 1: 初始化项目与 git（若尚无）**

```bash
cd "D:/Hermes/三层五子棋"
git init
npm init -y
```

将 `package.json` 改为：

```json
{
  "name": "three-layer-gomoku",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

然后：`npm install`

- [ ] **Step 2: 写失败测试 `tests/board.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIUS, allCells, isCenter, neighbors, key, NEIGHBOR_DELTAS,
} from '../shared/board.js';

test('hex board has 61 cells for R=4', () => {
  assert.equal(RADIUS, 4);
  assert.equal(allCells().length, 61);
});

test('center is 0,0', () => {
  assert.equal(isCenter(0, 0), true);
  assert.equal(isCenter(1, 0), false);
});

test('center has 6 neighbors', () => {
  assert.equal(neighbors(0, 0).length, 6);
});

test('edge cell has fewer than 6 neighbors', () => {
  assert.ok(neighbors(4, 0).length < 6);
});

test('key roundtrip shape', () => {
  assert.equal(key(1, -2), '1,-2');
});

test('NEIGHBOR_DELTAS has 6 entries', () => {
  assert.equal(NEIGHBOR_DELTAS.length, 6);
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test`  
Expected: FAIL（无法解析 `../shared/board.js` 或导出缺失）

- [ ] **Step 4: 实现 `shared/board.js`**

```js
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

export function allCells() {
  const cells = [];
  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      if (hexDistance(q, r) <= RADIUS) cells.push({ q, r });
    }
  }
  return cells;
}

export function isCenter(q, r) {
  return q === 0 && r === 0;
}

export function inBoard(q, r) {
  return hexDistance(q, r) <= RADIUS;
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`  
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json shared/board.js tests/board.test.js
git commit -m "feat: add hex board geometry for three-layer gomoku"
```

---

### Task 2: 规则引擎 — 状态、布局、放置、移动

**Files:**
- Create: `shared/rules.js`
- Create: `tests/rules-layout.test.js`
- Create: `tests/rules-action.test.js`

**Interfaces:**
- Consumes: `allCells`, `key`, `parseKey`, `isCenter`, `neighbors` from `shared/board.js`
- Produces:
  - `export const PLAYERS = ['A', 'B']`
  - `export const HAND_SIZE = 25`
  - `export const LAYOUT_SCRIPT = [{player:'A',count:1},{player:'B',count:2},{player:'A',count:2},{player:'B',count:1}]`
  - `export function createGame() => GameState`
  - `GameState` 字段：
    - `phase`: `'waiting' | 'layout' | 'action' | 'ended'`
    - `cells`: `Record<string, Array<'A'|'B'>>`  // 自下而上
    - `hand`: `{A:number,B:number}`
    - `current`: `'A'|'B'|null`
    - `layoutStep`: number  // 0..3 index into LAYOUT_SCRIPT
    - `layoutPlacedInStep`: number
    - `winner`: `'A'|'B'|null`
    - `winReason`: `null | 'five' | 'fiveOnThird' | 'threeAdjacentThird'`
    - `selectedAction`: `null | 'place' | 'move'`（仅客户端提示用；服务端以消息为准）
  - `export function startMatch(state)` — `waiting`→`layout`，`current=A`，`layoutStep=0`
  - `export function applyPlace(state, player, q, r) => {ok, error?, state}`
  - `export function applyMove(state, player, fromQ, fromR, toQ, toR) => {ok, error?, state}`
  - `export function resetMatch(state) => GameState` — 清盘回 layout（保留两人已在房的假定由 server 处理）

**布局规则实现要点：**
- 仅 `phase==='layout'` 且 `player===current`
- 空位、非中心、不与己方**任意层**棋子相邻（布局时堆高均为 1）
- 成功后 `hand[player]--`，`layoutPlacedInStep++`；若达到本步 `count` 则 `layoutStep++` 并换手；若 `layoutStep===4` 则 `phase='action'`，`current='A'`

**放置（行动）：**
- `phase==='action'`，手棋>0，目标空位

**移动：**
- 源堆顶为 `player`；目标在 `neighbors(from)`；`destH = cells[to].length`；`destH<=1`；`startLevel = cells[from].length`（移顶后原高等于 startLevel）；`destH <= startLevel`；移后目标高 ≤3（由 destH≤1 保证）
- 从源 pop，push 到目标；不改 hand

- [ ] **Step 1: 写布局失败测试 `tests/rules-layout.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startMatch, applyPlace } from '../shared/rules.js';
import { key } from '../shared/board.js';

test('layout rejects center', () => {
  let s = startMatch(createGame());
  const r = applyPlace(s, 'A', 0, 0);
  assert.equal(r.ok, false);
});

test('layout A places one then switches to B', () => {
  let s = startMatch(createGame());
  const r = applyPlace(s, 'A', 2, 0);
  assert.equal(r.ok, true);
  assert.equal(r.state.current, 'B');
  assert.equal(r.state.layoutStep, 1);
});

test('layout rejects adjacent to own', () => {
  let s = startMatch(createGame());
  s = applyPlace(s, 'A', 2, 0).state;
  // B places two far away
  s = applyPlace(s, 'B', -2, 0).state;
  s = applyPlace(s, 'B', -2, 2).state;
  // A step: first stone at 3,0 then cannot place at 3,-1 if adjacent to 2,0? 
  // After A first stone at 2,0, A's second layout step starts with empty own? 
  // Re-check: after A1 and B2, A places 2. First of the two at (3,-1) neighbor of (2,0).
  const bad = applyPlace(s, 'A', 3, -1);
  assert.equal(bad.ok, false);
});

test('layout completes into action after 6 stones', () => {
  let s = startMatch(createGame());
  // Helper sequence using far cells — implement in test with explicit list
  const seq = [
    ['A', 4, 0],
    ['B', -4, 0], ['B', -4, 4],
    ['A', 0, 4], ['A', 0, -4],
    ['B', 4, -4],
  ];
  for (const [p, q, r] of seq) {
    const res = applyPlace(s, p, q, r);
    assert.equal(res.ok, true, res.error);
    s = res.state;
  }
  assert.equal(s.phase, 'action');
  assert.equal(s.current, 'A');
});
```

若邻接断言因坐标选点失败，改用 `neighbors` 显式取 `2,0` 的一个邻点作为非法点。

- [ ] **Step 2: 写行动测试 `tests/rules-action.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startMatch, applyPlace, applyMove } from '../shared/rules.js';
import { key } from '../shared/board.js';

function finishLayout(s) {
  const seq = [
    ['A', 4, 0],
    ['B', -4, 0], ['B', -4, 4],
    ['A', 0, 4], ['A', 0, -4],
    ['B', 4, -4],
  ];
  for (const [p, q, r] of seq) s = applyPlace(s, p, q, r).state;
  return s;
}

test('action place on empty', () => {
  let s = finishLayout(startMatch(createGame()));
  const r = applyPlace(s, 'A', 1, 0);
  assert.equal(r.ok, true);
  assert.equal(r.state.cells[key(1, 0)][0], 'A');
  assert.equal(r.state.current, 'B');
});

test('move stack one onto one', () => {
  let s = finishLayout(startMatch(createGame()));
  s = applyPlace(s, 'A', 1, 0).state;
  s = applyPlace(s, 'B', 2, 0).state;
  // Move A from 1,0 onto 2,0 if adjacent — (1,0) neighbors include (2,0)? delta (1,0) yes
  // But current is A after B placed? After A place current B; after B place current A.
  const r = applyMove(s, 'A', 1, 0, 2, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.cells[key(2, 0)], ['B', 'A']);
});

test('cannot stack onto height 2', () => {
  let s = finishLayout(startMatch(createGame()));
  // Build height-2 at (2,0), try move onto it from adjacent own top — construct carefully
  s = applyPlace(s, 'A', 1, 0).state;
  s = applyPlace(s, 'B', 3, 0).state;
  s = applyMove(s, 'A', 1, 0, 2, 0).state; // need empty 2,0 first
  // Prefer: place A at 2,0, place B elsewhere, move A 1,0->2,0 making [A,A], then B move attempt onto 2,0
  // Keep assertion: destH===2 => ok false
});
```

把第三条测例写完整：先摆出高度 2 的堆，再断言 `applyMove` 失败。

- [ ] **Step 3: 跑测试确认失败**

Run: `npm test`  
Expected: rules 相关 FAIL

- [ ] **Step 4: 实现 `shared/rules.js`（完整可运行）**

实现须包含：`createGame`、`clone`（结构化克隆或手工拷贝 cells）、`startMatch`、`applyPlace`、`applyMove`、`advanceAfterLayoutPlace`、`checkWinner` 可先 stub 返回 null（Task 3 补全），但 `applyPlace`/`applyMove` 成功末尾调用 `checkWinner`。

`createGame` 初始：`phase:'waiting'`，所有 `allCells()` 键对应 `[]`，`hand:{A:25,B:25}`，其余 null/0。

- [ ] **Step 5: 跑测试确认布局与行动 PASS**

Run: `npm test`  
Expected: board + layout + action PASS（win 测试尚未添加）

- [ ] **Step 6: Commit**

```bash
git add shared/rules.js tests/rules-layout.test.js tests/rules-action.test.js
git commit -m "feat: add layout place and move rules"
```

---

### Task 3: 胜负判定

**Files:**
- Modify: `shared/rules.js`（实现 `checkWinner` / `export function evaluateWinner(state)`）
- Create: `tests/rules-win.test.js`

**Interfaces:**
- Produces: `evaluateWinner(state) => {winner, winReason} | null`
- 在每次成功 `applyPlace`/`applyMove` 后：若有胜者则 `phase='ended'`，设置 `winner`/`winReason`，`current=null`

**算法：**
1. **five**：对每个有顶层的格子，对 `LINE_DIRS` 每个方向，若反方向邻格顶层**不是**同色（或越界），则从此格沿正方向数连续同色顶层长度 `len`；若 `len===5` 则该顶层玩家胜。
2. **fiveOnThird**：对玩家 P，计数 `cells` 中 `stack.length===3 && stack[2]===P` 的数量，若 `>=5` 则 P 胜。
3. **threeAdjacentThird**：收集 P 的第三层格子，BFS/DFS 求最大连通块，若 `>=3` 则 P 胜。
4. 检查顺序：先 five，再 fiveOnThird，再 threeAdjacentThird；同一操作后双方都可能？只检查刚刚行动的 `player` 即可（原型足够）。

- [ ] **Step 1: 写 `tests/rules-win.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, evaluateWinner } from '../shared/rules.js';
import { key } from '../shared/board.js';

function blank() {
  return createGame();
}

test('exact five in a row wins', () => {
  const s = blank();
  // Place A tops on (0,0)-(4,0) — note (0,0) allowed in synthetic state
  for (let q = 0; q < 5; q++) s.cells[key(q, 0)] = ['A'];
  const w = evaluateWinner(s, 'A');
  assert.equal(w.winner, 'A');
  assert.equal(w.winReason, 'five');
});

test('six in a row does not win via five', () => {
  const s = blank();
  for (let q = 0; q < 6; q++) s.cells[key(q, 0)] = ['A'];
  const w = evaluateWinner(s, 'A');
  assert.ok(!w || w.winReason !== 'five');
});

test('five on third layer wins', () => {
  const s = blank();
  const spots = [[0,0],[1,0],[2,0],[0,1],[0,2]];
  for (const [q, r] of spots) s.cells[key(q, r)] = ['B', 'B', 'A'];
  const w = evaluateWinner(s, 'A');
  assert.equal(w.winReason, 'fiveOnThird');
});

test('three adjacent third wins', () => {
  const s = blank();
  s.cells[key(0, 0)] = ['B', 'B', 'A'];
  s.cells[key(1, 0)] = ['B', 'B', 'A'];
  s.cells[key(0, 1)] = ['B', 'B', 'A'];
  const w = evaluateWinner(s, 'A');
  assert.equal(w.winReason, 'threeAdjacentThird');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/rules-win.test.js`  
Expected: FAIL

- [ ] **Step 3: 实现 `evaluateWinner` 并接入 apply\***

- [ ] **Step 4: 全量 `npm test` PASS**

- [ ] **Step 5: Commit**

```bash
git add shared/rules.js tests/rules-win.test.js
git commit -m "feat: add three win condition checks"
```

---

### Task 4: HTTP + WebSocket 服务端房间

**Files:**
- Create: `server.js`
- Create: `public/index.html`（占位：标题 +「连接中」即可，Task 5 完善）
- Modify: `README.md`

**Interfaces:**
- WS 消息（JSON）：
  - Client→Server:
    - `{type:'create'}`
    - `{type:'join'}`
    - `{type:'place', q, r}`
    - `{type:'move', fromQ, fromR, toQ, toR}`
    - `{type:'restart'}`
  - Server→Client:
    - `{type:'error', message}`
    - `{type:'assigned', seat:'A'|'B', lanHint:string}`
    - `{type:'state', state:PublicState, you:'A'|'B'}`
- `PublicState` = GameState 可序列化副本（勿塞函数）
- 单房间：`room = { sockets: Map<seat, ws>, state }`
- `create`：若已有 A 则 error「房间已有主机」；分配 A；state 保持 waiting
- `join`：需已有 A 无 B；分配 B；`startMatch(state)`；`broadcast state`
- 操作类：校验 `ws` 座位 === `state.current`（ended/waiting 拒绝）；调用 rules；`broadcast`
- `restart`：两人在房时 `state = startMatch(createGame())` 但保持 phase layout（`startMatch`）；broadcast
- HTTP：`fs` 读 `public/`；另将 `/shared/*.js` 映射到 `shared/` 以便浏览器 `import`
- 启动时 `os.networkInterfaces()` 打印 `http://<局域网IP>:3000`

- [ ] **Step 1: 实现 `server.js` 最小可启动版**

要点代码结构：

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { createGame, startMatch, applyPlace, applyMove } from './shared/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
// ... static handler for public/ and shared/
// ... room state + wss.on('connection')
```

- [ ] **Step 2: 写占位 `public/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>三层五子棋</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <h1>三层五子棋</h1>
  <div id="app"></div>
  <script type="module" src="/client.js"></script>
</body>
</html>
```

并写空的 `public/style.css`、`public/client.js`（`console.log('client ok')`）。

- [ ] **Step 3: 启动并手动检查**

Run: `npm start`  
Expected: 终端打印本机与局域网 URL；浏览器打开见标题；无崩溃。

用两台浏览器或两个隐私窗口：create / join（可用临时在 Node REPL 或后续 Task 5 UI；本步可用 `websocat` 或浏览器控制台手动 `new WebSocket`——若无 websocat，本步至少确认 HTTP 200，WS 握手在 Task 5 用 UI 验）。

- [ ] **Step 4: Commit**

```bash
git add server.js public/index.html public/style.css public/client.js README.md
git commit -m "feat: add websocket room server and static hosting"
```

---

### Task 5: 前端大厅 + Canvas 棋盘渲染

**Files:**
- Create: `public/render.js`
- Modify: `public/client.js`
- Modify: `public/style.css`
- Modify: `public/index.html`
- Modify: `README.md`

**Interfaces:**
- `render.js`: `export function drawBoard(ctx, state, opts)`  
  `opts = { size, origin, highlights: Array<{q,r,color}>, selected:{q,r}|null }`
- 深色背景 `#1a2744`，白线；棋子 A 深棕圆柱、B 浅圆柱；按层向上偏移绘制
- `client.js`：连接 `ws`（`location.host`）；大厅按钮创建/加入；显示 `lanHint`；收到 `state` 后重绘

- [ ] **Step 1: 实现 `render.js` 画线与棋子**

用 `allCells` + `axialToPixel` + 对每条邻接画一次线（只画 `key(a) < key(b)` 避免重复）。

- [ ] **Step 2: 实现大厅 UI 与状态旁路（阶段、当前玩家、手棋）**

- [ ] **Step 3: 双窗口验证：创建/加入后双方看到布局阶段与空棋盘**

- [ ] **Step 4: 更新 README 启动步骤（中文）**

```markdown
# 三层五子棋

## 运行
1. 安装 Node.js 18+
2. npm install
3. npm start
4. 主机与队友浏览器打开终端里打印的局域网地址
5. 一人「创建房间」，一人「加入房间」
```

- [ ] **Step 5: Commit**

```bash
git add public README.md
git commit -m "feat: add lobby UI and canvas board renderer"
```

---

### Task 6: 前端对局操作 + 结束与再来

**Files:**
- Modify: `public/client.js`
- Modify: `public/style.css`

**行为：**
- 布局：点击空位 → `{type:'place',q,r}`（无需模式按钮）
- 行动：按钮「放置」「移动」
  - 放置：点击空位 → place
  - 移动：先点己方堆顶格 → 高亮合法邻格 → 再点目标 → move
- 合法高亮：可复用浏览器侧简化预览（可选）；以服务端 error 提示为准（`#message`）
- `phase==='ended'`：显示胜者与胜法中文映射  
  `five`→「俯视五连」；`fiveOnThird`→「第三层五枚」；`threeAdjacentThird`→「第三层三相邻」
- 「再来一局」→ `{type:'restart'}`

- [ ] **Step 1: 实现点击命中检测**

将像素转最近交点：遍历 `allCells`，取与点击距离最小且小于 `size*0.45` 的点。

- [ ] **Step 2: 实现放置/移动状态机与按钮**

- [ ] **Step 3: 双人走完布局并各放置/移动至少一次**

- [ ] **Step 4: 构造或正常玩出一种胜负，确认结束 UI 与 restart**

- [ ] **Step 5: Commit**

```bash
git add public/client.js public/style.css
git commit -m "feat: add place/move controls and endgame UI"
```

---

### Task 7: 验收对照设计文档

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-three-layer-gomoku-design.md`（勾选验收标准，可选）

- [ ] **Step 1: 跑 `npm test` 全绿**

- [ ] **Step 2: 按设计验收清单手工过一遍**

- [ ] 两人能用局域网 IP 加入同一局  
- [ ] 布局 6 步约束正确（中心、邻己）  
- [ ] 放置与移动（含禁叠二层）可用  
- [ ] 三种胜法可用测试或沙盒触发（若 UI 难造，靠 `tests/rules-win.test.js` 覆盖即可）  
- [ ] 再来一局回到布局  

- [ ] **Step 3: 最终提交（若有文档勾选变更）**

```bash
git add -A
git commit -m "docs: mark prototype acceptance checks"
```

---

## Self-Review (plan author)

1. **Spec coverage:** 联机、布局、放置、移动叠放、三种胜、再来一局、深色棋盘视觉均有对应 Task；不做项未列入。  
2. **Placeholder scan:** 无 TBD；Task 2 第三条移动测例要求写完整断言。  
3. **Type consistency:** `applyPlace` / `applyMove` / `startMatch` / `createGame` / `evaluateWinner` / `winReason` 字符串与 Task 4 消息字段一致。

---

## Execution Handoff
