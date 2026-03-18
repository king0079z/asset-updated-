# Deploy AssetXAI to Google Play and App Store

This guide walks you through submitting the AssetXAI mobile app to **Google Play Store** and **Apple App Store**. You must have developer accounts and complete the steps yourself; the app and EAS are ready for building and submission.

---

## Prerequisites

1. **Expo / EAS**
   - Run `npm i -g eas-cli` and `eas login` with your Expo account.

2. **Google Play**
   - [Google Play Developer account](https://play.google.com/console/signup) ($25 one-time).

3. **Apple App Store**
   - [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).

4. **App assets**
   - Replace placeholder icons/splash in `mobile/assets/` (see README). Stores reject apps with placeholder or low-quality icons.

---

## Part 1: Build production apps with EAS

1. In the repo root, go to the mobile app:
   ```bash
   cd mobile
   ```

2. Link the project to your Expo account (first time only):
   ```bash
   eas build:configure
   ```
   Use the default options. This updates `eas.json` if needed.

3. Set EAS secrets for production (so builds use your backend and Supabase):
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value "https://assetxai.live" --type string
   eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --type string
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --type string
   ```
   Replace with your real Supabase URL and anon key from your main app `.env`.

4. Build for both platforms:
   ```bash
   eas build --platform all --profile production
   ```
   Wait for both builds to finish. You’ll get:
   - **Android**: a download link for an `.aab` (Android App Bundle).
   - **iOS**: a download link for an `.ipa`.

   You can also build one platform at a time:
   - `eas build --platform android --profile production`
   - `eas build --platform ios --profile production`

---

## Part 2: Submit to Google Play Store

1. **Create the app in Play Console**
   - Go to [Google Play Console](https://play.google.com/console).
   - Click **Create app**.
   - Fill in app name (e.g. **AssetXAI**), default language, and whether it’s free/paid.
   - Complete the dashboard checklist (e.g. privacy policy, app content).

2. **Upload the first version**
   - In the app, go to **Release** → **Production** (or **Testing** → **Internal testing** to test first).
   - Create a new release and upload the `.aab` you downloaded from EAS (or use EAS Submit so EAS uploads it for you).
   - Set **Release name** (e.g. `1.0.0 (1)`).
   - Add **Release notes**.
   - Save and start rollout.

3. **Store listing**
   - **Main store listing**: Short and full description, screenshots (phone 16:9 or 9:16, min 2), feature graphic (1024×500), app icon (512×512).
   - **Content rating**: Complete the questionnaire.
   - **Target audience**: Set age group.
   - **Privacy policy**: Required; use a URL (e.g. `https://assetxai.live/privacy` or your company privacy page).

4. **Submit for review**
   - Complete all required sections (no errors in the checklist).
   - Send the release for review. First review can take a few days.

**Optional: Submit from EAS**

- [Create a Google Play service account](https://docs.expo.dev/submit/android/#credentials) and download the JSON key.
- Save it as `google-service-account.json` in the `mobile` folder (do not commit it).
- In `eas.json`, under `submit.production.android`, set `serviceAccountKeyPath` to `./google-service-account.json`.
- After a successful build:
  ```bash
  eas submit --platform android --profile production
  ```
  EAS will upload the latest build to the Play Console.

---

## Part 3: Submit to Apple App Store

1. **App Store Connect**
   - Go to [App Store Connect](https://appstoreconnect.apple.com).
   - **My Apps** → **+** → **New App**.
   - Choose platform **iOS**, name (e.g. **AssetXAI**), primary language, bundle ID (must match `app.json`: `com.assetxai.app`), SKU.

2. **Certificates and provisioning (EAS)**
   - For **EAS Build**, the first time you run `eas build --platform ios`, EAS will prompt you to log in with your Apple ID and can create/distribute certificates and provisioning profiles.
   - Have your **Apple ID** and **Team ID** ready. Team ID is in [Apple Developer](https://developer.apple.com/account) → **Membership**.

3. **Upload build to App Store Connect**
   - After the iOS build finishes, either:
     - **Option A**: Download the `.ipa` from EAS, then use **Transporter** (Mac App Store) or **Xcode** → **Window** → **Organizer** → **Distribute App** to upload to App Store Connect.
     - **Option B**: Use EAS Submit (see below).

4. **EAS Submit for iOS** (optional)
   - In `eas.json`, under `submit.production.ios`, set:
     - `appleId`: your Apple ID email
     - `ascAppId`: the App Store Connect app ID (numeric, from the app’s **App Information** page)
     - `appleTeamId`: your Team ID
   - Then run:
     ```bash
     eas submit --platform ios --profile production
     ```
   - EAS will upload the latest build to App Store Connect.

5. **Store listing and review**
   - In App Store Connect, open your app → **App Store** tab.
   - **Screenshots**: iPhone 6.7", 6.5", 5.5" (and iPad if you support it). Use Simulator or device.
   - **Description**, **Keywords**, **Support URL**, **Marketing URL**.
   - **Privacy Policy URL** (required).
   - **Version** and **What’s New**.
   - Under **Build**, select the build you uploaded.
   - **Pricing**: Free or paid.
   - Submit for **App Review**. First review often takes 24–48 hours.

---

## Checklist before submission

- [ ] Replaced placeholder `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` with real app icons.
- [ ] Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS secrets (or `.env`) for production builds.
- [ ] Privacy policy URL live and linked in both stores.
- [ ] Screenshots and store text prepared for both Google Play and App Store.

---

## Updating the app later

1. Bump `version` in `mobile/app.json` and, for Android, `versionCode` (or use `autoIncrement` in EAS).
2. Run `eas build --platform all --profile production` again.
3. Submit the new build via Play Console and App Store Connect (or `eas submit`), and update store listing/version info as needed.

You cannot actually “deploy” to the stores from this repo without your own developer accounts and store listings; this guide and the EAS configuration get you to the point where you can build and submit the app yourself.
