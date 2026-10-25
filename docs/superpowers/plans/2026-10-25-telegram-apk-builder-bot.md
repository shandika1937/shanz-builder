# Telegram APK Builder Bot (ZIP & HTML to APK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a Node.js Telegram bot that receives ZIP (Flutter) and HTML files, validates them, triggers GitHub Actions workflows on an admin repository to compile Android APKs, and returns the APKs to users via rich Telegram messages with styled buttons.

**Architecture:** A lightweight Node.js bot running long-polling (suitable for NAT VPS/Pterodactyl Panel). It inspects incoming ZIP/HTML files locally, pushes build payloads to temporary branches or repository releases in GitHub, triggers GitHub Actions runners to execute heavy Flutter/Android builds, polls run statuses, downloads artifact APKs, and sends them to Telegram chats with modern Bot API rich buttons.

**Tech Stack:** Node.js (v20+), `node-telegram-bot-api` / custom Bot API HTTP client, `@octokit/rest`, `adm-zip`, `dotenv`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-telegram-apk-builder-bot-design.md`

## Global Constraints
- Bot Token: `8682345376:AAEvsKAbxyAmD2ywcedNuJU1ReBUNcgXeMI`
- Owner ID: `8594510495` (@ShanzRL)
- Co-Owner ID: `8728564869` (@gamersbug)
- Modern Telegram Bot API 9.4+ / 10.x button styles: `style` ("primary", "success", "danger") in inline keyboard buttons.
- Runs without requiring open inbound ports (Long Polling mode).
- Temporary files and branches must be cleaned up automatically after build completion or failure.

## Review Focus
1. User sends a ZIP file that is NOT a Flutter project (missing `pubspec.yaml` or `lib/`): Bot must reject gracefully with clear rich message error.
2. User sends an HTML file without embedded assets: Bot must package it into the WebView template and trigger Gradle build.
3. GitHub Actions build fails (compile error in user's Flutter code): Bot must catch failed run status, retrieve failed step log summary, and notify user with a red `danger` alert button.
4. Telegram 50MB file size upload limit exceeded: Bot must provide a direct authenticated download link to the GitHub Artifact instead of crashing.
5. Concurrent requests from different users: Temporary directories and build branch names must use unique user IDs and timestamps to avoid collision.

---

### Task 1: Project Scaffolding & Configuration
**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.env`
- Create: `src/config.js`
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: Environment variables (`BOT_TOKEN`, `OWNER_ID`, `CO_OWNER_ID`, `GITHUB_TOKEN`, `GITHUB_REPO`)
- Produces: `config` object `{ botToken, ownerId, coOwnerId, githubToken, githubRepo, tempDir }`

- [ ] **Step 1: Write failing test for config loader**
```javascript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';

test('loadConfig throws if required env vars are missing', () => {
  assert.throws(() => loadConfig({}));
});
test('loadConfig parses valid config', () => {
  const cfg = loadConfig({
    BOT_TOKEN: '8682345376:AAEvsKAbxyAmD2ywcedNuJU1ReBUNcgXeMI',
    OWNER_ID: '8594510495',
    CO_OWNER_ID: '8728564869',
    GITHUB_TOKEN: 'ghp_dummy',
    GITHUB_REPO: 'ShanzRL/shanz-builder'
  });
  assert.equal(cfg.ownerId, '8594510495');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test test/config.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `package.json`, `.env`, and `src/config.js`**
Install dependencies: `dotenv`, `adm-zip`, `@octokit/rest`. Write `src/config.js` with `loadConfig` function validating all credentials.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test test/config.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
`git add package.json .env.example src/config.js test/config.test.js`

---

### Task 2: Telegram Bot API Client with Modern Styled Buttons & Rich Messages
**Files:**
- Create: `src/services/telegram.js`
- Test: `test/telegram.test.js`

**Interfaces:**
- Consumes: `botToken` from config
- Produces: `TelegramClient` with methods:
  - `sendMessage(chatId, text, options)`
  - `editMessageText(chatId, messageId, text, options)`
  - `sendDocument(chatId, fileStream, options)`
  - `createStyledKeyboard(buttonsMatrix)` supporting `style: "primary" | "success" | "danger"`

- [ ] **Step 1: Write failing test for keyboard generator**
```javascript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createStartKeyboard } from '../src/services/telegram.js';

