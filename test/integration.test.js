import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleStart } from '../src/handlers/start.js';

test('handleStart formats greeting and uses sendRichMessage with styled buttons', async () => {
  let sentPayload = null;
  const mockTelegram = {
    sendRichMessage: async (chatId, html, options) => {
      sentPayload = { chatId, html, options };
      return { message_id: 100 };
    },
    editRichMessage: async (chatId, messageId, html, options) => {
      sentPayload = { chatId, html, options };
      return { message_id: messageId };
    }
  };

  const res = await handleStart(mockTelegram, 12345, { first_name: 'Shanz' }, 3);
  assert.equal(res.message_id, 100);
  assert.ok(sentPayload.html.includes('Shanz'));
  assert.ok(sentPayload.html.toLowerCase().includes('apk cloud builder'));
  assert.ok(sentPayload.html.includes('table'));
  assert.ok(sentPayload.html.includes('tg-button'));
  assert.ok(sentPayload.options.reply_markup.inline_keyboard);
});
