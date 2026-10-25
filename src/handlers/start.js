import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'Developer';
  
  const text = `✨ <b>Selamat Datang di APK Cloud Builder Bot!</b> ✨\n\n` +
    `Halo <b>${name}</b>! Saya adalah bot kompilasi cloud otomatis yang dapat mengubah proyek <b>Flutter (ZIP)</b> dan <b>HTML (Web)</b> kamu menjadi file aplikasi <b>Android (.APK)</b> siap instal.\n\n` +
    `<b>Pilihan Layanan Tersedia:</b>\n` +
    `• 📦 <code>Build ZIP to APK</code> ➔ Proyek Flutter (.zip)\n` +
    `• 🌐 <code>Build HTML to APK</code> ➔ Web WebView (.html)\n\n` +
    `<blockquote expandable><b>Informasi & Panduan:</b>\n` +
    `1. Untuk Flutter, pastikan file zip memuat <code>pubspec.yaml</code> dan folder <code>lib/</code>.\n` +
    `2. Untuk HTML, file akan otomatis disematkan ke shell Android WebView modern.\n` +
    `3. Kompilasi diproses via cloud runner GitHub Actions berkecepatan tinggi.</blockquote>\n\n` +
    `<i>Silakan pilih menu di bawah ini atau langsung kirimkan file kamu ke chat ini!</i>`;

  return telegram.sendMessage(chatId, text, {
    reply_markup: createStartKeyboard()
  });
}
