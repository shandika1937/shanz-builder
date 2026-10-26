import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createStartKeyboard,
  createRemoveKeyboard,
  createCancelKeyboard,
  createConfirmKeyboard,
  TelegramClient
} from '../src/services/telegram.js';

test('createStartKeyboard generates inline keyboard with styled buttons and contacts', () => {
  const kb = createStartKeyboard();
  assert.ok(kb.inline_keyboard);
  assert.equal(kb.inline_keyboard.length, 4);

  const zipBtn = kb.inline_keyboard[0][0];
  assert.equal(zipBtn.style, 'primary');
  assert.equal(zipBtn.callback_data, 'select_zip_engine');

  const htmlBtn = kb.inline_keyboard[0][1];
  assert.equal(htmlBtn.style, 'success');
  assert.equal(htmlBtn.callback_data, 'select_html_engine');
});

test('createRemoveKeyboard generates remove_keyboard object', () => {
  const rm = createRemoveKeyboard();
  assert.equal(rm.remove_keyboard, true);
});

test('createCancelKeyboard generates cancel button with danger style', () => {
  const kb = createCancelKeyboard('1234');
  const btn = kb.inline_keyboard[0][0];
  assert.equal(btn.style, 'danger');
  assert.equal(btn.callback_data, 'cancel_1234');
});

test('createConfirmKeyboard generates confirm and cancel buttons with styles', () => {
  const kb = createConfirmKeyboard('1234');
  assert.equal(kb.inline_keyboard[0][0].style, 'success');
  assert.equal(kb.inline_keyboard[0][0].callback_data, 'build_release_1234');
  assert.equal(kb.inline_keyboard[1][0].style, 'primary');
  assert.equal(kb.inline_keyboard[1][0].callback_data, 'build_debug_1234');
  assert.equal(kb.inline_keyboard[2][0].style, 'danger');
  assert.equal(kb.inline_keyboard[2][0].callback_data, 'cancel_1234');
});

test('TelegramClient instantiates with token', () => {
  const client = new TelegramClient('fake_token');
  assert.equal(client.token, 'fake_token');
  assert.equal(client.baseUrl, 'https://api.telegram.org/botfake_token');
});
