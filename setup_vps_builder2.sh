#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== [1/5] Setting up Android SDK Components ==="
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools

yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses || true
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "=== [2/5] Installing Flutter 3.32.8 (Dart 3.8.1 SDK) ==="
mkdir -p /opt
cd /opt
if [ ! -d "/opt/flutter/bin" ]; then
  curl -4 -sSL -o flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.32.8-stable.tar.xz"
  tar -xf flutter.tar.xz
  rm -f flutter.tar.xz
fi

export PATH=$PATH:/opt/flutter/bin
git config --global --add safe.directory /opt/flutter
/opt/flutter/bin/flutter config --no-analytics
/opt/flutter/bin/flutter precache
yes | /opt/flutter/bin/flutter doctor --android-licenses || true

echo "=== [3/5] Installing Node.js 20 ==="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "=== [4/5] Setting up Environment Profile ==="
cat << 'ENVEOF' > /etc/profile.d/builder_env.sh
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:/opt/flutter/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools
ENVEOF

echo "=== [5/5] Verification ==="
java -version
/opt/flutter/bin/flutter --version
node -v

echo "SETUP_ALL_DONE_SUCCESS"
