import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startMatch, applyPlace } from '../shared/rules.js';
import { key, neighbors } from '../shared/board.js';

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
  // Prefer (3,-1); fall back to an explicit neighbor of A's stone at (2,0)
  const ownNeighbors = neighbors(2, 0);
  const candidate = ownNeighbors.find((c) => c.q === 3 && c.r === -1) ?? ownNeighbors[0];
  const bad = applyPlace(s, 'A', candidate.q, candidate.r);
  assert.equal(bad.ok, false);
});

test('layout completes into action after 6 stones', () => {
  let s = startMatch(createGame());
  const seq = [
    ['A', 3, 0],
    ['B', -3, 0], ['B', -3, 3],
    ['A', 0, 3], ['A', 0, -3],
    ['B', 3, -3],
  ];
  for (const [p, q, r] of seq) {
    const res = applyPlace(s, p, q, r);
    assert.equal(res.ok, true, res.error);
    s = res.state;
  }
  assert.equal(s.phase, 'action');
  assert.equal(s.current, 'A');
});

test('layout rejects corner tips', () => {
  let s = startMatch(createGame());
  const r = applyPlace(s, 'A', 4, 0);
  assert.equal(r.ok, false);
});
