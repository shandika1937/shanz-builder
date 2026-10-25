import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import {
  TelegramClient,
  downloadLargeFile,
  makeProgressBar,
  createStartKeyboard,
  createEngineSelectionKeyboard,
  createRemoveKeyboard,
  createCancelKeyboard,
  createConfirmKeyboard
} from './services/telegram.js';
import { GitHubBuilderService } from './services/github.js';
import { VpsBuilderService } from './services/vps.js';
import { inspectZipProject } from './handlers/zipHandler.js';
import { packageHtmlToAndroidProject } from './handlers/htmlHandler.js';
import { handleStart } from './handlers/start.js';
import { CreditManager } from './services/credits.js';

const config = loadConfig();
const telegram = new TelegramClient(config.botToken);
const github = new GitHubBuilderService({
  token: config.githubToken,
  owner: config.repoOwner,
  repo: config.repoName
});

const vps = new VpsBuilderService({
  host: process.env.VPS_WORKER_URL || 'http://68.183.46.92:3000',
  secret: process.env.VPS_WORKER_SECRET || 'shanz_builder_secret_2026'
});

// Ensure temp directory exists
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

const creditManager = new CreditManager({
  storagePath: path.join(config.tempDir, 'credits.json'),
  defaultCredits: 3,
  adminIds: [config.ownerId, config.coOwnerId]
});

// Persistent sessions & build storage
const userSessions = new Map();

