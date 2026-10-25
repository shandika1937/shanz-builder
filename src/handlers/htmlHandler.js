import AdmZip from 'adm-zip';

const GRADLE_WRAPPER_PROPERTIES = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

const GRADLEW_SH = `#!/bin/sh
exec gradle "$@" 2>/dev/null || exec ./gradlew "$@"
`;

const ROOT_BUILD_GRADLE = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
task clean(type: Delete) {
    delete rootProject.buildDir
}
`;

const SETTINGS_GRADLE = `rootProject.name = "WebToApk"
include ':app'
`;

const GRADLE_PROPERTIES = `android.useAndroidX=true
android.nonTransitiveRClass=true
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
`;

const APP_BUILD_GRADLE = `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.shanz.webtoapk'
    compileSdk 34

    defaultConfig {
        applicationId "com.shanz.webtoapk"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.debug
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
}
`;

const ANDROID_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@android:drawable/sym_def_app_icon"
        android:label="@string/app_name"
        android:roundIcon="@android:drawable/sym_def_app_icon"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

const MAIN_ACTIVITY_JAVA = `package com.shanz.webtoapk;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`;

export async function packageHtmlToAndroidProject(htmlContent, options = {}) {
  const appName = options.appName || 'WebToApk App';
  const stringsXml = `<resources>\n    <string name="app_name">${appName.replace(/[<>&"']/g, '')}</string>\n</resources>`;

  const zip = new AdmZip();

  zip.addFile('build.gradle', Buffer.from(ROOT_BUILD_GRADLE));
  zip.addFile('settings.gradle', Buffer.from(SETTINGS_GRADLE));
  zip.addFile('gradle.properties', Buffer.from(GRADLE_PROPERTIES));
  zip.addFile('gradlew', Buffer.from(GRADLEW_SH));
  zip.addFile('gradle/wrapper/gradle-wrapper.properties', Buffer.from(GRADLE_WRAPPER_PROPERTIES));

  zip.addFile('app/build.gradle', Buffer.from(APP_BUILD_GRADLE));
  zip.addFile('app/src/main/AndroidManifest.xml', Buffer.from(ANDROID_MANIFEST));
  zip.addFile('app/src/main/res/values/strings.xml', Buffer.from(stringsXml));
  zip.addFile('app/src/main/java/com/shanz/webtoapk/MainActivity.java', Buffer.from(MAIN_ACTIVITY_JAVA));

  const htmlBuffer = Buffer.isBuffer(htmlContent) ? htmlContent : Buffer.from(htmlContent, 'utf8');
  zip.addFile('app/src/main/assets/index.html', htmlBuffer);

  return zip.toBuffer();
}
