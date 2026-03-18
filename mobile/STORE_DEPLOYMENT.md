# Finalize configuration and push to Google Play & App Store

This guide walks you through **finalizing all required configuration** and **submitting the AssetXAI mobile app** to the Google Play Store and Apple App Store. Complete the steps in order.

---

## Prerequisites

1. **Expo account** — [expo.dev](https://expo.dev); run `npm i -g eas-cli` and `eas login`.
2. **Google Play Developer account** — [play.google.com/console/signup](https://play.google.com/console/signup) ($25 one-time).
3. **Apple Developer Program** — [developer.apple.com/programs](https://developer.apple.com/programs/) ($99/year).
4. **App icons** — Replace placeholder images in `mobile/assets/` (see [CONFIGURATION.md](./CONFIGURATION.md)). Stores may reject placeholder icons.

Use **[CONFIGURATION.md](./CONFIGURATION.md)** to fill in every value (API URL, Supabase, Apple ID, Team ID, App Store Connect App ID, Google service account).

---

## Step 1: Finalize configuration

1. **Open [CONFIGURATION.md](./CONFIGURATION.md)** and set:
   - EAS secrets (or `mobile/.env`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - In **eas.json** → `submit.production.ios`: `appleId`, `ascAppId`, `appleTeamId` (you’ll get `ascAppId` in Step 4).
2. **Replace assets** in `mobile/assets/`: `icon.png`, `adaptive-icon.png`, `splash-icon.png` (and optionally `favicon.png`).
3. **Link EAS** (first time only, from repo root):
   ```bash
   cd mobile
   eas build:configure
   ```
4. **Set EAS secrets** (production builds use these; replace with your real values):
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value "https://assetxai.live" --type string
   eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --type string
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --type string
   ```

---

## Step 2: Build production apps (EAS)

From the `mobile/` directory:

```bash
eas build --platform all --profile production
```

- Wait for both **Android** and **iOS** builds to finish.
- You’ll get a link to download the **Android** `.aab` (App Bundle) and the **iOS** `.ipa`.
- First **iOS** build: EAS may prompt for your Apple ID and can create/manage certificates and provisioning profiles.

To build one platform at a time:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## Part A: Push to Google Play Store

### A1. Create the app in Play Console

1. Go to [Google Play Console](https://play.google.com/console) → **Create app**.
2. Fill in:
   - **App name**: e.g. AssetXAI  
   - **Default language**  
   - **App or game**: App  
   - **Free or paid**: Free (or Paid)
3. Accept declarations and create the app.

### A2. Complete store listing and content (required before first release)

1. **Store listing** (Release → Setup → Main store listing):
   - **Short description** (max 80 chars).
   - **Full description** (max 4000 chars).
   - **App icon**: 512×512 px.
   - **Feature graphic**: 1024×500 px.
   - **Screenshots**: At least 2 (e.g. phone 16:9 or 9:16). You can capture from simulator or device.
2. **Privacy policy**: Required. Use **https://assetxai.live/privacy** (or your own URL).
3. **Content rating**: Complete the questionnaire (Tools → Content rating).
4. **Target audience**: Set age group(s).
5. **News app / COVID-19 / Data safety**: Complete as required by the checklist.

### A3. Upload the first version

1. In Play Console → your app → **Release** → **Production** (or **Testing** → **Internal testing** to test first).
2. **Create new release**:
   - Upload the **.aab** you downloaded from EAS (or use EAS Submit — see A4).
   - **Release name**: e.g. `1.0.0 (1)`.
   - **Release notes**: e.g. “Initial release.”
3. **Save** and **Start rollout to Production** (or add testers for internal testing).

### A4. (Optional) Submit from EAS to Google Play

To have EAS upload the latest build for you:

1. **Create a Google Play service account**:
   - Play Console → **Setup** → **API access** → **Link** (or create) a project → **Create new service account**.
   - In Google Cloud Console for that project, create a key (JSON) for the service account and download it.
   - In Play Console → **Users and permissions** → invite the service account with **Release to production** (or appropriate) role.
2. Save the JSON key as **`mobile/google-service-account.json`** (do **not** commit; it’s in `mobile/.gitignore`).
3. In **eas.json**, `submit.production.android` should have:
   - `"serviceAccountKeyPath": "./google-service-account.json"`
   - `"track": "internal"` for internal testing; change to `"production"` when you are ready for a production rollout.
4. After a successful Android build:
   ```bash
   eas submit --platform android --profile production
   ```
   EAS will upload the latest build to the release track you set.

---

## Part B: Push to Apple App Store

### B1. Create the app in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**.
2. Fill in:
   - **Platform**: iOS  
   - **Name**: e.g. AssetXAI  
   - **Primary language**  
   - **Bundle ID**: Must match `app.json` → **com.assetxai.app** (or create a new one in Apple Developer and use it in `app.json`).  
   - **SKU**: e.g. `assetxai-mobile`
3. Create the app. Note the **App ID** (numeric) from **App Information** — you need it for EAS Submit (`ascAppId` in eas.json).

### B2. Certificates and provisioning (EAS)

- The first time you run `eas build --platform ios`, EAS will prompt for your **Apple ID** and can create/distribute certificates and provisioning profiles.
- Have your **Apple ID** and **Team ID** ready (Team ID: [developer.apple.com/account](https://developer.apple.com/account) → **Membership**).

### B3. Upload build to App Store Connect

**Option 1 — EAS Submit (recommended)**  
1. In **eas.json** set `submit.production.ios`:
   - `appleId`: your Apple ID email  
   - `ascAppId`: the numeric App ID from App Store Connect  
   - `appleTeamId`: your Team ID  
2. After a successful iOS build:
   ```bash
   eas submit --platform ios --profile production
   ```
   EAS uploads the latest build to App Store Connect.

**Option 2 — Manual**  
- Download the **.ipa** from EAS, then use **Transporter** (Mac App Store) or **Xcode** → **Window** → **Organizer** → **Distribute App** to upload to App Store Connect.

### B4. Store listing and review

1. In App Store Connect → your app → **App Store** tab:
   - **Screenshots**: iPhone 6.7", 6.5", 5.5" (required); use simulator or device.
   - **Description**, **Keywords**, **Support URL** (e.g. https://assetxai.live), **Marketing URL** (optional).
   - **Privacy Policy URL**: **https://assetxai.live/privacy** (required).
   - **Version** and **What’s New**.
2. Under **Build**, select the build you uploaded.
3. **Pricing**: Free or paid.
4. **App Review Information**: Contact and notes if needed.
5. **Submit for Review**. First review often takes 24–48 hours.

---

## Checklist before submission

- [ ] Replaced placeholder `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` with real app icons.
- [ ] Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (EAS secrets or `.env`) for production builds.
- [ ] Privacy policy URL live: **https://assetxai.live/privacy** (and linked in both store listings).
- [ ] Google Play: Store listing, content rating, privacy policy, and (if using EAS Submit) `google-service-account.json` in place.
- [ ] Apple: eas.json `submit.production.ios` has `appleId`, `ascAppId`, `appleTeamId`; store listing and build selected in App Store Connect.

---

## Updating the app later

1. Bump **version** in `mobile/app.json` (and, if not using autoIncrement, **versionCode** / **buildNumber**).
2. Run `eas build --platform all --profile production` (or per platform).
3. Submit the new build via Play Console and App Store Connect (or `eas submit`), and update store listing/version info as needed.

You cannot actually push to the stores from this repo without your own developer accounts, store listings, and (for Google) service account key. This guide and the EAS configuration get you to the point where you can build and submit the app yourself.
