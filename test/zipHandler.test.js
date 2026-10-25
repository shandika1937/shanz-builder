import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { inspectZipProject } from '../src/handlers/zipHandler.js';

test('inspectZipProject rejects zip without pubspec.yaml', async () => {
  const zip = new AdmZip();
  zip.addFile('test.txt', Buffer.from('hello'));
  const buffer = zip.toBuffer();
  const res = await inspectZipProject(buffer);
  assert.equal(res.isFlutter, false);
  assert.ok(res.reason);
});

test('inspectZipProject accepts valid root-level flutter project', async () => {
  const zip = new AdmZip();
  zip.addFile('pubspec.yaml', Buffer.from('name: flutter_super_app\nversion: 1.0.2+3\n'));
  zip.addFile('lib/main.dart', Buffer.from('void main() {}'));
  const buffer = zip.toBuffer();
  const res = await inspectZipProject(buffer);
  assert.equal(res.isFlutter, true);
  assert.equal(res.name, 'flutter_super_app');
  assert.equal(res.version, '1.0.2+3');
  assert.equal(res.rootPrefix, '');
});

test('inspectZipProject accepts nested flutter project inside folder', async () => {
  const zip = new AdmZip();
  zip.addFile('my_folder/pubspec.yaml', Buffer.from('name: nested_app\nversion: 2.0.0\n'));
  zip.addFile('my_folder/lib/main.dart', Buffer.from('void main() {}'));
  const buffer = zip.toBuffer();
  const res = await inspectZipProject(buffer);
  assert.equal(res.isFlutter, true);
  assert.equal(res.name, 'nested_app');
  assert.equal(res.rootPrefix, 'my_folder/');
});
