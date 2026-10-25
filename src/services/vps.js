import fs from 'node:fs';

export class VpsBuilderService {
  constructor({ host = 'http://68.183.46.92:3000', secret = 'shanz_builder_secret_2026' } = {}) {
    this.host = host.replace(/\/$/, '');
    this.secret = secret;
  }

  async getStatus() {
    try {
      const res = await fetch(`${this.host}/status`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { worker: 'Worker 1 (VPS DO 16GB)', status: 'offline', queueLength: 0 };
      return await res.json();
    } catch {
      return { worker: 'Worker 1 (VPS DO 16GB)', status: 'offline', queueLength: 0 };
    }
  }

  async submitBuild({ buildId, type, buildMode, appName, zipBuffer }) {
    const url = `${this.host}/build?buildId=${encodeURIComponent(buildId)}&type=${encodeURIComponent(type)}&buildMode=${encodeURIComponent(buildMode)}&appName=${encodeURIComponent(appName)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secret}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(zipBuffer.length)
      },
      body: zipBuffer
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal mengirim proyek ke VPS Worker (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  async pollBuildStatus(buildId) {
    const res = await fetch(`${this.host}/build/${encodeURIComponent(buildId)}`, {
      headers: {
        'Authorization': `Bearer ${this.secret}`
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal membaca status build dari VPS (${res.status})`);
    }

    return await res.json();
  }

  async downloadArtifact(buildId) {
    const res = await fetch(`${this.host}/artifact/${encodeURIComponent(buildId)}`, {
      headers: {
        'Authorization': `Bearer ${this.secret}`
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengunduh APK dari VPS Worker (${res.status})`);
    }

    const disp = res.headers.get('content-disposition') || '';
    const match = disp.match(/filename="?([^";]+)"?/);
    const fileName = match ? match[1] : 'app-release.apk';

    const arrayBuf = await res.arrayBuffer();
    const apkBuffer = Buffer.from(arrayBuf);

    return {
      fileName,
      apkBuffer,
      fileSize: apkBuffer.length,
      directUrl: `${this.host}/artifact/${encodeURIComponent(buildId)}`
    };
  }
}
