import { drawBoard } from './render.js?v=7';
import { allCells, key } from '/shared/board.js?v=7';
import { buildChapters } from './rules-demos.js';

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
    current: 'A',
    layoutStep: 0,
    layoutPlacedInStep: 0,
    winner: null,
    winReason: null,
    selectedAction: null,
  };
}

function mountChapters(root, chapters) {
  root.innerHTML = '';

  return chapters.map((chapter) => {
    const section = document.createElement('section');
    section.className = 'rules-chapter';
    section.dataset.chapterId = chapter.id;
    section.innerHTML = `<h2>${chapter.title}</h2><p class="rules-blurb">${chapter.blurb}</p>
      <div class="rules-canvas-wrap"><canvas width="440" height="400" aria-label="${chapter.title}"></canvas></div>`;
    root.appendChild(section);

    const canvas = section.querySelector('canvas');
    return { chapter, section, ctx: canvas.getContext('2d') };
  });
}

class DemoLoop {
  constructor({ frames, ctx, section, reducedMotion }) {
    this.frames = frames;
    this.ctx = ctx;
    this.section = section;
    this.reducedMotion = reducedMotion;
    this.index = 0;
    this.timer = null;
    this.running = false;
  }

  draw() {
    const frame = this.frames[this.index];
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
    if (this.reducedMotion) return;

    const tick = () => {
      const hold = this.frames[this.index].holdMs;
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
  });
  loop.draw();
  return { section, loop };
});

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const item = loops.find((loop) => loop.section === entry.target);
    if (!item) continue;
    if (entry.isIntersecting) item.loop.start();
    else item.loop.stop();
  }
}, { threshold: 0.35 });

for (const { section } of loops) observer.observe(section);
