import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user, creditsInfo = null) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Developer';

  const creditText = creditsInfo === Infinity ? '♾️ Unlimited (VIP/Owner)' : `${creditsInfo} Kali Build`;

  const richHtml = 
    `<h1>✨ APK CLOUD BUILDER ✨</h1>` +
    `<p>Halo <b>${name}</b>! Selamat datang di layanan bot kompilasi cloud otomatis untuk mengubah proyek source code <b>Flutter</b> & <b>HTML Web</b> menjadi file <b>APK Android</b> siap instal.</p>` +
    `<table bordered compact striped>` +
    `<tr><th>Informasi Akun</th><th>Keterangan</th></tr>` +
    `<tr><td>👤 Nama User</td><td><b>${name}</b></td></tr>` +
    `<tr><td>💳 Kuota Credit</td><td><code>${creditText}</code></td></tr>` +
    `<tr><td>⚡ Cloud Engine</td><td><b>GitHub Actions Runner</b></td></tr>` +
    `<tr><td>📱 Target OS</td><td><b>Android 5.0 - 14+</b></td></tr>` +
    `</table>` +
    `<details open>` +
    `<summary><b>📋 Petunjuk Layanan Kompilasi:</b></summary>` +
    `<p>• 📦 <b>Build ZIP:</b> Kirim file ZIP proyek Flutter kamu (otomatis mendeteksi <code>pubspec.yaml</code> & <code>lib/</code>).</p>` +
    `<p>• 🌐 <b>Build HTML:</b> Kirim file HTML untuk dijadikan aplikasi Android WebView interaktif.</p>` +
    `<p>• 💳 <b>Sistem Credit:</b> Setiap pengguna baru mendapatkan 3 credit awal gratis.</p>` +
    `</details>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">👑 Owner: @ShanzRL</tg-button>` +
    `<tg-button type="url" style="success" url="https://t.me/gamersbug">🤝 Co-Owner: @gamersbug</tg-button>` +
    `</tg-button-row>`;

  return telegram.sendRichMessage(chatId, richHtml, {
    reply_markup: createStartKeyboard()
  });
}
