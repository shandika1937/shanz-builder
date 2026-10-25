import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleStart } from '../src/handlers/start.js';

test('handleStart formats greeting and includes styled start keyboard', async () => {
  let sentPayload = null;
  const mockTelegram = {
    sendMessage: async (chatId, text, options) => {
      sentPayload = { chatId, text, options };
      return { message_id: 100, text };
    }
  };

  const res = await handleStart(mockTelegram, 12345, { first_name: 'Shanz' });
  assert.equal(res.message_id, 100);
  assert.ok(sentPayload.text.includes('Shanz'));
  assert.ok(sentPayload.text.includes('Build ZIP to APK'));
  assert.ok(sentPayload.options.reply_markup.inline_keyboard);

  const kb = sentPayload.options.reply_markup.inline_keyboard;
  assert.equal(kb[0][0].style, 'primary');
  assert.equal(kb[1][0].style, 'success');
  assert.equal(kb[2][0].url, 'https://t.me/ShanzRL');
  assert.equal(kb[2][1].url, 'https://t.me/gamersbug');
});
