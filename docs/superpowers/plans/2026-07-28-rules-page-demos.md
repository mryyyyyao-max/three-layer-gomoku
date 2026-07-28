# Illustrated Rules Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 独立 `/rules.html` 纵向七章规则页，每章用复用 `render.js` 的迷你 Canvas 循环动画演示；大厅与对局均可进入并返回。

**Architecture:** `rules.js` 定义七段「关键帧」时间轴（局面 `cells` + highlights + caption tick）；`DemoLoop` 用 `IntersectionObserver` 控制播放；绘制一律调用 `drawBoard`。不改对局规则与 WebSocket。

**Tech Stack:** 现有静态页 + ES modules、`render.js`、`shared/board.js`、CSS、`IntersectionObserver`、`prefers-reduced-motion`。

**Spec:** `docs/superpowers/specs/2026-07-28-rules-page-demos-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `public/rules.html` | 七章 DOM、顶栏返回 |
| `public/rules.css` | 章节排版、canvas 容器 |
| `public/rules.js` | 时间轴数据 + DemoLoop + 启动 |
| `public/rules-demos.js` | 七章帧序列工厂（纯数据，便于单测） |
| `tests/rules-demos.test.js` | 断言帧序列长度/关键非法叠层示意存在 |
| `public/render.js` | 仅必要时 bump `?v=`；API 已够用则不改逻辑 |
| `public/index.html` | 大厅「规则」链接 |
| `public/client.js` / `index.html` game 区 | 对局「规则」链接 |
| `README.md` | 一行指向规则页 |

---

### Task 1: Demo frame helpers (TDD)

**Files:**
- Create: `public/rules-demos.js`
- Create: `tests/rules-demos.test.js`

规则演示帧格式：

```js
/**
 * @typedef {{ q:number, r:number, stack: string[] }} DemoCell
 * @typedef {{
 *   cells: Record<string, string[]>,
 *   highlights?: Array<{q:number,r:number,color:string}>,
 *   holdMs: number,
 *   flash?: 'ok'|'bad'|null
 * }} DemoFrame
 * @typedef {{ id:string, title:string, blurb:string, frames: DemoFrame[] }} DemoChapter
 */
```

- [ ] **Step 1: Write failing tests**

`tests/rules-demos.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChapters } from '../public/rules-demos.js';
import { key } from '../shared/board.js';

test('buildChapters returns 7 chapters with frames', () => {
  const chapters = buildChapters();
  assert.equal(chapters.length, 7);
  for (const ch of chapters) {
    assert.ok(ch.id && ch.title && ch.blurb);
    assert.ok(ch.frames.length >= 3);
    for (const f of ch.frames) {
      assert.ok(f.holdMs >= 200);
      assert.equal(typeof f.cells, 'object');
    }
  }
});

test('stack chapter includes illegal 1-onto-2 bad flash', () => {
  const stack = buildChapters().find((c) => c.id === 'stack');
  assert.ok(stack);
  const bad = stack.frames.some((f) => f.flash === 'bad');
  assert.equal(bad, true);
});

