import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const PORT = process.env.WORKER_PORT || 3000;
const SECRET_KEY = process.env.WORKER_SECRET || 'shanz_builder_secret_2026';
const WORK_DIR = '/root/workspace_builds';

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

// Queue system
const buildQueue = [];
let isBuilding = false;
let currentBuild = null;

// Track build statuses: Map<buildId, { status, percent, message, artifactPath, error }>
const buildStatuses = new Map();

function getSystemStats() {
  return {
    isBuilding,
    queueLength: buildQueue.length,
    currentBuild: currentBuild ? {
      buildId: currentBuild.buildId,
      appName: currentBuild.appName,
      type: currentBuild.type,
      startedAt: currentBuild.startedAt
    } : null
  };
}

async function processQueue() {
  if (isBuilding || buildQueue.length === 0) return;

  isBuilding = true;
  currentBuild = buildQueue.shift();
  const { buildId, type, buildMode, appName, zipPath } = currentBuild;

  buildStatuses.set(buildId, {
    status: 'in_progress',
    percent: 10,
    message: 'Mengekstrak proyek di VPS Worker...',
    elapsedSec: 0
  });

  const projectDir = path.join(WORK_DIR, buildId);
  const startTime = Date.now();

  try {
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // 1. Unzip
    await execAsync(`unzip -q -o "${zipPath}" -d "${projectDir}"`);

    // Find actual project root (containing pubspec.yaml or settings.gradle)
    let actualRoot = projectDir;
    if (type === 'flutter') {
      const { stdout } = await execAsync(`find "${projectDir}" -maxdepth 3 -name "pubspec.yaml" -print -quit`);
      const pubPath = stdout.trim();
      if (pubPath) {
        actualRoot = path.dirname(pubPath);
      }

      // Fix Gradle wrapper if needed
      const gradleProp = path.join(actualRoot, 'android/gradle/wrapper/gradle-wrapper.properties');
      if (fs.existsSync(gradleProp)) {
        await execAsync(`sed -i 's/gradle-.*-all.zip/gradle-8.10.2-all.zip/g' "${gradleProp}" || true`);
        await execAsync(`sed -i 's/gradle-.*-bin.zip/gradle-8.10.2-bin.zip/g' "${gradleProp}" || true`);
      }
    } else {
      const { stdout } = await execAsync(`find "${projectDir}" -maxdepth 3 -name "settings.gradle" -print -quit`);
      const setPath = stdout.trim();
      if (setPath) {
        actualRoot = path.dirname(setPath);
      }
    }

    buildStatuses.set(buildId, {
      status: 'in_progress',
      percent: 30,
      message: type === 'flutter' ? 'Menjalankan flutter pub get...' : 'Menyiapkan Gradle...',
      elapsedSec: Math.floor((Date.now() - startTime) / 1000)
    });

    const env = {
      ...process.env,
      JAVA_HOME: '/usr/lib/jvm/java-17-openjdk-amd64',
      ANDROID_HOME: '/opt/android-sdk',
      ANDROID_SDK_ROOT: '/opt/android-sdk',
      PATH: `${process.env.PATH}:/opt/flutter/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools`
    };

    if (type === 'flutter') {
      await execAsync('/opt/flutter/bin/flutter pub get', { cwd: actualRoot, env });

      buildStatuses.set(buildId, {
        status: 'in_progress',
        percent: 60,
        message: `Mengompilasi APK Flutter (${buildMode.toUpperCase()})...`,
        elapsedSec: Math.floor((Date.now() - startTime) / 1000)
      });

      const commonFlags = '--android-skip-build-dependency-validation';
      const cmd = buildMode === 'debug'
        ? `/opt/flutter/bin/flutter build apk --debug ${commonFlags}`
        : `/opt/flutter/bin/flutter build apk --release ${commonFlags} || /opt/flutter/bin/flutter build apk --debug ${commonFlags}`;

      await execAsync(cmd, { cwd: actualRoot, env, timeout: 600000 });

      // Find output APK
      const { stdout: apkOut } = await execAsync(`find "${actualRoot}/build/app/outputs" -name "*.apk" | head -n 1`);
      const apkPath = apkOut.trim();

      if (!apkPath || !fs.existsSync(apkPath)) {
        throw new Error('Berkas .apk tidak ditemukan setelah proses kompilasi Flutter.');
      }

      buildStatuses.set(buildId, {
        status: 'completed',
        conclusion: 'success',
        percent: 100,
        message: 'Kompilasi APK berhasil!',
        artifactPath: apkPath,
        fileSize: fs.statSync(apkPath).size,
        fileName: path.basename(apkPath),
        elapsedSec: Math.floor((Date.now() - startTime) / 1000)
      });
    } else {
      // HTML WebView Build
      await execAsync('chmod +x ./gradlew || true', { cwd: actualRoot, env });

      buildStatuses.set(buildId, {
        status: 'in_progress',
        percent: 60,
        message: `Mengompilasi APK WebView (${buildMode.toUpperCase()})...`,
        elapsedSec: Math.floor((Date.now() - startTime) / 1000)
      });

      const gradCmd = buildMode === 'debug'
        ? './gradlew assembleDebug || gradle assembleDebug'
        : './gradlew assembleRelease || gradle assembleRelease';

      await execAsync(gradCmd, { cwd: actualRoot, env, timeout: 600000 });

      const { stdout: apkOut } = await execAsync(`find "${actualRoot}/app/build/outputs/apk" -name "*.apk" | head -n 1`);
      const apkPath = apkOut.trim();

      if (!apkPath || !fs.existsSync(apkPath)) {
        throw new Error('Berkas .apk tidak ditemukan setelah proses kompilasi Gradle.');
      }

      buildStatuses.set(buildId, {
        status: 'completed',
        conclusion: 'success',
        percent: 100,
        message: 'Kompilasi APK berhasil!',
        artifactPath: apkPath,
        fileSize: fs.statSync(apkPath).size,
        fileName: path.basename(apkPath),
        elapsedSec: Math.floor((Date.now() - startTime) / 1000)
      });
    }
  } catch (err) {
    console.error(`Build failed for ${buildId}:`, err);
    buildStatuses.set(buildId, {
      status: 'completed',
      conclusion: 'failure',
      percent: 100,
      message: `Gagal: ${err.message}`,
      error: err.message,
      elapsedSec: Math.floor((Date.now() - startTime) / 1000)
    });
  } finally {
    // Clean uploaded zip
    if (fs.existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch {}
    }
    isBuilding = false;
    currentBuild = null;
    processQueue();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health / Status Check
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      worker: 'Worker 1 (VPS DigitalOcean 16GB)',
      status: 'online',
      ...getSystemStats()
    }));
  }

  // Security Auth Check
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${SECRET_KEY}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // Submit Build: POST /build?buildId=xxx&type=flutter&buildMode=debug&appName=xxx
  if (req.method === 'POST' && url.pathname === '/build') {
    const buildId = url.searchParams.get('buildId') || Date.now().toString(36);
    const type = url.searchParams.get('type') || 'flutter';
    const buildMode = url.searchParams.get('buildMode') || 'release';
    const appName = url.searchParams.get('appName') || 'App';

    const zipPath = path.join(WORK_DIR, `${buildId}_upload.zip`);
    const fileStream = fs.createWriteStream(zipPath);

    req.pipe(fileStream);

    fileStream.on('finish', () => {
      const position = buildQueue.length + (isBuilding ? 1 : 0);
      buildQueue.push({
        buildId,
        type,
        buildMode,
        appName,
        zipPath,
        startedAt: Date.now()
      });

      buildStatuses.set(buildId, {
        status: 'queued',
        percent: 0,
        position,
        message: position > 0 ? `Dalam antrean VPS (Urutan ke-${position})...` : 'Memulai build...',
        elapsedSec: 0
      });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        buildId,
        status: 'queued',
        position,
        message: 'Build berhasil dimasukkan ke antrean VPS Worker'
      }));

      processQueue();
    });

    fileStream.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Poll status: GET /build/:buildId
  if (req.method === 'GET' && url.pathname.startsWith('/build/')) {
    const buildId = url.pathname.replace('/build/', '');
    const info = buildStatuses.get(buildId);
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Build ID tidak ditemukan' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(info));
  }

  // Download artifact: GET /artifact/:buildId
  if (req.method === 'GET' && url.pathname.startsWith('/artifact/')) {
    const buildId = url.pathname.replace('/artifact/', '');
    const info = buildStatuses.get(buildId);
    if (!info || !info.artifactPath || !fs.existsSync(info.artifactPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Artifact APK tidak ditemukan' }));
    }

    const stat = fs.statSync(info.artifactPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${info.fileName}"`
    });
    const readStream = fs.createReadStream(info.artifactPath);
    return readStream.pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 VPS APK Worker Server running on port ${PORT}`);
});
