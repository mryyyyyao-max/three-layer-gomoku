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
