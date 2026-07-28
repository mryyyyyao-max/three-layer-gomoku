import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIUS, allCells, isCenter, neighbors, key, NEIGHBOR_DELTAS, isCornerTip, inBoard,
} from '../shared/board.js';

test('hex board has 55 cells (R=4 minus 6 corner tips)', () => {
  assert.equal(RADIUS, 4);
  assert.equal(allCells().length, 55);
});

test('six corner tips are off-board', () => {
  const tips = [[4, 0], [-4, 0], [0, 4], [0, -4], [4, -4], [-4, 4]];
  for (const [q, r] of tips) {
    assert.equal(isCornerTip(q, r), true);
    assert.equal(inBoard(q, r), false);
  }
});

test('center is 0,0', () => {
  assert.equal(isCenter(0, 0), true);
  assert.equal(isCenter(1, 0), false);
});

test('center has 6 neighbors', () => {
  assert.equal(neighbors(0, 0).length, 6);
});

test('near-edge cell has fewer than 6 neighbors', () => {
  assert.ok(neighbors(3, 0).length < 6);
});

test('key roundtrip shape', () => {
  assert.equal(key(1, -2), '1,-2');
});

test('NEIGHBOR_DELTAS has 6 entries', () => {
  assert.equal(NEIGHBOR_DELTAS.length, 6);
});
