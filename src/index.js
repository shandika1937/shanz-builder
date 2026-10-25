import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import {
  TelegramClient,
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
      return handleZipUpload(chatId, userId, doc);
    }

    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
      return handleHtmlUpload(chatId, userId, doc);
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

  if (data.startsWith('confirm_')) {
    const buildId = data.replace('confirm_', '');
    const buildData = pendingBuilds.get(buildId);

    if (!buildData) {
      return telegram.editMessageText(
        chatId,
        messageId,
        `⚠️ Sesi build ini sudah kedaluwarsa atau telah diproses. Silakan kirim file kembali.`
      );
    }

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

async function handleZipUpload(chatId, userId, doc) {
  const statusMsg = await telegram.sendMessage(
    chatId,
    `⏳ <b>Mengunduh dan memeriksa proyek ZIP...</b>\nMohon tunggu beberapa detik.`
  );

  try {
    const fileInfo = await telegram.getFile(doc.file_id);
    const zipBuffer = await telegram.downloadFile(fileInfo.file_path);

    const inspection = await inspectZipProject(zipBuffer);

    if (!inspection.isFlutter) {
      return telegram.editMessageText(
        chatId,
        statusMsg.message_id,
        `❌ <b>Validasi Proyek Gagal</b>\n\n${inspection.reason}\n\nPastikan ZIP kamu adalah proyek Flutter lengkap.`,
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

    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `📦 <b>Proyek Flutter Terdeteksi!</b>\n\n` +
      `🏷️ <b>Nama:</b> <code>${inspection.name}</code>\n` +
      `🔢 <b>Versi:</b> <code>${inspection.version}</code>\n` +
      `📁 <b>Total File:</b> ${inspection.totalFiles}\n` +
      `⚡ <b>Engine:</b> Flutter Stable (Cloud Runner)\n\n` +
      `<i>Siap untuk mulai kompilasi APK?</i>`,
      { reply_markup: createConfirmKeyboard(buildId) }
    );
  } catch (err) {
    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `❌ <b>Gagal memproses file ZIP:</b> ${err.message}`
    );
  }
}

async function handleHtmlUpload(chatId, userId, doc) {
  const statusMsg = await telegram.sendMessage(
    chatId,
    `⏳ <b>Mengunduh dan menyiapkan paket Android WebView...</b>`
  );

  try {
    const fileInfo = await telegram.getFile(doc.file_id);
    const htmlBuffer = await telegram.downloadFile(fileInfo.file_path);

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

    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `🌐 <b>File HTML Diterima!</b>\n\n` +
      `📱 <b>Target Aplikasi:</b> Android WebView APK\n` +
      `🏷️ <b>Nama App:</b> <code>${appName}</code>\n` +
      `⚡ <b>Fitur:</b> Fullscreen, JavaScript & DOM Storage Enabled\n\n` +
      `<i>Siap untuk mulai kompilasi APK?</i>`,
      { reply_markup: createConfirmKeyboard(buildId) }
    );
  } catch (err) {
    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `❌ <b>Gagal menyiapkan file HTML:</b> ${err.message}`
    );
  }
}

async function handleRawHtmlText(chatId, userId, htmlText) {
  const statusMsg = await telegram.sendMessage(
    chatId,
    `⏳ <b>Menerima kode HTML dan menyiapkan paket WebView...</b>`
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

    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `🌐 <b>Kode HTML Diterima!</b>\n\n` +
      `📱 <b>Target Aplikasi:</b> Android WebView APK\n` +
      `🏷️ <b>Nama App:</b> <code>${appName}</code>\n\n` +
      `<i>Siap untuk mulai kompilasi APK?</i>`,
      { reply_markup: createConfirmKeyboard(buildId) }
    );
  } catch (err) {
    return telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      `❌ <b>Gagal mengemas HTML:</b> ${err.message}`
    );
  }
}

