import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Developer';
  
  const text = `✨ <b>Selamat Datang di APK Cloud Builder Bot!</b> ✨\n\n` +
    `Halo <b>${name}</b>! Saya adalah bot kompilasi cloud otomatis yang dapat mengubah proyek <b>Flutter (ZIP)</b> dan <b>HTML (Web)</b> kamu menjadi file aplikasi <b>Android (.APK)</b> siap instal.\n\n` +
    `<b>Pilihan Layanan Tersedia:</b>\n` +
    `📦 <b>Build ZIP to APK:</b> Kirim file ZIP proyek Flutter kamu (harus berisi <code>pubspec.yaml</code> dan <code>lib/</code>).\n` +
    `🌐 <b>Build HTML to APK:</b> Kirim file <code>.html</code> kamu untuk dijadikan aplikasi Android berbasis WebView.\n\n` +
    `<i>Silakan pilih menu di bawah ini atau langsung kirimkan file kamu ke chat ini!</i>`;

  return telegram.sendMessage(chatId, text, {
    reply_markup: createStartKeyboard()
  });
}