test('five-in-a-row chapter has a frame with five top A in a line keys', () => {
  const five = buildChapters().find((c) => c.id === 'win-five');
  assert.ok(five);
  // At least one frame highlights 5 cells
  const lit = five.frames.some((f) => (f.highlights?.length ?? 0) >= 5);
  assert.equal(lit, true);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test tests/rules-demos.test.js`  
Expected: cannot find module / buildChapters not exported.

- [ ] **Step 3: Implement `public/rules-demos.js`**

```js
import { key } from '../shared/board.js';

function emptyCells() {
  // Only store non-empty stacks in frames to keep payloads small;
  // rules.js merge into full board state when drawing.
  return {};
}

function cellMap(entries) {
  // entries: [q,r,stack][]
  const cells = {};
  for (const [q, r, stack] of entries) cells[key(q, r)] = stack.slice();
  return cells;
}

export function buildChapters() {
  return [
    {
      id: 'board',
      title: '棋盘与棋子',
      blurb: '六边形点位；深色先手、浅色后手；同一点可叠到三层。',
      frames: [
        { cells: cellMap([[2, 0, ['A']]]), holdMs: 900 },
        { cells: cellMap([[2, 0, ['A', 'B']]]), holdMs: 900 },
        { cells: cellMap([[2, 0, ['A', 'B', 'A']]]), holdMs: 1200 },
      ],
    },
    {
      id: 'layout',
      title: '布局阶段',
      blurb: '顺序 A1→B2→A2→B1；不可中心、不可与己邻。',
      frames: [/* progressive legal layout stones; one frame flash bad on center */],
    },
    {
      id: 'place',
      title: '行动：放置',
      blurb: '行动阶段可向空位落子，中心也可。',
      frames: [/* … */],
    },
    {
      id: 'stack',
      title: '行动：移动与叠层',
      blurb: '只能平迁或下降一层；一层不能踩二层，二层不能落空地，三层只能上二层。',
      frames: [
        // legal 1→1, legal 2→2, then bad flashes for 1→2 / 2→0 / 3→0
        { cells: cellMap([[1, 0, ['A']], [2, 0, ['B']]]), holdMs: 700 },
        { cells: cellMap([[2, 0, ['B', 'A']]]), holdMs: 900, flash: 'ok' },
        // … include at least one flash:'bad'
      ],
    },
    {
      id: 'win-five',
      title: '胜法：俯视恰好五连',
      blurb: '只看顶层颜色，恰好五连获胜；六连不算。',
      frames: [/* five tops + highlights length 5; optional six without win highlight */],
    },
    {
      id: 'win-third-five',
      title: '胜法：第三层五枚',
      blurb: '至少五处「第三层顶为自己」即胜。',
      frames: [/* … */],
    },
    {
      id: 'win-third-adj',
      title: '胜法：第三层三相邻',
      blurb: '己方第三层形成三格以上连通块即胜。',
      frames: [/* … */],
    },
  ];
}
```

Fill every chapter with **≥3 real frames** using legal board coordinates from `shared/board.js` (`inBoard`). Prefer compact clusters near center for readability on small canvas. For `layout` bad frame: highlight `(0,0)` with red color `rgba(180,40,40,0.35)` and `flash:'bad'`.

Note: Node tests import `public/rules-demos.js` which imports `../shared/board.js` — use extension `.js` and ensure package `"type":"module"` already set.

- [ ] **Step 4: Run tests — PASS**

Run: `node --test tests/rules-demos.test.js`

- [ ] **Step 5: Commit**

```bash
git add public/rules-demos.js tests/rules-demos.test.js
git commit -m "feat: rules demo chapter frame data"
```

---

### Task 2: Rules page shell + CSS + entries

**Files:**
- Create: `public/rules.html`
- Create: `public/rules.css`
- Modify: `public/index.html`
- Modify: `public/client.js` (game header link) OR add link in `index.html` `#game` status-bar

- [ ] **Step 1: Create `public/rules.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>三层五子棋 · 规则</title>
  <link rel="stylesheet" href="/style.css?v=7" />
  <link rel="stylesheet" href="/rules.css?v=1" />
</head>
<body class="rules-page">
  <header class="rules-top">
    <a class="rules-back" href="/">← 返回游戏</a>
    <h1>三层五子棋 · 规则</h1>
  </header>
  <main id="rules-main" class="rules-main"></main>
  <script type="module" src="/rules.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 2: `public/rules.css`**

```css
.rules-page { max-width: 720px; margin: 0 auto; padding: 16px; }
.rules-top { margin-bottom: 24px; }
.rules-back { color: inherit; }
.rules-chapter { margin-bottom: 40px; }
.rules-chapter h2 { font-size: 1.25rem; margin: 0 0 6px; }
.rules-blurb { opacity: 0.85; margin: 0 0 12px; }
.rules-canvas-wrap {
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1.1;
  border-radius: 8px;
  overflow: hidden;
  background: #d4c7ae;
}
.rules-canvas-wrap canvas { width: 100%; height: 100%; display: block; }
.rules-chapter.is-bad .rules-canvas-wrap { outline: 2px solid rgba(160,40,40,0.55); }
.rules-chapter.is-ok .rules-canvas-wrap { outline: 2px solid rgba(40,120,60,0.45); }
@media (prefers-reduced-motion: reduce) {
  .rules-canvas-wrap { outline-color: transparent; }
}
```

- [ ] **Step 3: Lobby + game links**

In `public/index.html` header subtitle area or lobby:

```html
<p class="nav-links"><a href="/rules.html">规则</a></p>
```

In `#game` `.status-bar` top row add:

```html
<a href="/rules.html" class="rules-link">规则</a>
```

Bump game `style.css` / `client.js` cache to `?v=7` where needed.

- [ ] **Step 4: Manual open**

Run: `npm start` → open `http://localhost:3000/rules.html` — page loads shell (JS next task may still be stub).

- [ ] **Step 5: Commit**

```bash
git add public/rules.html public/rules.css public/index.html public/client.js public/style.css
git commit -m "feat: rules page shell and navigation links"
```

---

### Task 3: DemoLoop player + wire chapters

**Files:**
- Create: `public/rules.js`
- Modify: `public/rules-demos.js` if draw needs full `state` shape

- [ ] **Step 1: Implement frame → gameState adapter in `rules.js`**

```js
import { drawBoard } from './render.js?v=7';
import { allCells, key } from '/shared/board.js?v=7';
import { buildChapters } from './rules-demos.js';

function framesToState(frame) {
  const cells = {};
  for (const { q, r } of allCells()) cells[key(q, r)] = [];
  for (const [k, stack] of Object.entries(frame.cells || {})) {
    cells[k] = stack.slice();
  }
  return {
    phase: 'action',
    cells,
    hand: { A: 25, B: 25 },
    current: 'A',
    layoutStep: 0,
    layoutPlacedInStep: 0,
    winner: null,
    winReason: null,
    selectedAction: null,
  };
}
```

- [ ] **Step 2: Mount DOM from chapters**

```js
function mountChapters(root, chapters) {
  root.innerHTML = '';
  return chapters.map((ch) => {
    const section = document.createElement('section');
    section.className = 'rules-chapter';
    section.dataset.chapterId = ch.id;
    section.innerHTML = `<h2>${ch.title}</h2><p class="rules-blurb">${ch.blurb}</p>
      <div class="rules-canvas-wrap"><canvas width="440" height="400" aria-label="${ch.title}"></canvas></div>`;
    root.appendChild(section);
    const canvas = section.querySelector('canvas');
    return { ch, section, canvas, ctx: canvas.getContext('2d') };
  });
}
```

- [ ] **Step 3: DemoLoop class**

```js
class DemoLoop {
  constructor({ frames, ctx, section, reducedMotion }) {
    this.frames = frames;
    this.ctx = ctx;
    this.section = section;
    this.reducedMotion = reducedMotion;
    this.i = 0;
    this.timer = null;
    this.running = false;
  }
  draw() {
    const frame = this.frames[this.i];
    const state = framesToState(frame);
    this.section.classList.toggle('is-bad', frame.flash === 'bad');
    this.section.classList.toggle('is-ok', frame.flash === 'ok');
    drawBoard(this.ctx, state, {
      size: 22,
      origin: { x: this.ctx.canvas.width / 2, y: this.ctx.canvas.height / 2 + 10 },
      highlights: frame.highlights || [],
      selected: null,
      ghost: null,
      liftSelected: false,
    });
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.draw();
    if (this.reducedMotion) return; // static first frame only
    const tick = () => {
      const hold = this.frames[this.i].holdMs;
      this.timer = setTimeout(() => {
        this.i = (this.i + 1) % this.frames.length;
        this.draw();
        if (this.running) tick();
      }, hold);
    };
    tick();
  }
  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
```

- [ ] **Step 4: IntersectionObserver wiring**

```js
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapters = buildChapters();
const mounts = mountChapters(document.getElementById('rules-main'), chapters);
const loops = mounts.map(({ ch, section, ctx }) => {
  const loop = new DemoLoop({ frames: ch.frames, ctx, section, reducedMotion: reduced });
  loop.draw();
  return { section, loop };
});

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const item = loops.find((l) => l.section === e.target);
    if (!item) continue;
    if (e.isIntersecting) item.loop.start();
    else item.loop.stop();
  }
}, { threshold: 0.35 });

for (const { section } of loops) io.observe(section);
```

Fix `render.js` import path in rules page: bump render’s board import to `?v=7` if still `v=5`.

- [ ] **Step 5: Manual check**

Open `/rules.html`, scroll: only near chapters animate; stack chapter shows bad flash outline; back link works; lobby/game「规则」works.

- [ ] **Step 6: Commit**

```bash
git add public/rules.js public/rules-demos.js public/render.js
git commit -m "feat: looping mini-board demos on rules page"
```

---

### Task 4: Polish demos + README + verify

**Files:**
- Modify: `public/rules-demos.js` (enrich weak chapters if any)
- Modify: `README.md`
- Optionally: `docs/superpowers/specs/2026-07-28-rules-page-demos-design.md` tick success boxes

- [ ] **Step 1: Ensure each chapter readable on phone**

Manually tweak `size`/frame positions if pieces clip; keep clusters near `(0,0)`.

- [ ] **Step 2: README**

Add under 说明:

```markdown
- 规则图示：浏览器打开 `/rules.html`（大厅与对局内也有入口）
```

- [ ] **Step 3: Run all tests**

Run: `npm test`  
Expected: existing tests + `rules-demos` PASS.

- [ ] **Step 4: Commit**

```bash
git add public/rules-demos.js README.md docs/superpowers/specs/2026-07-28-rules-page-demos-design.md
git commit -m "docs: rules page usage and mark demo criteria"
```

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| `/rules.html` vertical 7 chapters | 2, 3 |
| Looping mini canvas via render.js | 3 |
| Lobby + in-game entries + back | 2 |
| Stack formula demos legal/illegal | 1, 3 |
| IntersectionObserver pause | 3 |
| prefers-reduced-motion | 3 |
| No sandbox / no rule engine change | respected |

No TBD placeholders. Frame typedef shared across Task 1–3. `buildChapters` id `stack` / `win-five` match tests.
