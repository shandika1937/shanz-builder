import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';

test('loadConfig throws if required env vars are missing', () => {
  assert.throws(() => loadConfig({}));
});

test('loadConfig parses valid config', () => {
  const cfg = loadConfig({
    BOT_TOKEN: '8682345376:AAEvsKAbxyAmD2ywcedNuJU1ReBUNcgXeMI',
    OWNER_ID: '8594510495',
    CO_OWNER_ID: '8728564869',
    GITHUB_TOKEN: 'ghp_dummy',
    GITHUB_REPO: 'okegash4-dev/shanz-builder'
  });
  assert.equal(cfg.ownerId, '8594510495');
  assert.equal(cfg.coOwnerId, '8728564869');
  assert.equal(cfg.githubRepo, 'okegash4-dev/shanz-builder');
});
