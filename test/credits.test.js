import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { CreditManager } from '../src/services/credits.js';

test('CreditManager provides default credits and unlimited for admins', () => {
  const testFile = path.resolve('./temp/test_credits.json');
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  const cm = new CreditManager({
    storagePath: testFile,
    defaultCredits: 3,
    adminIds: ['8594510495', '8728564869']
  });

  // Admin has Infinity
  assert.equal(cm.getCredits('8594510495'), Infinity);
  assert.equal(cm.getCredits('8728564869'), Infinity);
  assert.equal(cm.consumeCredit('8594510495').remaining, Infinity);

  // Normal user has 3 credits
  assert.equal(cm.getCredits('11223344'), 3);

  // Consume 1
  const r1 = cm.consumeCredit('11223344');
  assert.equal(r1.success, true);
  assert.equal(r1.remaining, 2);

  // Consume remaining
  cm.consumeCredit('11223344'); // 1
  cm.consumeCredit('11223344'); // 0
  const rEmpty = cm.consumeCredit('11223344'); // 0 fail
  assert.equal(rEmpty.success, false);
  assert.equal(rEmpty.remaining, 0);

  // Admin adds credits
  const updated = cm.addCredits('11223344', 5);
  assert.equal(updated, 5);
  assert.equal(cm.getCredits('11223344'), 5);

  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
});
