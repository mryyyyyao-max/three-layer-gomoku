import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startQuickTunnel } from '../server/tunnel.js';

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
