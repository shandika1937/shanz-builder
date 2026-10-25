import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { packageHtmlToAndroidProject } from '../src/handlers/htmlHandler.js';

test('packageHtmlToAndroidProject produces buildable android project zip', async () => {
  const html = '<!DOCTYPE html><html><head><title>My Web</title></head><body><h1>Hello World</h1></body></html>';
  const zipBuffer = await packageHtmlToAndroidProject(html, { appName: 'My Super Web' });
  const zip = new AdmZip(zipBuffer);

  const assetEntry = zip.getEntry('app/src/main/assets/index.html');
  assert.ok(assetEntry, 'index.html asset must exist');
  assert.equal(assetEntry.getData().toString('utf8'), html);

  assert.ok(zip.getEntry('app/src/main/AndroidManifest.xml'), 'AndroidManifest.xml must exist');
  assert.ok(zip.getEntry('app/build.gradle'), 'app/build.gradle must exist');
  assert.ok(zip.getEntry('build.gradle'), 'root build.gradle must exist');
  assert.ok(zip.getEntry('settings.gradle'), 'settings.gradle must exist');
  assert.ok(zip.getEntry('gradlew'), 'gradlew must exist');
  assert.ok(zip.getEntry('app/src/main/java/com/shanz/webtoapk/MainActivity.java'), 'MainActivity.java must exist');
});
