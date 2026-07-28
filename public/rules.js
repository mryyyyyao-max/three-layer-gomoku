import { drawBoard } from './render.js?v=12';
import { allCells, key } from '/shared/board.js?v=12';
import { buildChapters } from './rules-demos.js?v=12';

function framesToState(frame) {
  const cells = {};
  for (const { q, r } of allCells()) cells[key(q, r)] = [];
  for (const [cellKey, stack] of Object.entries(frame.cells || {})) {
    cells[cellKey] = stack.slice();
  }

  return {
    phase: 'action',
    cells,
    hand: { A: 25, B: 25 },
    current: frame.turn || 'A',
    layoutStep: 0,
    layoutPlacedInStep: 0,
    winner: null,
    winReason: null,
    selectedAction: null,
  };
}

function drawFrame(ctx, frame, size = 22) {
  drawBoard(ctx, framesToState(frame), {
    size,
    origin: { x: ctx.canvas.width / 2, y: ctx.canvas.height / 2 + 8 },
    highlights: frame.highlights || [],
    selected: null,
    ghost: null,
    liftSelected: false,
  });
}

function setChrome(section, frame) {
  const stepEl = section.querySelector('.demo-step');
  const captionEl = section.querySelector('.demo-caption');
  const tipEl = section.querySelector('.demo-tip');
  const turnEl = section.querySelector('.demo-turn');

  if (stepEl) stepEl.textContent = frame.step || '';
  if (captionEl) captionEl.textContent = frame.caption || '';

  if (tipEl) {
    if (frame.tip) {
      tipEl.hidden = false;
      tipEl.textContent = frame.tip;
    } else {
      tipEl.hidden = true;
      tipEl.textContent = '';
    }
  }

  if (turnEl) {
    const turn = frame.turn;
    turnEl.hidden = !turn;
    turnEl.dataset.turn = turn || '';
    turnEl.innerHTML = turn
      ? `<span class="demo-turn-piece demo-turn-${turn}"></span><span>${turn === 'A' ? '先手回合' : '后手回合'}</span>`
      : '';
  }

  section.classList.toggle('is-bad', frame.flash === 'bad');
  section.classList.toggle('is-ok', frame.flash === 'ok');
}

function panelMarkup(title, blurb, aria) {
  return `
    <div class="demo-meta">
      <div class="demo-turn" hidden></div>
      <p class="demo-step"></p>
    </div>
    <h3 class="demo-panel-title">${title}</h3>
    <p class="rules-blurb">${blurb}</p>
    <div class="rules-canvas-wrap">
      <canvas width="400" height="360" aria-label="${aria}"></canvas>
      <p class="demo-tip" hidden></p>
    </div>
    <p class="demo-caption"></p>
  `;
}

function mountChapters(root, chapters) {
  root.innerHTML = '';
  const mounts = [];

  for (const chapter of chapters) {
    if (chapter.layout === 'row' && Array.isArray(chapter.panels)) {
      const section = document.createElement('section');
      section.className = 'rules-chapter rules-wins';
      section.dataset.chapterId = chapter.id;
      section.innerHTML = `<h2>${chapter.title}</h2><p class="rules-blurb">${chapter.blurb}</p><div class="rules-wins-row"></div>`;
      const row = section.querySelector('.rules-wins-row');
      root.appendChild(section);

      for (const panel of chapter.panels) {
        const card = document.createElement('article');
        card.className = 'rules-win-card rules-chapter';
        card.dataset.chapterId = panel.id;
        card.innerHTML = panelMarkup(panel.title, panel.blurb, panel.title);
        row.appendChild(card);
        const canvas = card.querySelector('canvas');
        mounts.push({
          chapter: { ...panel, static: true, frames: panel.frames },
          section: card,
          ctx: canvas.getContext('2d'),
        });
      }
      continue;
    }

    const section = document.createElement('section');
    section.className = 'rules-chapter';
    section.dataset.chapterId = chapter.id;
    section.innerHTML = `
      <h2>${chapter.title}</h2>
      <p class="rules-blurb">${chapter.blurb}</p>
      <div class="demo-meta">
        <div class="demo-turn" hidden></div>
        <p class="demo-step"></p>
      </div>
      <div class="rules-canvas-wrap">
        <canvas width="440" height="400" aria-label="${chapter.title}"></canvas>
        <p class="demo-tip" hidden></p>
      </div>
      <p class="demo-caption"></p>
    `;
    root.appendChild(section);
    const canvas = section.querySelector('canvas');
    mounts.push({
      chapter,
      section,
      ctx: canvas.getContext('2d'),
    });
  }

  return mounts;
}

class DemoLoop {
  constructor({ frames, ctx, section, reducedMotion, staticOnly }) {
    this.frames = frames;
    this.ctx = ctx;
    this.section = section;
    this.reducedMotion = reducedMotion;
    this.staticOnly = staticOnly;
    this.index = 0;
    this.timer = null;
    this.running = false;
  }

  draw() {
    const frame = this.frames[this.index];
    setChrome(this.section, frame);
    drawFrame(this.ctx, frame, this.section.classList.contains('rules-win-card') ? 18 : 22);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.draw();
    if (this.staticOnly || this.reducedMotion || this.frames.length <= 1) return;

    const tick = () => {
      const hold = this.frames[this.index].holdMs || 1200;
      this.timer = setTimeout(() => {
        if (!this.running) return;
        this.index = (this.index + 1) % this.frames.length;
        this.draw();
        tick();
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

const root = document.getElementById('rules-main');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mounts = mountChapters(root, buildChapters());
const loops = mounts.map(({ chapter, section, ctx }) => {
  const loop = new DemoLoop({
    frames: chapter.frames,
    ctx,
    section,
    reducedMotion,
    staticOnly: Boolean(chapter.static),
  });
  loop.draw();
  return { section, loop, staticOnly: Boolean(chapter.static) };
});

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const item = loops.find((loop) => loop.section === entry.target);
      if (!item) continue;
      if (item.staticOnly) {
        if (entry.isIntersecting) item.loop.draw();
        continue;
      }
      if (entry.isIntersecting) item.loop.start();
      else item.loop.stop();
    }
  },
  { threshold: 0.3 },
);

for (const { section } of loops) observer.observe(section);