function savePendingBuild(buildId, data) {
  const jsonPath = path.join(config.tempDir, `${buildId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

function getPendingBuild(buildId) {
  const jsonPath = path.join(config.tempDir, `${buildId}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function deletePendingBuild(buildId) {
  const jsonPath = path.join(config.tempDir, `${buildId}.json`);
  const zipPath = path.join(config.tempDir, `${buildId}.zip`);
  if (fs.existsSync(jsonPath)) {
    try { fs.unlinkSync(jsonPath); } catch {}
  }
  if (fs.existsSync(zipPath)) {
    try { fs.unlinkSync(zipPath); } catch {}
  }
}

console.log('🤖 Starting Shanz APK Cloud Builder Bot...');
console.log('online ready listening connected');
console.log(`📦 GitHub Target: ${config.githubRepo}`);
console.log(`👑 Owner: ${config.ownerId} (@ShanzRL)`);
console.log(`🤝 Co-Owner: ${config.coOwnerId} (@gamersbug)`);

async function sendCreditsInfo(chatId, userId) {
  const credits = creditManager.getCredits(userId);
  const statusStr = credits === Infinity ? '♾️ Unlimited (Akses Owner/Admin)' : `${credits} Kali Build Tersisa`;
  const html = 
    `<h1>💳 Informasi Kuota Credit</h1>` +
    `<p>Status akun kamu saat ini:</p>` +
    `<table bordered compact striped>` +
    `<tr><th>Pengguna</th><th>Sisa Kuota</th></tr>` +
    `<tr><td>ID: <code>${userId}</code></td><td><b>${statusStr}</b></td></tr>` +
    `</table>` +
    `<details open><summary><b>Ketentuan Kuota:</b></summary>` +
    `<p>• Setiap pengguna baru otomatis mendapatkan <b>3 Credit Gratis</b>.</p>` +
    `<p>• 1 Credit digunakan setiap kali berhasil melakukan kompilasi APK.</p>` +
    `<p>• Hubungi Owner atau Co-Owner jika ingin menambah kuota.</p>` +
    `</details>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">💬 Hubungi Owner</tg-button>` +
    `</tg-button-row>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function sendWorkersStatus(chatId) {
  const vpsInfo = await vps.getStatus();
  const vpsStatusText = vpsInfo.status === 'online' ? '🟢 Online' : '🔴 Offline';
  const vpsActivity = vpsInfo.isBuilding ? `⚙️ Sedang Mengompilasi (${vpsInfo.currentBuild?.appName || 'App'})` : '💤 Idle (Siap Menerima Build)';

  const html = 
    `<h1>📊 Status Infrastruktur Worker</h1>` +
    `<p>Daftar node builder yang tersedia untuk kompilasi APK:</p>` +
    `<table bordered compact striped>` +
    `<tr><th>Node Worker</th><th>Status</th><th>Antrean</th></tr>` +
    `<tr><td>🖥️ Worker 1 (VPS DO 16GB)</td><td><b>${vpsStatusText}</b></td><td><b>${vpsInfo.queueLength} antrean</b></td></tr>` +
    `<tr><td>☁️ Worker 2 (GitHub Actions)</td><td><b>🟢 Online</b></td><td>Cloud Pool</td></tr>` +
    `</table>` +
    `<details open><summary><b>Detail Beban Worker 1:</b></summary>` +
    `<p>• Status Eksekusi: <b>${vpsActivity}</b></p>` +
    `<p>• Lokasi: <b>RexyHost Dedicated</b></p>` +
    `<p>• RAM / Spesifikasi: <b>16 GB RAM / High-Speed SSD</b></p>` +
    `</details>`;

  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function sendEngineSelection(chatId, fileType) {
  const typeName = fileType === 'zip' ? 'Flutter (ZIP)' : 'Android WebView (HTML)';
  const vpsInfo = await vps.getStatus();
  const vpsStatusBadge = vpsInfo.status === 'online' ? '🟢 ON' : '🔴 OFF';

  const html = 
    `<h1>⚙️ Pilih Jalur Kompilasi (${typeName})</h1>` +
    `<p>Silakan tentukan infrastruktur yang ingin kamu gunakan untuk mengompilasi APK:</p>` +
    `<table bordered compact striped>` +
    `<tr><th>Pilihan Jalur</th><th>Kelebihan</th><th>Ketersediaan</th></tr>` +
    `<tr><td>🖥️ <b>VPS Worker</b></td><td>Dedicated 16GB RAM, Cepat & Tanpa Batas</td><td><b>${vpsStatusBadge}</b> (${vpsInfo.queueLength} antre)</td></tr>` +
    `<tr><td>☁️ <b>GitHub Cloud</b></td><td>Multi-Runner Paralel Resmi</td><td><b>🟢 ON</b></td></tr>` +
    `</table>` +
    `<p><i>Pilih opsi di bawah untuk melanjutkan ke pengiriman berkas:</i></p>`;

  return telegram.sendRichMessage(chatId, html, {
    reply_markup: createEngineSelectionKeyboard(fileType)
  });
}

async function sendOwnerInfo(chatId) {
  const html = 
    `<h1>👑 Informasi Owner</h1>` +
    `<p>Owner resmi dan pengembang bot ini:</p>` +
    `<p>• <b>Username:</b> <a href="https://t.me/ShanzRL">@ShanzRL</a></p>` +
    `<p>• <b>ID Telegram:</b> <code>8594510495</code></p>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">💬 Hubungi @ShanzRL</tg-button>` +
    `</tg-button-row>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function sendCoOwnerInfo(chatId) {
  const html = 
    `<h1>🤝 Informasi Co-Owner</h1>` +
    `<p>Co-Owner dan mitra pengembang bot ini:</p>` +
    `<p>• <b>Username:</b> <a href="https://t.me/gamersbug">@gamersbug</a></p>` +
    `<p>• <b>ID Telegram:</b> <code>8728564869</code></p>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="success" url="https://t.me/gamersbug">💬 Hubungi @gamersbug</tg-button>` +
    `</tg-button-row>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function sendZipModeInfo(chatId) {
  const html = 
    `<h1>📦 Mode Build ZIP to APK (Flutter)</h1>` +
    `<p>Silakan kirimkan file <b>.zip</b> proyek Flutter kamu ke chat ini.</p>` +
    `<details open>` +
    `<summary><b>Syarat Berkas:</b></summary>` +
    `<p>1. Memiliki file <code>pubspec.yaml</code></p>` +
    `<p>2. Memiliki folder <code>lib/</code> dengan kode Dart</p>` +
    `</details>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function sendHtmlModeInfo(chatId) {
  const html = 
    `<h1>🌐 Mode Build HTML to APK</h1>` +
    `<p>Silakan kirim file <b>.html</b> kamu ke chat ini, atau tempelkan langsung kode HTML-nya di sini.</p>` +
    `<p>Bot akan membungkus kode tersebut ke dalam template Android WebView modern!</p>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createStartKeyboard() });
}

async function processUpdate(update) {
  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (err) {
    console.error('Error processing update:', err);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type; // 'private', 'group', 'supergroup', 'channel'
  const userId = String(msg.from.id);
  const text = msg.text ? msg.text.trim() : '';

  // Hapus keyboard menu secara permanen jika pesan berasal dari grup/supergroup
  if (chatType !== 'private') {
    return telegram.sendMessage(
      chatId,
      `⚠️ <b>Bot Ini Hanya Bisa Digunakan di Chat Pribadi (PM)!</b>\n\nKeyboard di grup ini telah dibersihkan. Silakan gunakan bot langsung di PM.`,
      {
        reply_markup: {
          remove_keyboard: true,
          selective: false
        }
      }
    ).catch(() => {});
  }

  // Mode Publik: Semua pengguna Telegram dapat mengakses dan mengompilasi APK!
  // Owner & Co-Owner terdaftar untuk identitas dan hak admin.

  // Admin commands: /addcredit <userId> <amount> or /setcredit <userId> <amount>
  if (text.startsWith('/addcredit') || text.startsWith('/addcredits')) {
    if (!creditManager.isAdmin(userId)) {
      return telegram.sendMessage(chatId, '🚫 Perintah ini khusus untuk Owner dan Co-Owner.');
    }
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      return telegram.sendMessage(chatId, '💡 <b>Format Penggunaan:</b>\n<code>/addcredit &lt;target_user_id&gt; &lt;jumlah&gt;</code>\n\nContoh:\n<code>/addcredit 123456789 5</code>');
    }
    const targetId = parts[1];
    const amount = Number(parts[2]);
    try {
      const newTotal = creditManager.addCredits(targetId, amount);
      return telegram.sendRichMessage(
        chatId,
        `<h1>✅ Credit Berhasil Ditambahkan!</h1><p>• <b>Target ID:</b> <code>${targetId}</code></p><p>• <b>Jumlah Ditambahkan:</b> +${amount}</p><p>• <b>Total Sekarang:</b> <b>${newTotal} Credit</b></p>`
      );
    } catch (err) {
      return telegram.sendMessage(chatId, `❌ Gagal: ${err.message}`);
    }
  }

  if (text.startsWith('/setcredit') || text.startsWith('/setcredits')) {
    if (!creditManager.isAdmin(userId)) {
      return telegram.sendMessage(chatId, '🚫 Perintah ini khusus untuk Owner dan Co-Owner.');
    }
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      return telegram.sendMessage(chatId, '💡 <b>Format Penggunaan:</b>\n<code>/setcredit &lt;target_user_id&gt; &lt;jumlah&gt;</code>\n\nContoh:\n<code>/setcredit 123456789 10</code>');
    }
    const targetId = parts[1];
    const amount = Number(parts[2]);
    try {
      const newTotal = creditManager.setCredits(targetId, amount);
      return telegram.sendRichMessage(
        chatId,
        `<h1>✅ Credit Berhasil Ditetapkan!</h1><p>• <b>Target ID:</b> <code>${targetId}</code></p><p>• <b>Total Credit Baru:</b> <b>${newTotal} Credit</b></p>`
      );
    } catch (err) {
      return telegram.sendMessage(chatId, `❌ Gagal: ${err.message}`);
    }
  }

  // Start / Help command
  if (text === '/start' || text === '/help') {
    userSessions.set(userId, { mode: 'idle' });
    const userCredits = creditManager.getCredits(userId);
    // Hapus keyboard reply lama jika masih ada
    await telegram.sendMessage(chatId, '✨ Membuka menu APK Builder...', { reply_markup: createRemoveKeyboard() }).catch(() => {});
    return handleStart(telegram, chatId, msg.from, userCredits);
  }

  // Handle Bottom Keyboard (Rich Menu) actions
  if (text === '📦 Build ZIP to APK') {
    userSessions.set(userId, { mode: 'zip' });
    return sendZipModeInfo(chatId);
  }

  if (text === '🌐 Build HTML to APK') {
    userSessions.set(userId, { mode: 'html' });
    return sendHtmlModeInfo(chatId);
  }

  if (text === '💳 Cek Sisa Credit' || text === '/credit' || text === '/credits') {
    return sendCreditsInfo(chatId, userId);
  }

  if (text.includes('Owner: @ShanzRL') || text === '/owner') {
    return sendOwnerInfo(chatId);
  }

  if (text.includes('Co-Owner: @gamersbug') || text === '/coowner') {
    return sendCoOwnerInfo(chatId);
  }

  // Check document upload
  if (msg.document) {
    const doc = msg.document;
    const fileName = doc.file_name || 'unknown_file';
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      return handleZipUpload(chatId, userId, doc, msg.message_id);
    }

    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
      return handleHtmlUpload(chatId, userId, doc, msg.message_id);
    }

    return telegram.sendMessage(
      chatId,
      `⚠️ <b>Format File Tidak Didukung</b>\n\nMohon kirimkan file berekstensi <b>.zip</b> (proyek Flutter) atau <b>.html</b> (web).`,
      { reply_markup: createStartKeyboard() }
    );
  }

  // If user typed raw HTML text while starting with <html> or <!DOCTYPE
  if (text.startsWith('<!DOCTYPE html') || text.startsWith('<html') || text.includes('</body>')) {
    return handleRawHtmlText(chatId, userId, text);
  }
}

