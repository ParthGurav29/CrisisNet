## CrisisNet APK runtime verification checklist

This is a **manual** checklist to confirm the app behaves as intended on-device:
download model → reach home → model loads → user can chat.

### "Unable to load script. Make sure you're running Metro…"

That screen means the APK had **no embedded** `assets/index.android.bundle` and could not reach the dev server.

- **Cause (React Native default):** `debug` / `debugOptimized` variants **skip** Gradle bundling and expect Metro (`npx react-native start`).
- **Fix in this repo:** `android/app/build.gradle` sets `react { debuggableVariants = [] }` so **debug APKs also embed JS** and run offline after install.
- **Verify before sharing an APK:** from the project root run `npm run verify:apk` (release) or `npm run verify:apk:debug` (debug).

### Which APK should I install?

This project builds **ABI-split** APKs (see `android/app/build.gradle`): only **`arm64-v8a`** is included. Gradle writes them here:

| Variant | Typical path |
|--------|----------------|
| Debug | `android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk` |
| Release | `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk` |

- Install **that** file on a physical **64‑bit ARM** phone (`arm64-v8a`). Older **32‑bit‑only** devices are not covered by this split.
- After `clean`, always pick the APK **under `outputs/apk/`**, not intermediates folders.
- If you still see the Metro error, you are likely installing an **old APK** built before `debuggableVariants = []`, or not the Gradle-packaged APK. Run `npm run verify:apk:build:debug` (or `:build` for release) and install the APK from `outputs/` that the script reports.

### Preconditions

- Install the APK you want to verify (prefer a clean install).
- Ensure **sufficient free storage** for the model download (multi‑GB).
- Use stable Wi‑Fi for the first download.

### Flow checklist (expected)

- **Permissions gate**
  - On first run, grant Bluetooth, Location, Notifications.
  - If you deny, app shows **Permissions Required** and you won’t reach download/home until enabled.

- **Onboarding gate**
  - On first install (fresh app data), you will see onboarding first.
  - After onboarding completes, next launch should start at **Splash**.

- **Splash**
  - If model exists and loads successfully, you should land on **Home**.
  - If model is missing (or load fails), you should be routed to **ModelDownload**.

- **Model download screen**
  - Verify progress updates.
  - After download completes, you should be routed through **Splash** and then to **Home** (so the model loads before Home/AI use).

- **Home**
  - Main tabs visible.
  - Navigate to **Ask AI** (or Chat, depending on your test).

- **Ask AI**
  - Status text should indicate the model is ready (not “Model not downloaded”).
  - The input should be enabled and you should get a non-empty response.

### Critical cross-check: same-session vs cold start

This catches a common integration bug where the model file is downloaded but the in-memory model isn’t loaded until the next app launch.

- **Same-session**: right after a successful first download, go to **Ask AI** and send a prompt.
- **Cold start**: fully kill the app and reopen; confirm the same prompt works.

If it only works after cold start, the app is not loading the model in the same session post-download.

