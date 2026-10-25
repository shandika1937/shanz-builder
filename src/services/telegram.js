let mtprotoClient = null;

export async function getMtprotoClient(apiId, apiHash, botToken, sessionStr = '') {
  if (mtprotoClient && mtprotoClient.connected) return mtprotoClient;
  const { TelegramClient: GramClient } = await import('telegram');
  const { StringSession } = await import('telegram/sessions/index.js');

  mtprotoClient = new GramClient(new StringSession(sessionStr || ''), Number(apiId), apiHash, {
    connectionRetries: 5
  });
  await mtprotoClient.connect();
  if (!(await mtprotoClient.checkAuthorization())) {
    await mtprotoClient.start({ botAuthToken: botToken });
  }
  return mtprotoClient;
}

export function makeProgressBar(percent) {
  const total = 10;
  const p = Math.min(100, Math.max(0, percent));
  const filled = Math.round((p / 100) * total);
  const empty = total - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export async function downloadLargeFile(apiId, apiHash, botToken, sessionStr, chatId, messageId, outputPath = null, onProgress = () => {}) {
  const client = await getMtprotoClient(apiId, apiHash, botToken, sessionStr);
  const msgs = await client.getMessages(String(chatId), { ids: [Number(messageId)] });
  if (!msgs || msgs.length === 0 || !msgs[0].media) {
    throw new Error('Pesan atau berkas media tidak ditemukan di MTProto');
  }

  let lastPercent = -1;
  let lastTime = 0;

  // Fire initial progress notification
  const totalBytes = Number(msgs[0].media.document ? msgs[0].media.document.size : 100);
  onProgress(1, totalBytes, 1);

  const downloadOpts = {
    workers: 8,
    progressCallback: (downloaded, total) => {
      const now = Date.now();
      const d = Number(downloaded);
      const t = Number(total);
      const percent = t > 0 ? Math.floor((d / t) * 100) : 0;
      if ((percent - lastPercent >= 2 && now - lastTime >= 1000) || percent === 100) {
        lastPercent = percent;
        lastTime = now;
        onProgress(d, t, percent);
      }
    }
  };

  if (outputPath) {
    downloadOpts.outputFile = outputPath;
  }

  return client.downloadMedia(msgs[0].media, downloadOpts);
}

export function createStartKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '📦 Build ZIP to APK',
          callback_data: 'mode_zip',
          style: 'primary'
        },
        {
          text: '🌐 Build HTML to APK',
          callback_data: 'mode_html',
          style: 'success'
        }
      ],
      [
        {
          text: '💳 Cek Sisa Credit',
          callback_data: 'check_credits',
          style: 'primary'
        }
      ],
      [
        {
          text: '👑 Owner: @ShanzRL',
          callback_data: 'owner_info',
          style: 'primary'
        },
        {
          text: '🤝 Co-Owner: @gamersbug',
          callback_data: 'coowner_info',
          style: 'success'
        }
      ]
    ]
  };
}

export function createBottomRichMenu() {
  return {
    keyboard: [
      [
        { text: '📦 Build ZIP to APK', style: 'primary' },
        { text: '🌐 Build HTML to APK', style: 'success' }
      ],
      [
        { text: '💳 Cek Sisa Credit', style: 'primary' }
      ],
      [
        { text: '👑 Owner: @ShanzRL', style: 'primary' },
        { text: '🤝 Co-Owner: @gamersbug', style: 'success' }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

export function createCancelKeyboard(buildId) {
  return {
    inline_keyboard: [
      [
        {
          text: '❌ Batalkan Kompilasi',
          callback_data: `cancel_${buildId}`,
          style: 'danger'
        }
      ]
    ]
  };
}

export function createConfirmKeyboard(buildId) {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 Build Release APK',
          callback_data: `build_release_${buildId}`,
          style: 'success'
        },
        {
          text: '⚡ Build Debug APK',
          callback_data: `build_debug_${buildId}`,
          style: 'primary'
        }
      ],
      [
        {
          text: '❌ Batal',
          callback_data: `cancel_${buildId}`,
          style: 'danger'
        }
      ]
    ]
  };
}

export class TelegramClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.fileBaseUrl = `https://api.telegram.org/file/bot${token}`;
  }

  async call(method, payload = {}) {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram API Error (${method}): ${data.description || 'Unknown error'}`);
    }
    return data.result;
  }

  async sendRichMessage(chatId, htmlContent, extra = {}) {
    try {
      return await this.call('sendRichMessage', {
        chat_id: chatId,
        rich_message: {
          html: htmlContent
        },
        ...extra
      });
    } catch {
      // Fallback to standard sendMessage if client doesn't support rich blocks
      return this.sendMessage(chatId, htmlContent, extra);
    }
  }

  async editRichMessage(chatId, messageId, htmlContent, extra = {}) {
    try {
      return await this.call('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        rich_message: {
          html: htmlContent
        },
        ...extra
      });
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        return null;
      }
      try {
        return await this.editMessageText(chatId, messageId, htmlContent.replace(/<[^>]+>/g, ''), extra);
      } catch {
        return null;
      }
    }
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra
    });
  }

  async editMessageText(chatId, messageId, text, extra = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...extra
    });
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  async sendChatAction(chatId, action = 'typing') {
    try {
      return await this.call('sendChatAction', {
        chat_id: chatId,
        action
      });
    } catch {
      return null;
    }
  }

  async getFile(fileId) {
    return this.call('getFile', { file_id: fileId });
  }

  async downloadFile(filePath) {
    const url = `${this.fileBaseUrl}/${filePath}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download file from Telegram: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async sendDocument(chatId, fileBuffer, fileName, caption = '', extra = {}) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const blob = new Blob([fileBuffer], { type: 'application/vnd.android.package-archive' });
    formData.append('document', blob, fileName);

    if (extra.reply_markup) {
      formData.append('reply_markup', JSON.stringify(extra.reply_markup));
    }

    const res = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram sendDocument Error: ${data.description || 'Unknown error'}`);
    }
    return data.result;
  }

  async getUpdates(offset = 0, timeout = 30) {
    return this.call('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message', 'callback_query']
    });
  }
}