async function handleCallbackQuery(query) {
  const chatId = query.message.chat.id;
  const chatType = query.message.chat.type;
  const messageId = query.message.message_id;
  const userId = String(query.from.id);
  const data = query.data;

  if (chatType !== 'private') {
    return telegram.answerCallbackQuery(query.id, '⚠️ Fitur ini hanya dapat digunakan di PM (Private Chat).', true);
  }

  await telegram.answerCallbackQuery(query.id);

  if (data === 'select_zip_engine') {
    return sendEngineSelection(chatId, 'zip');
  }

  if (data === 'select_html_engine') {
    return sendEngineSelection(chatId, 'html');
  }

  if (data === 'check_workers') {
    return sendWorkersStatus(chatId);
  }

  if (data.startsWith('engine_vps_')) {
    const fileType = data.replace('engine_vps_', '');
    userSessions.set(userId, { mode: fileType, engine: 'vps' });
    const vpsInfo = await vps.getStatus();
    const queueNote = vpsInfo.queueLength > 0 ? `\n\n⏳ <i>Saat ini ada <b>${vpsInfo.queueLength} antrean</b> di worker ini.</i>` : '';
    return telegram.sendRichMessage(
      chatId,
      `<h1>🖥️ Jalur VPS Worker 1 Dipilih!</h1>` +
      `<p>Status Node: <b>${vpsInfo.status === 'online' ? '🟢 Online (Dedicated 16GB)' : '🔴 Offline'}</b>${queueNote}</p>` +
      `<p>Silakan kirimkan berkas <b>${fileType === 'zip' ? '.zip Flutter' : '.html'}</b> kamu sekarang.</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }

  if (data.startsWith('engine_github_')) {
    const fileType = data.replace('engine_github_', '');
    userSessions.set(userId, { mode: fileType, engine: 'github' });
    return telegram.sendRichMessage(
      chatId,
      `<h1>☁️ Jalur GitHub Actions Dipilih!</h1>` +
      `<p>Status Node: <b>🟢 Online (Multi-Runner Cloud)</b></p>` +
      `<p>Silakan kirimkan berkas <b>${fileType === 'zip' ? '.zip Flutter' : '.html'}</b> kamu sekarang.</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }

  if (data === 'mode_zip') {
    return sendEngineSelection(chatId, 'zip');
  }

  if (data === 'mode_html') {
    return sendEngineSelection(chatId, 'html');
  }

  if (data === 'check_credits') {
    return sendCreditsInfo(chatId, userId);
  }

  if (data === 'owner_info') {
    return sendOwnerInfo(chatId);
  }

  if (data === 'coowner_info') {
    return sendCoOwnerInfo(chatId);
  }

  if (data.startsWith('build_release_') || data.startsWith('build_debug_') || data.startsWith('confirm_')) {
    const isDebug = data.startsWith('build_debug_');
    const buildId = data.replace('build_debug_', '').replace('build_release_', '').replace('confirm_', '');
    const buildData = getPendingBuild(buildId);

    if (!buildData) {
      return telegram.editMessageText(
        chatId,
        messageId,
        `⚠️ Sesi build ini sudah kedaluwarsa atau telah diproses. Silakan kirim file kembali.`
      );
    }

    const availableCredits = creditManager.getCredits(userId);
    if (availableCredits <= 0) {
      return telegram.sendRichMessage(
        chatId,
        `<h1>🚫 Kuota Credit Habis!</h1>` +
        `<p>Mohon maaf, sisa credit kamu <b>0</b>. Setiap akun mendapatkan 3 credit awal gratis.</p>` +
        `<p>Silakan hubungi Owner atau Co-Owner untuk isi ulang kuota.</p>` +
        `<tg-button-row>` +
        `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">💬 Hubungi Owner</tg-button>` +
        `</tg-button-row>`,
        { reply_markup: createStartKeyboard() }
      );
    }

    buildData.buildMode = isDebug ? 'debug' : 'release';
    return executeBuild(chatId, messageId, buildData);
  }

  if (data.startsWith('cancel_')) {
    const buildId = data.replace('cancel_', '');
    deletePendingBuild(buildId);
    return telegram.editMessageText(
      chatId,
      messageId,
      `❌ <b>Proses Kompilasi Dibatalkan.</b>\n\nKamu dapat mengirim file baru kapan saja.`
    );
  }
}

async function handleZipUpload(chatId, userId, doc, messageId) {
  const statusMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>📥 Mengunduh Berkas ZIP...</h1><pre>[▱▱▱▱▱▱▱▱▱▱▱▱] 0% (Menghubungkan ke cloud...)</pre><p>⚡ <i>Menggunakan transmisi paralel multi-worker...</i></p>`
  );

  const buildId = github.generateBuildId('flutter', userId);
  const zipPath = path.join(config.tempDir, `${buildId}.zip`);

  try {
    const fileSize = doc.file_size || 0;

    if (fileSize > 20 * 1024 * 1024 && config.apiId && config.apiHash) {
      await downloadLargeFile(
        config.apiId,
        config.apiHash,
        config.botToken,
        config.mtprotoSession,
        chatId,
        messageId,
        zipPath,
        (d, t, pct) => {
          const bar = makeProgressBar(pct);
          const dMb = (d / (1024 * 1024)).toFixed(1);
          const tMb = (t / (1024 * 1024)).toFixed(1);
          const html = `<h1>📥 Mengunduh Proyek ZIP...</h1><pre>[${bar}] ${pct}% (${dMb} MB / ${tMb} MB)</pre><p>⚡ <i>Mengunduh langsung via Telegram MTProto Cloud...</i></p>`;
          telegram.editRichMessage(chatId, statusMsg.message_id, html).catch(() => {});
        }
      );
    } else {
      try {
        const fileInfo = await telegram.getFile(doc.file_id);
        const buf = await telegram.downloadFile(fileInfo.file_path);
        fs.writeFileSync(zipPath, buf);
      } catch (err) {
        if (err.message.includes('file is too big') && config.apiId && config.apiHash) {
          await downloadLargeFile(
            config.apiId,
            config.apiHash,
            config.botToken,
            config.mtprotoSession,
            chatId,
            messageId,
            zipPath,
            (d, t, pct) => {
              const bar = makeProgressBar(pct);
              const dMb = (d / (1024 * 1024)).toFixed(1);
              const tMb = (t / (1024 * 1024)).toFixed(1);
              const html = `<h1>📥 Mengunduh Proyek ZIP...</h1><pre>[${bar}] ${pct}% (${dMb} MB / ${tMb} MB)</pre><p>⚡ <i>Mengunduh langsung via Telegram MTProto Cloud...</i></p>`;
              telegram.editRichMessage(chatId, statusMsg.message_id, html).catch(() => {});
            }
          );
        } else {
          throw err;
        }
      }
    }

    await telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>🔍 Memeriksa Proyek Flutter...</h1><pre>[▰▰▰▰▰▰▰▰▰▰▰▰] 100% (Memvalidasi struktur proyek...)</pre>`
    ).catch(() => {});

    const inspection = await inspectZipProject(zipPath);

    if (!inspection.isFlutter) {
      deletePendingBuild(buildId);
      return telegram.editRichMessage(
        chatId,
        statusMsg.message_id,
        `<h1>❌ Validasi Proyek Gagal</h1><p>${inspection.reason}</p><p>Pastikan file ZIP memuat proyek Flutter dengan <code>pubspec.yaml</code> dan folder <code>lib/</code>.</p>`,
        { reply_markup: createStartKeyboard() }
      );
    }

    const userSession = userSessions.get(userId) || {};
    const selectedEngine = userSession.engine || 'vps'; // Default to VPS jika belum memilih

    savePendingBuild(buildId, {
      buildId,
      type: 'flutter',
      userId,
      engine: selectedEngine,
      appName: inspection.name,
      version: inspection.version,
      zipPath
    });

    const confirmHtml = 
      `<h1>📦 Proyek Flutter Terdeteksi!</h1>` +
      `<table bordered compact striped>` +
      `<tr><th>Properti</th><th>Keterangan</th></tr>` +
      `<tr><td>🏷️ Nama App</td><td><b>${inspection.name}</b></td></tr>` +
      `<tr><td>🔢 Versi</td><td><code>${inspection.version}</code></td></tr>` +
      `<tr><td>📁 Total Berkas</td><td>${inspection.totalFiles} berkas</td></tr>` +
      `<tr><td>📦 Ukuran</td><td>${(fileSize / (1024 * 1024)).toFixed(1)} MB</td></tr>` +
      `</table>` +
      `<details open><summary><b>⚙️ Pilih Mode Kompilasi:</b></summary>` +
      `<p>• <b>🚀 Release APK:</b> Teroptimasi, ukuran lebih kecil, siap rilis.</p>` +
      `<p>• <b>⚡ Debug APK:</b> Kompilasi jauh lebih cepat, cocok untuk testing.</p>` +
      `</details>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="success" data="build_release_${buildId}">🚀 Build Release APK</tg-button>` +
      `<tg-button type="callback_data" style="primary" data="build_debug_${buildId}">⚡ Build Debug APK</tg-button>` +
      `</tg-button-row>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batal</tg-button>` +
      `</tg-button-row>`;

    return telegram.editRichMessage(chatId, statusMsg.message_id, confirmHtml, {
      reply_markup: createConfirmKeyboard(buildId)
    });
  } catch (err) {
    deletePendingBuild(buildId);
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Memproses File ZIP</h1><p>${err.message}</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }
}

