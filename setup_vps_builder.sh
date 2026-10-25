#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== [1/6] Updating APT & Installing Base Utilities ==="
apt-get update -y
apt-get install -y git curl wget unzip zip openjdk-17-jdk xz-utils libglu1-mesa clang cmake ninja-build pkg-config libgtk-3-dev build-essential jq

echo "=== [2/6] Installing Android Commandline Tools & SDK ==="
mkdir -p /opt/android-sdk/cmdline-tools
cd /opt/android-sdk/cmdline-tools
if [ ! -d "latest" ]; then
  curl -sSL -o cmdline.zip "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip"
  unzip -q cmdline.zip
  mv cmdline-tools latest
  rm -f cmdline.zip
fi

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools

echo "Accepting SDK licenses..."
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses || true
echo "Installing platform tools & android-34..."
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "=== [3/6] Installing Flutter SDK (3.32.8) ==="
cd /opt
if [ ! -d "/opt/flutter/bin" ]; then
  curl -sSL -o flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.32.8-stable.tar.xz"
  tar -xf flutter.tar.xz
  rm -f flutter.tar.xz
fi

export PATH=$PATH:/opt/flutter/bin
git config --global --add safe.directory /opt/flutter
/opt/flutter/bin/flutter config --no-analytics
/opt/flutter/bin/flutter precache
yes | /opt/flutter/bin/flutter doctor --android-licenses || true

echo "=== [4/6] Installing Node.js 20 & Worker Server ==="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "=== [5/6] Creating Environment Variables Profile ==="
cat << 'ENVEOF' > /etc/profile.d/builder_env.sh
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:/opt/flutter/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools
ENVEOF

echo "=== [6/6] Complete Verification ==="
java -version
/opt/flutter/bin/flutter --version
node -v

echo "VPS_BUILDER_SETUP_SUCCESS"
