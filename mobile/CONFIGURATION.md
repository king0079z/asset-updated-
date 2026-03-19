# AssetXAI Mobile — Required Configuration Before Store Push

Use this checklist to fill in every value required to build and submit the app to Google Play and Apple App Store.

---

## 1. Values you must set

| What | Where | Example / Notes |
|------|--------|------------------|
| **API URL** | EAS secret `EXPO_PUBLIC_API_URL` or `mobile/.env` | `https://assetxai.live` |
| **Supabase URL** | EAS secret `EXPO_PUBLIC_SUPABASE_URL` or `mobile/.env` | `https://xxxx.supabase.co` (from main app `.env`) |
| **Supabase anon key** | EAS secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `mobile/.env` | From main app `.env` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Apple ID** | `eas.json` → `submit.production.ios.appleId` | Your Apple Developer account email |
| **App Store Connect App ID** | `eas.json` → `submit.production.ios.ascAppId` | Numeric ID from App Store Connect → Your App → App Information |
| **Apple Team ID** | `eas.json` → `submit.production.ios.appleTeamId` | From [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| **Google Play service account key** | File `mobile/google-service-account.json` (do not commit) | JSON key from Google Play Console → Setup → API access → Create service account; see store guide |

---

## 2. App identity (already set; change only if you need a different app)

| Field | Current value | File |
|-------|----------------|------|
| App name | AssetXAI | `app.json` → `expo.name` |
| Bundle ID (iOS) | `com.assetxai.app` | `app.json` → `expo.ios.bundleIdentifier` |
| Package (Android) | `com.assetxai.app` | `app.json` → `expo.android.package` |
| Version | 1.0.0 | `app.json` → `expo.version` |
| iOS build number | 1 | `app.json` → `expo.ios.buildNumber` (EAS can auto-increment) |
| Android versionCode | 1 | `app.json` → `expo.android.versionCode` (EAS can auto-increment) |

If you change the bundle ID or package, you must use the same values when creating the app in App Store Connect and Google Play Console.

---

## 3. Store listing URLs (required by both stores)

| URL | Use |
|-----|-----|
| **Privacy policy** | `https://assetxai.live/privacy` — Already added to the web app. Use this in both Google Play and App Store listing. |
| **Support URL** | Use your support page or `https://assetxai.live` (or add a `/support` page). |
| **Marketing URL** (optional) | e.g. `https://assetxai.live` |

---

## 4. Assets to replace before submission

Stores can reject apps with placeholder or low-quality icons. Replace these in `mobile/assets/`:

| File | Size | Purpose |
|------|------|--------|
| `icon.png` | 1024×1024 px | App icon |
| `adaptive-icon.png` | 1024×1024 px | Android adaptive icon (foreground) |
| `splash-icon.png` | e.g. 1284×2778 px | Splash screen |
| `favicon.png` | 48×48 px | Web favicon (optional for native) |

You can generate all from one image using [appicon.co](https://www.appicon.co) or similar.

---

## 5. EAS and eas.json

- **EAS project**: Run `eas build:configure` once in `mobile/` to link the project to your Expo account.
- **Production profile**: `eas.json` already has a `production` build profile with `autoIncrement: true` and Android `app-bundle`.
- **Submit block**: Fill in `submit.production.ios` (appleId, ascAppId, appleTeamId) and ensure `submit.production.android.serviceAccountKeyPath` points to your local `google-service-account.json` (file not committed).

After filling everything, you can push in one go:

```bash
cd mobile
npm run push-to-stores
```

This script syncs EAS secrets from your `.env`, runs the production build for both platforms, then submits to Google Play and App Store. See **[STORE_DEPLOYMENT.md](./STORE_DEPLOYMENT.md)** for manual steps and store-console setup.
