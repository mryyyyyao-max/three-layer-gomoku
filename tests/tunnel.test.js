import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isQuickTunnelUrl, startQuickTunnel } from '../server/tunnel.js';

test('isQuickTunnelUrl accepts only HTTPS trycloudflare hostnames', () => {
  assert.equal(isQuickTunnelUrl('https://ready-otter.trycloudflare.com'), true);
  assert.equal(isQuickTunnelUrl('http://ready-otter.trycloudflare.com'), false);
  assert.equal(isQuickTunnelUrl('https://ready-otter.trycloudflare.com.evil.test'), false);
  assert.equal(isQuickTunnelUrl('not a URL'), false);
});

test('startQuickTunnel soft-fails with a no-op stop when the download fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network blocked');
  };
  try {
    const tunnel = await startQuickTunnel({
      port: 3000,
      onUrl() {
        throw new Error('onUrl should not be called when the download fails');
      },
    });

    assert.equal(typeof tunnel.stop, 'function');
    assert.doesNotThrow(() => tunnel.stop());
  } finally {
    globalThis.fetch = originalFetch;
  }
});