async function executeBuild(chatId, messageId, buildData) {
  const { buildId, type, appName, zipBuffer } = buildData;
  const branchName = buildId;

  await telegram.editMessageText(
    chatId,
    messageId,
    `🚀 <b>Mengirim Proyek ke Cloud Builder...</b>\n\n` +
    `⏳ Menyiapkan runner GitHub Actions untuk aplikasi <b>${appName}</b>...`,
    { reply_markup: createCancelKeyboard(buildId) }
  );

  try {
    // 1. Trigger GitHub Actions build
    await github.triggerBuild({
      branchName,
      zipBuffer,
      metadata: {
        buildId,
        type,
        appName
      }
    });

    // 2. Poll for workflow run progress
    let lastStatusText = '';
    const completedRun = await github.waitForWorkflowRun(
      branchName,
      async (info) => {
        let statusDisplay = 'Menunggu antrean runner...';
        if (info.status === 'in_progress') {
          statusDisplay = `Sedang mengompilasi APK (${info.elapsedSec}s)...`;
        }

        const newText = `⚙️ <b>Kompilasi Cloud Berjalan</b>\n\n` +
          `📱 <b>Aplikasi:</b> ${appName}\n` +
          `⚡ <b>Tipe:</b> ${type === 'flutter' ? 'Flutter Release' : 'Android WebView'}\n` +
          `⏳ <b>Status:</b> ${statusDisplay}\n\n` +
          `<i>Runner GitHub Actions sedang memproses kompilasi di background.</i>`;

        if (newText !== lastStatusText) {
          lastStatusText = newText;
          try {
            await telegram.editMessageText(chatId, messageId, newText, {
              reply_markup: createCancelKeyboard(buildId)
            });
          } catch {
            // Ignore Telegram message edit rate limits
          }
        }
      }
    );

    // 3. Handle run completion
    if (completedRun.conclusion !== 'success') {
      await github.deleteBuildBranch(branchName);
      return telegram.editMessageText(
        chatId,
        messageId,
        `❌ <b>Kompilasi Gagal!</b>\n\n` +
        `Proses kompilasi di runner GitHub Actions gagal dijalankan.\n` +
        `🔍 <a href="${completedRun.html_url}">Lihat Detail Log Error di GitHub</a>\n\n` +
        `Pastikan tidak ada kesalahan sintaks atau dependensi rusak pada kode kamu.`,
        { reply_markup: createBottomRichMenu(), disable_web_page_preview: true }
      );
    }

    // 4. Download and send APK
    await telegram.editMessageText(
      chatId,
      messageId,
      `✅ <b>Kompilasi Berhasil!</b>\n\n⏳ Mengunduh file APK dan mengirimkannya ke Telegram...`
    );

    const artifact = await github.downloadApkArtifact(completedRun.id);

    const caption = `🎉 <b>APK Berhasil Dibuat!</b>\n\n` +
      `🏷️ <b>Nama File:</b> <code>${artifact.fileName}</code>\n` +
      `📦 <b>Ukuran:</b> ${(artifact.fileSize / (1024 * 1024)).toFixed(2)} MB\n` +
      `👑 <b>Owner:</b> @ShanzRL | 🤝 <b>Co-Owner:</b> @gamersbug`;

    if (artifact.fileSize <= 50 * 1024 * 1024) {
      await telegram.sendDocument(chatId, artifact.apkBuffer, artifact.fileName, caption, {
        reply_markup: createBottomRichMenu()
      });
    } else {
      await telegram.sendMessage(
        chatId,
        `${caption}\n\n⚠️ <i>Ukuran file melebihi 50 MB (batas pengiriman bot Telegram).</i>\n` +
        `🔗 <a href="${artifact.directUrl}">Klik di sini untuk mengunduh APK langsung dari GitHub</a>`,
        { reply_markup: createBottomRichMenu() }
      );
    }

    // Clean up temporary build branch
    await github.deleteBuildBranch(branchName);
  } catch (err) {
    console.error(`Build error [${buildId}]:`, err);
    await github.deleteBuildBranch(branchName);

    return telegram.editMessageText(
      chatId,
      messageId,
      `❌ <b>Terjadi Kesalahan:</b> ${err.message}`,
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