async function handleHtmlUpload(chatId, userId, doc, messageId) {
  const statusMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>📥 Mengunduh Berkas HTML...</h1><pre>[░░░░░░░░░░] 0% (Menyiapkan template Android WebView...)</pre>`
  );

  const buildId = github.generateBuildId('html', userId);
  const zipPath = path.join(config.tempDir, `${buildId}.zip`);

  try {
    let htmlBuffer;
    const fileSize = doc.file_size || 0;

    if (fileSize > 20 * 1024 * 1024 && config.apiId && config.apiHash) {
      htmlBuffer = await downloadLargeFile(
        config.apiId,
        config.apiHash,
        config.botToken,
        config.mtprotoSession,
        chatId,
        messageId,
        null,
        (d, t, pct) => {
          const bar = makeProgressBar(pct);
          const html = `<h1>📥 Mengunduh Berkas HTML...</h1><pre>[${bar}] ${pct}%</pre>`;
          telegram.editRichMessage(chatId, statusMsg.message_id, html).catch(() => {});
        }
      );
    } else {
      try {
        const fileInfo = await telegram.getFile(doc.file_id);
        htmlBuffer = await telegram.downloadFile(fileInfo.file_path);
      } catch (err) {
        if (err.message.includes('file is too big') && config.apiId && config.apiHash) {
          htmlBuffer = await downloadLargeFile(
            config.apiId,
            config.apiHash,
            config.botToken,
            config.mtprotoSession,
            chatId,
            messageId
          );
        } else {
          throw err;
        }
      }
    }

    const appName = doc.file_name.replace(/\.[^/.]+$/, '') || 'WebToApk App';
    const projectZip = await packageHtmlToAndroidProject(htmlBuffer, { appName });
    fs.writeFileSync(zipPath, projectZip);

    const userSession = userSessions.get(userId) || {};
    const selectedEngine = userSession.engine || 'vps';

    savePendingBuild(buildId, {
      buildId,
      type: 'html',
      userId,
      engine: selectedEngine,
      appName,
      zipPath
    });

    const confirmHtml = 
      `<h1>🌐 Berkas HTML Diterima!</h1>` +
      `<table bordered compact striped>` +
      `<tr><th>Properti</th><th>Keterangan</th></tr>` +
      `<tr><td>📱 Tipe Target</td><td>Android WebView APK</td></tr>` +
      `<tr><td>🏷️ Nama App</td><td><b>${appName}</b></td></tr>` +
      `<tr><td>⚡ Fitur</td><td>Fullscreen, JavaScript & DOM Storage</td></tr>` +
      `</table>` +
      `<details open><summary><b>⚙️ Pilih Mode Kompilasi:</b></summary>` +
      `<p>• <b>🚀 Release APK:</b> Teroptimasi untuk rilis/instalasi final.</p>` +
      `<p>• <b>⚡ Debug APK:</b> Kompilasi cepat langsung dari template Gradle.</p>` +
      `</details>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="success" data="build_release_${buildId}">🚀 Build Release APK</tg-button>` +
      `<tg-button type="callback_data" style="primary" data="build_debug_${buildId}">⚡ Build Debug APK</tg-button>` +
      `</tg-button-row>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batal</tg-button>` +
      `</tg-button-row>`;

    return telegram.editRichMessage(chatId, statusMsg.message_id, confirmHtml, {
      reply_markup: createConfirmKeyboard(buildId)
    });
  } catch (err) {
    deletePendingBuild(buildId);
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Menyiapkan File HTML</h1><p>${err.message}</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }
}

async function handleRawHtmlText(chatId, userId, htmlText) {
  const statusMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>🌐 Menerima Kode HTML...</h1><pre>Menyiapkan paket WebView...</pre>`
  );

  const buildId = github.generateBuildId('html', userId);
  const zipPath = path.join(config.tempDir, `${buildId}.zip`);

  try {
    const appName = 'Web App';
    const projectZip = await packageHtmlToAndroidProject(htmlText, { appName });
    fs.writeFileSync(zipPath, projectZip);

    savePendingBuild(buildId, {
      buildId,
      type: 'html',
      userId,
      appName,
      zipPath
    });

    const confirmHtml = 
      `<h1>🌐 Kode HTML Diterima!</h1>` +
      `<table bordered compact striped>` +
      `<tr><th>Properti</th><th>Keterangan</th></tr>` +
      `<tr><td>📱 Tipe Target</td><td>Android WebView APK</td></tr>` +
      `<tr><td>🏷️ Nama App</td><td><b>${appName}</b></td></tr>` +
      `</table>` +
      `<details open><summary><b>⚙️ Pilih Mode Kompilasi:</b></summary>` +
      `<p>• <b>🚀 Release APK:</b> Teroptimasi untuk rilis/instalasi final.</p>` +
      `<p>• <b>⚡ Debug APK:</b> Kompilasi cepat langsung dari template Gradle.</p>` +
      `</details>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="success" data="build_release_${buildId}">🚀 Build Release APK</tg-button>` +
      `<tg-button type="callback_data" style="primary" data="build_debug_${buildId}">⚡ Build Debug APK</tg-button>` +
      `</tg-button-row>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batal</tg-button>` +
      `</tg-button-row>`;

    return telegram.editRichMessage(chatId, statusMsg.message_id, confirmHtml, {
      reply_markup: createConfirmKeyboard(buildId)
    });
  } catch (err) {
    deletePendingBuild(buildId);
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Mengemas HTML</h1><p>${err.message}</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }
}

