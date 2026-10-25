import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user, creditsInfo = null) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Dev';
  const creditText = creditsInfo === Infinity ? '♾️ VIP' : `${creditsInfo} Credit`;
  const bannerUrl = 'https://www.image2url.com/r2/default/images/1792928669194-94cc3a69-0c9c-4916-b107-7a293c2a9220.jpg';

  // Animasi Loading Ringkas & Cepat
  const loadingMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>⚡ Memuat APK Builder...</h1>` +
    `<pre>[▰▰▰▰▰▱▱▱▱▱] 50%</pre>`
  );

  await new Promise(r => setTimeout(r, 400));

  const richHtml = 
    `<img src="${bannerUrl}"/>` +
    `<h1>⚡ APK CLOUD BUILDER</h1>` +
    `<p>Halo, <b>${name}</b>! Siap mengubah proyek <b>Flutter</b> & <b>HTML</b> menjadi <b>APK</b> Android.</p>` +
    `<p>💳 <b>Saldo:</b> <code>${creditText}</code> • 🖥️ <b>Engine:</b> <code>VPS 16GB / GitHub</code></p>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">👑 @ShanzRL</tg-button>` +
    `<tg-button type="url" style="success" url="https://t.me/gamersbug">🤝 @gamersbug</tg-button>` +
    `</tg-button-row>`;

  return telegram.editRichMessage(chatId, loadingMsg.message_id, richHtml, {
    reply_markup: createStartKeyboard()
  });
}
