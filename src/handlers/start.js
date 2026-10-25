import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user, creditsInfo = null) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Developer';

  const creditText = creditsInfo === Infinity ? '♾️ Unlimited (VIP/Owner)' : `${creditsInfo} Kali Build`;
  const bannerUrl = 'https://www.image2url.com/r2/default/images/1792928669194-94cc3a69-0c9c-4916-b107-7a293c2a9220.jpg';

  // 1. Animasi Loading Tahap 1: Inisialisasi
  const loadingMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>⏳ Menghubungkan ke Cloud Builder...</h1>` +
    `<pre>[▱▱▱▱▱▱▱▱▱▱] 15%</pre>` +
    `<p>⚡ <i>Menginisialisasi sesi & profil pengembang...</i></p>`
  );

  // 2. Animasi Loading Tahap 2: Sinkronisasi Node
  await new Promise(r => setTimeout(r, 650));
  await telegram.editRichMessage(
    chatId,
    loadingMsg.message_id,
    `<h1>⚙️ Menyinkronkan Infrastruktur Worker...</h1>` +
    `<pre>[▰▰▰▰▰▱▱▱▱▱] 55%</pre>` +
    `<p>🖥️ <i>Memeriksa kesiapan VPS Worker & Cloud Runner...</i></p>`
  ).catch(() => {});

  // 3. Animasi Loading Tahap 3: Membuka Menu
  await new Promise(r => setTimeout(r, 650));
  await telegram.editRichMessage(
    chatId,
    loadingMsg.message_id,
    `<h1>✨ Membuka Antarmuka APK Builder...</h1>` +
    `<pre>[▰▰▰▰▰▰▰▰▰▰] 100%</pre>` +
    `<p>🚀 <i>Menyiapkan modul & tabel informasi...</i></p>`
  ).catch(() => {});

  await new Promise(r => setTimeout(r, 500));

  const richHtml = 
    `<img src="${bannerUrl}"/>` +
    `<h1>✨ APK CLOUD BUILDER ✨</h1>` +
    `<p>Halo <b>${name}</b>! Selamat datang di layanan bot kompilasi cloud otomatis untuk mengubah proyek source code <b>Flutter</b> & <b>HTML Web</b> menjadi file <b>APK Android</b> siap instal.</p>` +
    `<table bordered compact striped>` +
    `<tr><th>Informasi Akun</th><th>Keterangan</th></tr>` +
    `<tr><td>👤 Nama User</td><td><b>${name}</b></td></tr>` +
    `<tr><td>💳 Kuota Credit</td><td><code>${creditText}</code></td></tr>` +
    `<tr><td>⚡ Cloud Engine</td><td><b>Dual-Engine (VPS 16GB + GitHub)</b></td></tr>` +
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

  return telegram.editRichMessage(chatId, loadingMsg.message_id, richHtml, {
    reply_markup: createStartKeyboard()
  });
}
