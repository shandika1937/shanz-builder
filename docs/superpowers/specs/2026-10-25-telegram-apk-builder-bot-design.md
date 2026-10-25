# Desain Bot Telegram: Build ZIP & HTML to APK (Node.js + GitHub Actions)

## 1. Ringkasan & Tujuan (Intent & Why)
Membangun bot Telegram berbasis Node.js yang berfungsi sebagai jembatan otomatis (*cloud builder*) untuk mengubah file proyek aplikasi menjadi file APK Android siap instal. Bot akan menangani:
1. **ZIP to APK (Flutter)**: Proyek source code Flutter (`lib/`, `pubspec.yaml`, dll.) di dalam ZIP dikompilasi menjadi APK rilis/debug.
2. **HTML to APK (WebView)**: File HTML tunggal (atau file web dalam ZIP) disematkan ke dalam template Android WebView dan dikompilasi menjadi APK.

Semua kompilasi berat (Flutter SDK, Android SDK, Gradle, Java) didelegasikan ke **GitHub Actions** menggunakan satu repositori GitHub pusat milik admin. Bot berjalan ringan di VPS NAT / Pterodactyl Panel menggunakan *long polling*, sehingga tidak memerlukan IP publik khusus atau open port.

Tampilan bot memanfaatkan fitur Telegram Bot API modern (Bot API 9.4+ / 10.x):
- Format pesan kaya (**Rich Message**)
- Tombol aksi berwarna (**Inline Keyboard with style**: `primary` / biru, `success` / hijau, `danger` / merah)
- Tombol tautan kontak Owner (@ShanzRL) dan Co-Owner (@gamersbug)

---

## 2. Tujuan & Batasan (Goals, Non-Goals, Anti-Goals)

### Goals:
- Perintah `/start` menampilkan menu Rich Message dengan informasi bot dan tombol pilihan aksi berwarna.
- Tombol menu:
  1. 📦 **Build ZIP to APK** (`style: "primary"`)
  2. 🌐 **Build HTML to APK** (`style: "success"`)
  3. 👑 **Owner: @ShanzRL** (Link `https://t.me/ShanzRL`)
  4. 🤝 **Co-Owner: @gamersbug** (Link `https://t.me/gamersbug`)
- Deteksi otomatis file ZIP (validasi proyek Flutter seperti file `pubspec.yaml`).
- Mode kompilasi HTML langsung ke APK WebView.
- Integrasi otomatis dengan GitHub REST API:
  - Push branch sementara / dispatch workflow.
  - Memantau progress run GitHub Actions.
  - Mengunduh artifact file APK.
  - Mengirim file APK kembali ke chat pengguna Telegram.
- Konfigurasi mudah melalui file `.env` (Bot Token, GitHub Token, GitHub Repo Owner/Name).
- Dukungan log dan pembersihan temporary file otomatis di VPS.

### Non-Goals:
- Menjalankan kompilasi Flutter/Android SDK secara lokal di VPS NAT / Termux (terlalu berat dan boros RAM).
- Menyediakan signing key berbayar / Google Play Store publish automation (fokus pada output APK siap tes/instal).

### Anti-Goals:
- Bot tidak boleh crash jika pengguna mengirim file corrupt/bukan Flutter; bot harus memberikan validasi dan notifikasi kesalahan yang jelas.
- Bot tidak boleh meninggalkan tumpukan temporary file/branch liar di GitHub.

---

## 3. Pendekatan Arsitektur (Approaches)

### Pendekatan yang Dipilih: Temporary Branch Push & Dispatch
- **Alur kerja:**
  1. Pengguna memilih menu atau langsung mengirim file (`.zip` atau `.html`).
  2. Bot menyimpan file sementara di direktori `temp/` lokal.
  3. Bot mendeteksi dan memvalidasi tipe file.
  4. Bot membuat branch sementara di repositori GitHub admin (misal: `build/user-<id>-<timestamp>`), mengunggah file source, lalu memicu workflow GitHub Actions.
  5. Workflow GitHub Actions menjalankan langkah build:
     - Untuk Flutter: setup Java, Flutter SDK, `flutter pub get`, `flutter build apk --release`.
     - Untuk HTML: mengisi template Android WebView dengan file HTML pengguna, menjalankan Gradle `assembleRelease` / `assembleDebug`.
     - Mengunggah file `.apk` sebagai GitHub Actions Artifact.
  6. Bot melakukan polling ke GitHub Actions API setiap 10-15 detik untuk memantau status (`queued` -> `in_progress` -> `completed`).
  7. Pesan Telegram diperbarui secara real-time dengan status build dan animasi emoji.
  8. Setelah sukses, bot mengunduh artifact APK dari GitHub, mengirimkannya ke chat pengguna, dan menghapus branch sementara serta file temporary lokal.

---

## 4. Struktur Modul & Komponen

```text
shanz-build/
├── .env.example              # Template variabel lingkungan
├── package.json              # Dependencies: telegraf / node-telegram-bot-api, @octokit/rest, adm-zip, dotenv
├── src/
│   ├── index.js              # Entrypoint bot Telegram & setup polling
│   ├── config.js             # Validasi environment & kredensial
│   ├── handlers/
│   │   ├── start.js          # Menu /start dengan Rich Message & Colored Buttons
│   │   ├── zipHandler.js     # Validasi ZIP, ekstraksi deteksi Flutter
│   │   └── htmlHandler.js    # Penanganan file HTML & pembuatan paket WebView
│   ├── services/
│   │   ├── telegram.js       # Pengiriman rich message & button styling
│   │   └── github.js         # API GitHub Actions, branch creation, dispatch, artifact downloader
│   └── templates/
│       └── webview-android/  # Template project Android WebView minimalis untuk HTML build
└── github-workflows/
    ├── flutter-build.yml     # Workflow GitHub Actions untuk kompilasi Flutter
    └── html-build.yml        # Workflow GitHub Actions untuk kompilasi HTML ke APK
```

---

## 5. Keputusan Desain Antarmuka Telegram (Rich UI)
- `/start` menampilkan banner teks berformat kaya, menyapa pengguna, dan menampilkan inline keyboard dengan tombol bergaya:
  - `Build ZIP to APK` (`style: "primary"`)
  - `Build HTML to APK` (`style: "success"`)
  - `👑 Owner: @ShanzRL` (URL)
  - `🤝 Co-Owner: @gamersbug` (URL)
- Saat file dikirim, bot mengedit pesan status secara dinamis (*loading indicator*):
  - `⏳ Memvalidasi file...`
  - `🚀 Mengunggah ke GitHub Builder...`
  - `⚙️ Sedang mengompilasi APK di cloud runner (Estimasi: 2-4 menit)...`
  - `✅ Kompilasi sukses! Mengirimkan APK...`
  - Tombol aksi batal `❌ Batalkan` (`style: "danger"`) saat proses berjalan.

---

## 6. Apa yang Disediakan untuk Pengembang/Admin
- Instruksi langkah demi langkah konfigurasi:
  - Pembuatan Bot Token via @BotFather
  - Pembuatan GitHub Personal Access Token (PAT dengan izin `repo` dan `workflow`)
  - Penyiapan repositori builder di GitHub
  - File workflow GitHub Actions siap pakai
