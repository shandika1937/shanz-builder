import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleStart } from '../src/handlers/start.js';

test('handleStart formats greeting and uses sendMessage with styled buttons', async () => {
  let sentPayload = null;
  const mockTelegram = {
    sendMessage: async (chatId, text, options) => {
      sentPayload = { chatId, text, options };
      return { message_id: 100 };
    }
  };

  const res = await handleStart(mockTelegram, 12345, { first_name: 'Shandika', username: 'ShanzRL', id: 12345 }, Infinity, 100);
  assert.equal(res.message_id, 100);
  assert.ok(sentPayload.text.includes('Shandika'));
  assert.ok(sentPayload.text.includes('PROFIL KAMU'));
  assert.ok(sentPayload.text.includes('STATISTIK BOT'));
  assert.ok(sentPayload.options.reply_markup.inline_keyboard);
});
