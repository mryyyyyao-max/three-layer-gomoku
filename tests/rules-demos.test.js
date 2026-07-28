import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChapters } from '../public/rules-demos.js';

test('buildChapters has board/layout/place/stack/wins', () => {
  const chapters = buildChapters();
  assert.equal(chapters.length, 5);
  const ids = chapters.map((c) => c.id);
  assert.deepEqual(ids, ['board', 'layout', 'place', 'stack', 'wins']);
});

test('board chapter is static with one frame', () => {
  const board = buildChapters().find((c) => c.id === 'board');
  assert.equal(board.static, true);
  assert.equal(board.frames.length, 1);
});

test('layout has turn markers and illegal tips', () => {
  const layout = buildChapters().find((c) => c.id === 'layout');
  assert.ok(layout.frames.length >= 8);
  assert.ok(layout.frames.some((f) => f.turn === 'A'));
  assert.ok(layout.frames.some((f) => f.turn === 'B'));
  assert.ok(layout.frames.some((f) => f.tip && f.flash === 'bad'));
  assert.ok(layout.frames.every((f) => f.holdMs >= 600));
});

test('place alternates and does not double-drop A without B', () => {
  const place = buildChapters().find((c) => c.id === 'place');
  const turns = place.frames.map((f) => f.turn).filter(Boolean);
  assert.ok(turns.includes('A') && turns.includes('B'));
  assert.ok(place.frames.some((f) => /中心/.test(f.tip || f.caption || '')));
});

test('stack includes illegal tips', () => {
  const stack = buildChapters().find((c) => c.id === 'stack');
  const badTips = stack.frames.filter((f) => f.flash === 'bad' && f.tip);
  assert.ok(badTips.length >= 3);
});

test('wins row has three static panels with five-highlight', () => {
  const wins = buildChapters().find((c) => c.id === 'wins');
  assert.equal(wins.layout, 'row');
  assert.equal(wins.panels.length, 3);
  const five = wins.panels.find((p) => p.id === 'win-five');
  assert.ok((five.frames[0].highlights?.length ?? 0) >= 5);
});
