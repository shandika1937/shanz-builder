import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { makeProgressBar } from '../src/services/telegram.js';

test('makeProgressBar generates correct bar', () => {
  assert.equal(makeProgressBar(0), '▱▱▱▱▱▱▱▱▱▱▱▱');
  assert.equal(makeProgressBar(50), '▰▰▰▰▰▰▱▱▱▱▱▱');
  assert.equal(makeProgressBar(100), '▰▰▰▰▰▰▰▰▰▰▰▰');
});
