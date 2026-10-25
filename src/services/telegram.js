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
          text: '🚀 Mulai Build APK',
          callback_data: `confirm_${buildId}`,
          style: 'success'
        },
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