async function executeBuild(chatId, messageId, buildData) {
  const { buildId, type, appName, zipPath, buildMode = 'release', engine = 'vps' } = buildData;
  const zipBuffer = fs.readFileSync(zipPath);

  // Jika jalur yang dipilih adalah VPS Builder
  if (engine === 'vps') {
    return executeBuildVps(chatId, messageId, { buildId, type, appName, zipPath, zipBuffer, buildMode });
  }

  // Jika jalur yang dipilih adalah GitHub Actions
  return executeBuildGitHub(chatId, messageId, { buildId, type, appName, zipPath, zipBuffer, buildMode });
}

async function executeBuildVps(chatId, messageId, buildData) {
  const { buildId, type, appName, zipBuffer, buildMode } = buildData;

  const initialHtml = 
    `<h1>🚀 Menyiapkan Antrean VPS Worker 1...</h1>` +
    `<p>Aplikasi: <b>${appName}</b> (Worker: <b>VPS DO 16GB</b> • <b>${buildMode.toUpperCase()}</b>)</p>` +
    `<pre>[▱▱▱▱▱▱▱▱▱▱▱▱] 0% (Mengirimkan payload ke VPS Builder...)</pre>` +
    `<tg-button-row><tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batalkan</tg-button></tg-button-row>`;

  await telegram.editRichMessage(chatId, messageId, initialHtml, {
    reply_markup: createCancelKeyboard(buildId)
  });

  try {
    // 1. Submit to VPS Worker Server
    const submitRes = await vps.submitBuild({
      buildId,
      type,
      buildMode,
      appName,
      zipBuffer
    });

    // 2. Poll VPS status with live queue position & progress bar
    let lastStatusText = '';
    const pollInterval = setInterval(async () => {
      try {
        const info = await vps.pollBuildStatus(buildId);
        const bar = makeProgressBar(info.percent || 10);
        const statusNote = info.status === 'queued'
          ? `⏳ Dalam Antrean (Urutan ke-${info.position})`
          : `⚙️ Sedang Mengompilasi (${info.elapsedSec || 0}s)`;

        const progressHtml = 
          `<h1>🖥️ Kompilasi VPS Worker 1 Berjalan...</h1>` +
          `<p>Aplikasi: <b>${appName}</b> (${type === 'flutter' ? 'Flutter' : 'WebView'} • <b>${buildMode.toUpperCase()}</b>)</p>` +
          `<pre>[${bar}] ${info.percent || 10}% (${info.elapsedSec || 0}s)</pre>` +
          `<details open><summary><b>Status Mesin:</b></summary>` +
          `<p>• Status: <b>${statusNote}</b></p>` +
          `<p>• Detail: <i>${info.message || 'Memproses berkas...'}</i></p>` +
          `<p>• Node: <b>RexyHost Dedicated (16GB RAM)</b></p>` +
          `</details>` +
          `<tg-button-row><tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batalkan</tg-button></tg-button-row>`;

        if (progressHtml !== lastStatusText) {
          lastStatusText = progressHtml;
          telegram.editRichMessage(chatId, messageId, progressHtml, {
            reply_markup: createCancelKeyboard(buildId)
          }).catch(() => {});
        }

        if (info.status === 'completed') {
          clearInterval(pollInterval);

          if (info.conclusion !== 'success') {
            deletePendingBuild(buildId);
            return telegram.editRichMessage(
              chatId,
              messageId,
              `<h1>❌ Kompilasi di VPS Gagal!</h1><p>Kompilasi di VPS Worker menemui kendala:</p><pre>${info.error || info.message}</pre>`,
              { reply_markup: createStartKeyboard() }
            );
          }

          // Success - Download APK directly from VPS
          await telegram.editRichMessage(
            chatId,
            messageId,
            `<h1>✅ Kompilasi Selesai!</h1><pre>[▰▰▰▰▰▰▰▰▰▰▰▰] 100%</pre><p>⏳ Mengambil file APK dari VPS dan mengirimkannya...</p>`
          );

          const artifact = await vps.downloadArtifact(buildId);
          const consumed = creditManager.consumeCredit(buildData.userId);
          const sisaText = consumed.remaining === Infinity ? '♾️ Unlimited' : `${consumed.remaining} Credit`;

          const caption = `🎉 <b>APK Berhasil Dibuat via VPS Worker!</b>\n\n` +
            `🏷️ <b>Nama File:</b> <code>${artifact.fileName}</code>\n` +
            `🖥️ <b>Worker:</b> VPS RexyHost (16GB RAM)\n` +
            `⚡ <b>Mode:</b> ${buildMode.toUpperCase()}\n` +
            `📦 <b>Ukuran:</b> ${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB\n` +
            `💳 <b>Sisa Credit:</b> <code>${sisaText}</code>\n\n` +
            `👑 <b>Owner:</b> @ShanzRL | 🤝 <b>Co-Owner:</b> @gamersbug`;

          if (artifact.fileSize <= 50 * 1024 * 1024) {
            await telegram.sendDocument(chatId, artifact.apkBuffer, artifact.fileName, caption, {
              reply_markup: createStartKeyboard()
            });
          } else {
            await telegram.sendRichMessage(
              chatId,
              `<h1>🎉 APK Berhasil Dibuat!</h1><p>🏷️ <b>Berkas:</b> <code>${artifact.fileName}</code> (${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB)</p><p>⚡ <b>Mode:</b> ${buildMode.toUpperCase()}</p><p>⚠️ <i>Ukuran melebihi batas 50 MB bot Telegram.</i></p><tg-button-row><tg-button type="url" style="success" url="${artifact.directUrl}">📥 Unduh APK Langsung</tg-button></tg-button-row>`,
              { reply_markup: createStartKeyboard() }
            );
          }

          deletePendingBuild(buildId);
        }
      } catch (err) {
        clearInterval(pollInterval);
        console.error('VPS Poll Error:', err);
      }
    }, 4000);

  } catch (err) {
    deletePendingBuild(buildId);
    return telegram.editRichMessage(
      chatId,
      messageId,
      `<h1>❌ Gagal Mengirim Proyek ke VPS Worker</h1><p>${err.message}</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }
}

async function executeBuildGitHub(chatId, messageId, buildData) {
  const { buildId, type, appName, zipBuffer, buildMode } = buildData;

  const initialHtml = 
    `<h1>🚀 Menyiapkan Kompilasi Cloud...</h1>` +
    `<p>Aplikasi: <b>${appName}</b> (Mode: <b>${buildMode.toUpperCase()}</b>)</p>` +
    `<pre>[░░░░░░░░░░] 0% (Menyiapkan runner GitHub Actions...)</pre>` +
    `<tg-button-row><tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batalkan Kompilasi</tg-button></tg-button-row>`;

  await telegram.editRichMessage(chatId, messageId, initialHtml, {
    reply_markup: createCancelKeyboard(buildId)
  });

  let buildRef = null;

  try {
    // 1. Upload release asset and trigger GitHub Actions build
    buildRef = await github.triggerBuild({
      buildId,
      type,
      buildMode,
      appName,
      zipBuffer
    });

    // 2. Poll for workflow run progress
    let lastStatusText = '';
    const completedRun = await github.waitForWorkflowRun(
      { releaseTag: buildRef.releaseTag, type },
      async (info) => {
        let estPercent = 10;
        let statusDisplay = 'Menunggu antrean runner...';
        if (info.status === 'in_progress') {
          statusDisplay = `Kompilasi APK sedang berjalan (${info.elapsedSec}s)`;
          estPercent = Math.min(95, 20 + Math.floor((info.elapsedSec / 100) * 75));
        }
        const bar = makeProgressBar(estPercent);

        const progressHtml = 
          `<h1>⚙️ Kompilasi Cloud Berjalan...</h1>` +
          `<p>Aplikasi: <b>${appName}</b> (${type === 'flutter' ? 'Flutter' : 'Android WebView'} • <b>${buildMode.toUpperCase()}</b>)</p>` +
          `<pre>[${bar}] ${estPercent}% (${info.elapsedSec}s)</pre>` +
          `<details open><summary><b>Status Runner</b></summary><p>• Status: <code>${statusDisplay}</code></p><p>• Engine: <b>GitHub Actions Cloud</b></p></details>` +
          `<tg-button-row><tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batalkan</tg-button></tg-button-row>`;

        if (progressHtml !== lastStatusText) {
          lastStatusText = progressHtml;
          try {
            await telegram.editRichMessage(chatId, messageId, progressHtml, {
              reply_markup: createCancelKeyboard(buildId)
            });
          } catch {}
        }
      }
    );

    // 3. Handle run completion
    if (completedRun.conclusion !== 'success') {
      await github.cleanupBuild(buildRef);
      deletePendingBuild(buildId);
      return telegram.editRichMessage(
        chatId,
        messageId,
        `<h1>❌ Kompilasi Gagal!</h1><p>Proses kompilasi di runner GitHub Actions gagal dijalankan.</p><p>🔍 <a href="${completedRun.html_url}">Lihat Detail Log Error di GitHub</a></p><p>Pastikan tidak ada kesalahan sintaks atau dependensi rusak pada kode kamu.</p>`,
        { reply_markup: createStartKeyboard() }
      );
    }

    // 4. Download and send APK
    await telegram.editRichMessage(
      chatId,
      messageId,
      `<h1>✅ Kompilasi Berhasil!</h1><pre>[▰▰▰▰▰▰▰▰▰▰▰▰] 100%</pre><p>⏳ Mengunduh file APK dan mengirimkannya ke chat kamu...</p>`
    );

    const artifact = await github.downloadApkArtifact(completedRun.id);

    // Potong 1 credit hanya setelah build sukses terkirim
    const consumed = creditManager.consumeCredit(buildData.userId);
    const sisaText = consumed.remaining === Infinity ? '♾️ Unlimited' : `${consumed.remaining} Credit`;

    const caption = `🎉 <b>APK Berhasil Dibuat!</b>\n\n` +
      `🏷️ <b>Nama File:</b> <code>${artifact.fileName}</code>\n` +
      `⚡ <b>Mode:</b> ${buildMode.toUpperCase()}\n` +
      `📦 <b>Ukuran:</b> ${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB\n` +
      `💳 <b>Sisa Credit:</b> <code>${sisaText}</code>\n\n` +
      `👑 <b>Owner:</b> @ShanzRL | 🤝 <b>Co-Owner:</b> @gamersbug`;

    if (artifact.fileSize <= 50 * 1024 * 1024) {
      await telegram.sendDocument(chatId, artifact.apkBuffer, artifact.fileName, caption, {
        reply_markup: createStartKeyboard()
      });
    } else {
      await telegram.sendRichMessage(
        chatId,
        `<h1>🎉 APK Berhasil Dibuat!</h1><p>🏷️ <b>Berkas:</b> <code>${artifact.fileName}</code> (${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB)</p><p>⚡ <b>Mode:</b> ${buildMode.toUpperCase()}</p><p>⚠️ <i>Ukuran melebihi batas 50 MB bot Telegram.</i></p><tg-button-row><tg-button type="url" style="success" url="${artifact.directUrl}">📥 Unduh APK Langsung</tg-button></tg-button-row>`,
        { reply_markup: createStartKeyboard() }
      );
    }

    await github.cleanupBuild(buildRef);
    deletePendingBuild(buildId);
  } catch (err) {
    console.error(`Build error [${buildId}]:`, err);
    if (buildRef) await github.cleanupBuild(buildRef);
    deletePendingBuild(buildId);

    return telegram.editRichMessage(
      chatId,
      messageId,
      `<h1>❌ Terjadi Kesalahan</h1><p>${err.message}</p>`,
      { reply_markup: createStartKeyboard() }
    );
  }
}

// Long Polling Loop
let isRunning = true;
let updateOffset = 0;

async function startPolling() {
  while (isRunning) {
    try {
      const updates = await telegram.getUpdates(updateOffset, 25);
      for (const update of updates) {
        updateOffset = Math.max(updateOffset, update.update_id + 1);
        await processUpdate(update);
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down bot...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down bot...');
  isRunning = false;
  process.exit(0);
});

startPolling();
