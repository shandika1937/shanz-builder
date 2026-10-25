import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { VpsBuilderService } from '../src/services/vps.js';

test('VpsBuilderService connects to status endpoint or returns fallback object', async () => {
  const vps = new VpsBuilderService({
    host: 'http://68.183.46.92:3000',
    secret: 'shanz_builder_secret_2026'
  });

  const status = await vps.getStatus();
  assert.ok(['online', 'offline'].includes(status.status));
  assert.ok(status.worker);
  assert.equal(typeof status.queueLength, 'number');
});
