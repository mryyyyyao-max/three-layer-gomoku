import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newInviteToken, swapSeatMap } from '../server/room.js';

test('newInviteToken is hex length 16', () => {
  const t = newInviteToken();
  assert.match(t, /^[0-9a-f]{16}$/);
});

test('swapSeatMap swaps A and B', () => {
  const m = new Map([['A', 'wsA'], ['B', 'wsB']]);
  const s = swapSeatMap(m);
  assert.equal(s.get('A'), 'wsB');
  assert.equal(s.get('B'), 'wsA');
});
