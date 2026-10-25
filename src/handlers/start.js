import { createStartKeyboard } from '../services/telegram.js';

export async function handleStart(telegram, chatId, user, creditsInfo = null, totalUsers = 1) {
  const name = user?.first_name ? user.first_name.replace(/[<>&"']/g, '') : 'User';
  const username = user?.username ? `@${user.username}` : 'Tidak ada username';
  const userId = user?.id || chatId;
  const role = creditsInfo === Infinity ? 'Owner / VIP' : 'Pengguna';
  const bannerUrl = 'https://www.image2url.com/r2/default/images/1792928669194-94cc3a69-0c9c-4916-b107-7a293c2a9220.jpg';

  const caption = 
    `👋 <b>HALO, ${name}!</b>\n\n` +
    `┌ 👤 <b>PROFIL KAMU</b>\n` +
    `│ • Nama: <b>${name}</b>\n` +
    `│ • Username: ${username}\n` +
    `│ • ID: <code>${userId}</code>\n` +
    `└ • Role: <b>${role}</b>\n\n` +
    `┌ 📊 <b>STATISTIK BOT</b>\n` +
    `│ • Total Pengguna : ${totalUsers}\n` +
    `│ • GitHub Actions : 🟢 Online\n` +
    `│ • VPS Worker : 🟢 Ready\n` +
    `└ • Build Engine : Ready\n\n` +
    `┌ ⚡ <b>FITUR TERSEDIA</b>\n` +
    `│ • Build APK Flutter / Android\n` +
    `│ • Build APK Dari URL / HTML Website\n` +
    `│ • Antrian Otomatis Worker\n` +
    `└ • Multi Worker VPS + GitHub Actions\n\n` +
    `<i>Pilih menu di bawah untuk memulai.\nGunakan tombol bantuan untuk mengetahui cara menggunakan bot.</i>`;

  return telegram.sendPhoto(chatId, bannerUrl, caption, {
    reply_markup: createStartKeyboard()
  });
}
