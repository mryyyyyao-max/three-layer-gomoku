import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, evaluateWinner } from '../shared/rules.js';
import { key } from '../shared/board.js';

function blank() {
  return createGame();
}

test('exact five in a row wins', () => {
  const s = blank();
  // Avoid corner tip (4,0); use -2..2
  for (let q = -2; q <= 2; q++) s.cells[key(q, 0)] = ['A'];
  const w = evaluateWinner(s, 'A');
  assert.equal(w.winner, 'A');
  assert.equal(w.winReason, 'five');
});

test('six in a row does not win via five', () => {
  const s = blank();
  for (let q = -3; q <= 2; q++) s.cells[key(q, 0)] = ['A'];
  const w = evaluateWinner(s, 'A');
  assert.ok(!w || w.winReason !== 'five');
});

test('five on third layer wins', () => {
  const s = blank();
  const spots = [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]];
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