test('createStartKeyboard generates inline keyboard with styled buttons and contacts', () => {
  const kb = createStartKeyboard();
  assert.ok(kb.inline_keyboard);
  const zipBtn = kb.inline_keyboard[0][0];
  assert.equal(zipBtn.style, 'primary');
  assert.equal(zipBtn.callback_data, 'mode_zip');
  const ownerBtn = kb.inline_keyboard[1][0];
  assert.equal(ownerBtn.url, 'https://t.me/ShanzRL');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test test/telegram.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `src/services/telegram.js`**
Implement Telegram Bot API HTTP caller using native `fetch` (compatible with Node 20+), supporting `sendMessage`, `editMessageText`, `sendDocument`, `getFile`, and inline keyboard formatting with Telegram Bot API 9.4+ `style` properties.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test test/telegram.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/services/telegram.js test/telegram.test.js`

---

### Task 3: ZIP Inspector & Flutter Project Validator
**Files:**
- Create: `src/handlers/zipHandler.js`
- Test: `test/zipHandler.test.js`

**Interfaces:**
- Consumes: ZIP file buffer / path
- Produces: `inspectZipProject(filePath)` -> `{ isFlutter: boolean, name: string, version: string, reason?: string }`

- [ ] **Step 1: Write failing test for ZIP inspector**
```javascript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { inspectZipProject } from '../src/handlers/zipHandler.js';

test('inspectZipProject rejects zip without pubspec.yaml', async () => {
  const zip = new AdmZip();
  zip.addFile("test.txt", Buffer.from("hello"));
  const buffer = zip.toBuffer();
  const res = await inspectZipProject(buffer);
  assert.equal(res.isFlutter, false);
});

test('inspectZipProject accepts valid flutter project', async () => {
  const zip = new AdmZip();
  zip.addFile("pubspec.yaml", Buffer.from("name: my_app\nversion: 1.0.0+1\n"));
  zip.addFile("lib/main.dart", Buffer.from("void main() {}"));
  const buffer = zip.toBuffer();
  const res = await inspectZipProject(buffer);
  assert.equal(res.isFlutter, true);
  assert.equal(res.name, 'my_app');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test test/zipHandler.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `src/handlers/zipHandler.js`**
Use `adm-zip` to inspect entries in the zip archive (checking for root-level or single-folder nested `pubspec.yaml` and `lib/`), parsing app name and version.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test test/zipHandler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/handlers/zipHandler.js test/zipHandler.test.js`

---

### Task 4: HTML to Android WebView Packager
**Files:**
- Create: `src/handlers/htmlHandler.js`
- Create: `src/templates/webview/MainActivity.kt`
- Create: `src/templates/webview/AndroidManifest.xml`
- Create: `src/templates/webview/build.gradle.kts`
- Test: `test/htmlHandler.test.js`

**Interfaces:**
- Consumes: HTML string or file buffer, optional `appName`
- Produces: `packageHtmlToAndroidProject(htmlContent, options)` -> returns a ZIP buffer containing a ready-to-build Android project with the HTML embedded in `app/src/main/assets/index.html`.

- [ ] **Step 1: Write failing test for HTML packager**
```javascript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { packageHtmlToAndroidProject } from '../src/handlers/htmlHandler.js';

test('packageHtmlToAndroidProject produces buildable android project zip', async () => {
  const html = "<html><body><h1>Hello World</h1></body></html>";
  const zipBuffer = await packageHtmlToAndroidProject(html, { appName: "TestApp" });
  const zip = new AdmZip(zipBuffer);
  assert.ok(zip.getEntry("app/src/main/assets/index.html"));
  assert.ok(zip.getEntry("app/src/main/AndroidManifest.xml"));
  assert.ok(zip.getEntry("app/build.gradle"));
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test test/htmlHandler.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `src/handlers/htmlHandler.js` and WebView project templates**
Implement templating logic creating standard Android Gradle project structure with WebView loading `file:///android_asset/index.html` and internet permissions enabled.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test test/htmlHandler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/handlers/htmlHandler.js src/templates/ test/htmlHandler.test.js`

---

### Task 5: GitHub Actions Integration & Workflow Dispatch Service
**Files:**
- Create: `src/services/github.js`
- Test: `test/github.test.js`

**Interfaces:**
- Consumes: `githubToken`, `githubRepo`
- Produces: `GitHubBuilderService` with methods:
  - `triggerFlutterBuild(branchOrPayload, buildOptions)`
  - `triggerHtmlBuild(branchOrPayload, buildOptions)`
  - `pollWorkflowRun(runId, onProgress)`
  - `downloadArtifact(runId, artifactName)`

- [ ] **Step 1: Write unit tests with mock Octokit/REST API responses**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `src/services/github.js`**
Using `@octokit/rest` to trigger `workflow_dispatch`, poll run status (`queued`, `in_progress`, `completed`), and retrieve downloadable artifact URLs.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
`git add src/services/github.js test/github.test.js`

---

### Task 6: GitHub Actions Workflows Templates
**Files:**
- Create: `github-workflows/build-flutter.yml`
- Create: `github-workflows/build-html.yml`
- Test: Validate YAML syntax and action structure

**Interfaces:**
- Input: Workflow dispatch inputs (`branch` or source archive)
- Output: Actions artifacts containing `release-apk` / `app-release.apk`

- [ ] **Step 1: Write `github-workflows/build-flutter.yml`**
Steps: Checkout repository, setup Java 17, setup Flutter SDK, `flutter pub get`, `flutter build apk --release`, upload artifact `flutter-apk`.
- [ ] **Step 2: Write `github-workflows/build-html.yml`**
Steps: Checkout repository, setup Java 17, setup Android SDK, `chmod +x ./gradlew`, `./gradlew assembleRelease`, upload artifact `html-webview-apk`.
- [ ] **Step 3: Validate YAML and syntax**
- [ ] **Step 4: Commit**
`git add github-workflows/`

---

### Task 7: Bot Entry Point, Handlers & Long Polling Loop
**Files:**
- Create: `src/index.js`
- Create: `src/handlers/start.js`
- Test: End-to-end simulation test

**Interfaces:**
- Starts long polling with Telegram Bot API
- Routes `/start`, callback queries (`mode_zip`, `mode_html`, `cancel_build`), and file uploads (`document`).

- [ ] **Step 1: Write integration test for command handling & callback routing**
- [ ] **Step 2: Implement `src/handlers/start.js` and `src/index.js`**
- [ ] **Step 3: Verify with test suite**
- [ ] **Step 4: Commit**
`git add src/index.js src/handlers/start.js test/`
