import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import {
  TelegramClient,
  downloadLargeFile,
  makeProgressBar,
  createStartKeyboard,
  createBottomRichMenu,
  createCancelKeyboard,
  createConfirmKeyboard
} from './services/telegram.js';
import { GitHubBuilderService } from './services/github.js';
import { inspectZipProject } from './handlers/zipHandler.js';
import { packageHtmlToAndroidProject } from './handlers/htmlHandler.js';
import { handleStart } from './handlers/start.js';

const config = loadConfig();
const telegram = new TelegramClient(config.botToken);
const github = new GitHubBuilderService({
  token: config.githubToken,
  owner: config.repoOwner,
  repo: config.repoName
});

// Ensure temp directory exists
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// In-memory sessions
const userSessions = new Map();
const pendingBuilds = new Map();

console.log('🤖 Starting Shanz APK Cloud Builder Bot...');
console.log('online ready listening connected');
console.log(`📦 GitHub Target: ${config.githubRepo}`);
console.log(`👑 Owner: ${config.ownerId} (@ShanzRL)`);
console.log(`🤝 Co-Owner: ${config.coOwnerId} (@gamersbug)`);

async function sendOwnerInfo(chatId) {
  const html = 
    `<h1>👑 Informasi Owner</h1>` +
    `<p>Owner resmi dan pengembang bot ini:</p>` +
    `<p>• <b>Username:</b> <a href="https://t.me/ShanzRL">@ShanzRL</a></p>` +
    `<p>• <b>ID Telegram:</b> <code>8594510495</code></p>` +
    `<tg-button-row>` +
    `<tg-button type="url" style="primary" url="https://t.me/ShanzRL">💬 Hubungi @ShanzRL</tg-button>` +
    `</tg-button-row>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createBottomRichMenu() });
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
  return telegram.sendRichMessage(chatId, html, { reply_markup: createBottomRichMenu() });
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
  return telegram.sendRichMessage(chatId, html, { reply_markup: createBottomRichMenu() });
}

async function sendHtmlModeInfo(chatId) {
  const html = 
    `<h1>🌐 Mode Build HTML to APK</h1>` +
    `<p>Silakan kirim file <b>.html</b> kamu ke chat ini, atau tempelkan langsung kode HTML-nya di sini.</p>` +
    `<p>Bot akan membungkus kode tersebut ke dalam template Android WebView modern!</p>`;
  return telegram.sendRichMessage(chatId, html, { reply_markup: createBottomRichMenu() });
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
  const userId = String(msg.from.id);
  const text = msg.text ? msg.text.trim() : '';

  // Start / Help command
  if (text === '/start' || text === '/help') {
    userSessions.set(userId, { mode: 'idle' });
    return handleStart(telegram, chatId, msg.from);
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
      { reply_markup: createBottomRichMenu() }
    );
  }

  // If user typed raw HTML text while starting with <html> or <!DOCTYPE
  if (text.startsWith('<!DOCTYPE html') || text.startsWith('<html') || text.includes('</body>')) {
    return handleRawHtmlText(chatId, userId, text);
  }
}

async function handleCallbackQuery(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = String(query.from.id);
  const data = query.data;

  await telegram.answerCallbackQuery(query.id);

  if (data === 'mode_zip') {
    userSessions.set(userId, { mode: 'zip' });
    return sendZipModeInfo(chatId);
  }

  if (data === 'mode_html') {
    userSessions.set(userId, { mode: 'html' });
    return sendHtmlModeInfo(chatId);
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
    const buildData = pendingBuilds.get(buildId);

    if (!buildData) {
      return telegram.editMessageText(
        chatId,
        messageId,
        `⚠️ Sesi build ini sudah kedaluwarsa atau telah diproses. Silakan kirim file kembali.`
      );
    }

    buildData.buildMode = isDebug ? 'debug' : 'release';
    pendingBuilds.delete(buildId);
    return executeBuild(chatId, messageId, buildData);
  }

  if (data.startsWith('cancel_')) {
    const buildId = data.replace('cancel_', '');
    pendingBuilds.delete(buildId);
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
    `<h1>📥 Mengunduh Berkas ZIP...</h1><pre>[░░░░░░░░░░] 0% (Menghubungkan ke cloud...)</pre><p>⚡ <i>Menggunakan transmisi paralel multi-worker...</i></p>`
  );

  try {
    let zipBuffer;
    const fileSize = doc.file_size || 0;

    if (fileSize > 20 * 1024 * 1024 && config.apiId && config.apiHash) {
      zipBuffer = await downloadLargeFile(
        config.apiId,
        config.apiHash,
        config.botToken,
        chatId,
        messageId,
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
        zipBuffer = await telegram.downloadFile(fileInfo.file_path);
      } catch (err) {
        if (err.message.includes('file is too big') && config.apiId && config.apiHash) {
          zipBuffer = await downloadLargeFile(
            config.apiId,
            config.apiHash,
            config.botToken,
            chatId,
            messageId,
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

    const inspection = await inspectZipProject(zipBuffer);

    if (!inspection.isFlutter) {
      return telegram.editRichMessage(
        chatId,
        statusMsg.message_id,
        `<h1>❌ Validasi Proyek Gagal</h1><p>${inspection.reason}</p><p>Pastikan file ZIP memuat proyek Flutter dengan <code>pubspec.yaml</code> dan folder <code>lib/</code>.</p>`,
        { reply_markup: createBottomRichMenu() }
      );
    }

    const buildId = github.generateBuildId('flutter', userId);
    pendingBuilds.set(buildId, {
      buildId,
      type: 'flutter',
      userId,
      appName: inspection.name,
      version: inspection.version,
      zipBuffer
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
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Memproses File ZIP</h1><p>${err.message}</p>`,
      { reply_markup: createBottomRichMenu() }
    );
  }
}

