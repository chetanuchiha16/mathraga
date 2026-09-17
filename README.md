# Mathraga 🎵📐

[![Download APK](https://img.shields.io/github/v/release/chetanuchiha16/hollow-math?label=Download%20APK&logo=android&color=success)](https://github.com/chetanuchiha16/hollow-math/releases/latest)
[![Build Status](https://github.com/chetanuchiha16/hollow-math/actions/workflows/release.yml/badge.svg)](https://github.com/chetanuchiha16/hollow-math/actions/workflows/release.yml)

## 📲 Download the App

You can download and install the latest Android release directly from GitHub:

1. Go to the **[Latest Releases](https://github.com/chetanuchiha16/hollow-math/releases/latest)** page.
2. Under **Assets**, click **`mathraga.apk`** to download it to your Android device.
3. Open the downloaded `.apk` file on your device and tap **Install** (if prompted, enable "Install unknown apps" in your Android settings).

---

## 🚀 CI / CD & Automated Releases

This repository includes a GitHub Actions pipeline (`.github/workflows/release.yml`) that automatically builds, signs, and publishes the Android APK.

### How to trigger a release:

1. **Tag push (Recommended)**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   This automatically creates a new GitHub Release with changelog notes and the attached `mathraga.apk`.

2. **Manual Trigger (GitHub Actions UI)**:
   - Go to **Actions** -> **Build & Release Android APK**.
   - Click **Run workflow**, select the branch, and click run.

3. **Every push to `main`**:
   - Compiles the APK and uploads it to GitHub Actions **Artifacts** for quick testing.

### Optional: Production Signing Key

By default, the workflow generates a self-signed release keystore on the fly in CI so builds succeed with zero setup. To use your own official keystore:
1. Encode your `.keystore` or `.jks` file to Base64:
   ```bash
   base64 -w 0 your-release-key.keystore
   ```
2. Add these repository secrets under **Settings > Secrets and variables > Actions**:
   - `ANDROID_KEYSTORE_BASE64`: Base64 string of your keystore
   - `ANDROID_KEYSTORE_PASSWORD`: Keystore password
   - `ANDROID_KEY_ALIAS`: Key alias
   - `ANDROID_KEY_PASSWORD`: Key password

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
