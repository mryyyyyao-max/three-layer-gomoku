import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startMatch, applyPlace, applyMove } from '../shared/rules.js';
import { key } from '../shared/board.js';

/** 布局用远处交点（避开六个缺角尖端） */
function finishLayout(s) {
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
  const r = applyMove(s, 'A', 1, 0, 2, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.cells[key(2, 0)], ['B', 'A']);
});

test('two adjacent height-2 stacks can make height 3', () => {
  let s = finishLayout(startMatch(createGame()));
  // Build [A,A] at 2,0 and [B,A] at 1,0 — both height 2, adjacent
  s = applyPlace(s, 'A', 2, 0).state;
  s = applyPlace(s, 'B', 1, 0).state;
  s = applyPlace(s, 'A', 3, 0).state;
  s = applyPlace(s, 'B', -1, 0).state;
  s = applyMove(s, 'A', 3, 0, 2, 0).state; // [A,A]
  s = applyPlace(s, 'B', -2, 0).state;
  s = applyPlace(s, 'A', 1, 1).state;
  s = applyPlace(s, 'B', -1, 1).state;
  s = applyMove(s, 'A', 1, 1, 1, 0).state; // [B,A] height 2
  s = applyPlace(s, 'B', -2, 1).state;
  assert.equal(s.cells[key(1, 0)].length, 2);
  assert.equal(s.cells[key(2, 0)].length, 2);
  const r = applyMove(s, 'A', 1, 0, 2, 0);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.state.cells[key(2, 0)].length, 3);
});

test('cannot stack onto height 3', () => {
  let s = finishLayout(startMatch(createGame()));
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
  s = applyPlace(s, 'A', 2, 1).state; // adjacent single
  s = applyPlace(s, 'B', -3, 1).state;
  const r = applyMove(s, 'A', 2, 1, 2, 0);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'stack would exceed 3');
});

test('reject non-integer place coords', () => {
  let s = finishLayout(startMatch(createGame()));
  const r = applyPlace(s, 'A', 1.5, 0);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'out of board');
});
