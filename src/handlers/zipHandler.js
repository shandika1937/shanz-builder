import AdmZip from 'adm-zip';

export async function inspectZipProject(zipInput) {
  try {
    const zip = typeof zipInput === 'string' ? new AdmZip(zipInput) : new AdmZip(zipInput);
    const entries = zip.getEntries();

    let pubspecEntry = null;
    let rootPrefix = '';

    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, '/');
      if (name === 'pubspec.yaml') {
        pubspecEntry = entry;
        rootPrefix = '';
        break;
      }
      if (name.endsWith('/pubspec.yaml')) {
        const parts = name.split('/');
        if (parts.length === 2) {
          pubspecEntry = entry;
          rootPrefix = `${parts[0]}/`;
          break;
        }
      }
    }

    if (!pubspecEntry) {
      return {
        isFlutter: false,
        reason: 'File <code>pubspec.yaml</code> tidak ditemukan di dalam ZIP.'
      };
    }

    // Check lib directory or main.dart
    const hasLib = entries.some(entry => {
      const name = entry.entryName.replace(/\\/g, '/');
      return name.startsWith(`${rootPrefix}lib/`) || name === `${rootPrefix}lib/main.dart`;
    });

    if (!hasLib) {
      return {
        isFlutter: false,
        reason: 'Direktori <code>lib/</code> tidak ditemukan di proyek Flutter ini.'
      };
    }

    const content = pubspecEntry.getData().toString('utf8');
    const nameMatch = content.match(/^name:\s*([^\s#]+)/m);
    const versionMatch = content.match(/^version:\s*([^\s#]+)/m);

    const appName = nameMatch ? nameMatch[1].trim() : 'flutter_app';
    const version = versionMatch ? versionMatch[1].trim() : '1.0.0';

    return {
      isFlutter: true,
      name: appName,
      version,
      rootPrefix,
      totalFiles: entries.length
    };
  } catch (err) {
    return {
      isFlutter: false,
      reason: `Gagal membaca file ZIP: ${err.message}`
    };
  }
}
