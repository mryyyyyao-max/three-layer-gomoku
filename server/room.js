import crypto from 'node:crypto';

export function newInviteToken() {
  return crypto.randomBytes(8).toString('hex');
}

export function swapSeatMap(sockets) {
  const a = sockets.get('A');
  const b = sockets.get('B');
  const next = new Map();
  if (b) next.set('A', b);
  if (a) next.set('B', a);
  return next;
}