async function handleHtmlUpload(chatId, userId, doc, messageId) {
  const statusMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>📥 Mengunduh Berkas HTML...</h1><pre>[░░░░░░░░░░] 0% (Menyiapkan template Android WebView...)</pre>`
  );

  try {
    let htmlBuffer;
    const fileSize = doc.file_size || 0;

    if (fileSize > 20 * 1024 * 1024 && config.apiId && config.apiHash) {
      htmlBuffer = await downloadLargeFile(
        config.apiId,
        config.apiHash,
        config.botToken,
        chatId,
        messageId,
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

    const buildId = github.generateBuildId('html', userId);
    pendingBuilds.set(buildId, {
      buildId,
      type: 'html',
      userId,
      appName,
      zipBuffer: projectZip
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
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Menyiapkan File HTML</h1><p>${err.message}</p>`,
      { reply_markup: createBottomRichMenu() }
    );
  }
}

async function handleRawHtmlText(chatId, userId, htmlText) {
  const statusMsg = await telegram.sendRichMessage(
    chatId,
    `<h1>🌐 Menerima Kode HTML...</h1><pre>Menyiapkan paket WebView...</pre>`
  );

  try {
    const appName = 'Web App';
    const projectZip = await packageHtmlToAndroidProject(htmlText, { appName });

    const buildId = github.generateBuildId('html', userId);
    pendingBuilds.set(buildId, {
      buildId,
      type: 'html',
      userId,
      appName,
      zipBuffer: projectZip
    });

    const confirmHtml = 
      `<h1>🌐 Kode HTML Diterima!</h1>` +
      `<table bordered compact striped>` +
      `<tr><th>Properti</th><th>Keterangan</th></tr>` +
      `<tr><td>📱 Tipe Target</td><td>Android WebView APK</td></tr>` +
      `<tr><td>🏷️ Nama App</td><td><b>${appName}</b></td></tr>` +
      `</table>` +
      `<details open><summary><b>⚙️ Target Kompilasi</b></summary><p>• Output: <b>Android Release APK (.apk)</b></p><p>• Cloud: <b>GitHub Actions Gradle Runner</b></p></details>` +
      `<tg-button-row>` +
      `<tg-button type="callback_data" style="success" data="confirm_${buildId}">🚀 Mulai Build APK</tg-button>` +
      `<tg-button type="callback_data" style="danger" data="cancel_${buildId}">❌ Batal</tg-button>` +
      `</tg-button-row>`;

    return telegram.editRichMessage(chatId, statusMsg.message_id, confirmHtml, {
      reply_markup: createConfirmKeyboard(buildId)
    });
  } catch (err) {
    return telegram.editRichMessage(
      chatId,
      statusMsg.message_id,
      `<h1>❌ Gagal Mengemas HTML</h1><p>${err.message}</p>`,
      { reply_markup: createBottomRichMenu() }
    );
  }
}

async function executeBuild(chatId, messageId, buildData) {
  const { buildId, type, appName, zipBuffer, buildMode = 'release' } = buildData;

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
      return telegram.editRichMessage(
        chatId,
        messageId,
        `<h1>❌ Kompilasi Gagal!</h1><p>Proses kompilasi di runner GitHub Actions gagal dijalankan.</p><p>🔍 <a href="${completedRun.html_url}">Lihat Detail Log Error di GitHub</a></p><p>Pastikan tidak ada kesalahan sintaks atau dependensi rusak pada kode kamu.</p>`,
        { reply_markup: createBottomRichMenu() }
      );
    }

    // 4. Download and send APK
    await telegram.editRichMessage(
      chatId,
      messageId,
      `<h1>✅ Kompilasi Berhasil!</h1><pre>[██████████] 100%</pre><p>⏳ Mengunduh file APK dan mengirimkannya ke chat kamu...</p>`
    );

    const artifact = await github.downloadApkArtifact(completedRun.id);

    const caption = `🎉 <b>APK Berhasil Dibuat!</b>\n\n` +
      `🏷️ <b>Nama File:</b> <code>${artifact.fileName}</code>\n` +
      `⚡ <b>Mode:</b> ${buildMode.toUpperCase()}\n` +
      `📦 <b>Ukuran:</b> ${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB\n` +
      `👑 <b>Owner:</b> @ShanzRL | 🤝 <b>Co-Owner:</b> @gamersbug`;

    if (artifact.fileSize <= 50 * 1024 * 1024) {
      await telegram.sendDocument(chatId, artifact.apkBuffer, artifact.fileName, caption, {
        reply_markup: createBottomRichMenu()
      });
    } else {
      await telegram.sendRichMessage(
        chatId,
        `<h1>🎉 APK Berhasil Dibuat!</h1><p>🏷️ <b>Berkas:</b> <code>${artifact.fileName}</code> (${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB)</p><p>⚡ <b>Mode:</b> ${buildMode.toUpperCase()}</p><p>⚠️ <i>Ukuran melebihi batas 50 MB bot Telegram.</i></p><tg-button-row><tg-button type="url" style="success" url="${artifact.directUrl}">📥 Unduh APK Langsung</tg-button></tg-button-row>`,
        { reply_markup: createBottomRichMenu() }
      );
    }

    await github.cleanupBuild(buildRef);
  } catch (err) {
    console.error(`Build error [${buildId}]:`, err);
    if (buildRef) await github.cleanupBuild(buildRef);

    return telegram.editRichMessage(
      chatId,
      messageId,
      `<h1>❌ Terjadi Kesalahan</h1><p>${err.message}</p>`,
      { reply_markup: createBottomRichMenu() }
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
