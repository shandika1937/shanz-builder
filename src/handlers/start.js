import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user, creditsInfo = null) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Developer';

  const creditText = creditsInfo === Infinity ? '♾️ Unlimited (VIP/Owner)' : `${creditsInfo} Kali Build`;

  const richHtml = 
    `<h1>✨ APK Cloud Builder ✨</h1>` +
    `<p>Halo <b>${name}</b>! Selamat datang di bot kompilasi cloud otomatis untuk mengubah proyek <b>Flutter</b> & <b>HTML</b> menjadi file <b>APK Android</b> siap instal.</p>` +
    `<p>💳 <b>Sisa Kuota Credit Kamu:</b> <code>${creditText}</code></p>` +
    `<details open>` +
    `<summary><b>📋 Pilihan Layanan Tersedia:</b></summary>` +
    `<p>• 📦 <b>Build ZIP:</b> Kompilasi proyek Flutter ke Release/Debug APK</p>` +
    `<p>• 🌐 <b>Build HTML:</b> Ubah file HTML ke Android WebView APK</p>` +
    `<p>• 💳 <b>Sistem Credit:</b> Setiap pengguna mendapatkan kuota kompilasi</p>` +
    `</details>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">👑 Owner: @ShanzRL</tg-button>` +
    `<tg-button type="url" style="success" url="https://t.me/gamersbug">🤝 Co-Owner: @gamersbug</tg-button>` +
    `</tg-button-row>`;

  return telegram.sendRichMessage(chatId, richHtml, {
    reply_markup: createStartKeyboard()
  });
}
