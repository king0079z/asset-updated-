# AssetXAI Mobile App

React Native (Expo) mobile app for **Android** and **iOS**, connected to your AssetXAI backend.

## Features

- **Sign in** with the same Supabase account as the web app
- **Scan** — Look up assets by barcode or ID
- **Assets** — Search and list assets
- **Inventory** — Placeholder (use web handheld for full count/audit)
- **Work** — Placeholder (use web for tickets/tasks)
- **More** — Sign out, open web app

All API calls use `Authorization: Bearer <token>` so the backend accepts mobile sessions.

## Setup

### 1. Install dependencies

```bash
cd mobile
npm install
# or
pnpm install
```

### 2. Environment variables

Create `mobile/.env` (or set in EAS/Expo):

```env
EXPO_PUBLIC_API_URL=https://assetxai.live
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the same Supabase URL and anon key as your Next.js app (from the main app `.env`).

### 3. Replace placeholder assets (required for store submission)

Replace the 1×1 placeholder images with real app icons:

- `assets/icon.png` — 1024×1024 px (app icon)
- `assets/adaptive-icon.png` — 1024×1024 px (Android adaptive icon foreground)
- `assets/splash-icon.png` — recommended 1284×2778 px or similar (splash screen)
- `assets/favicon.png` — 48×48 px (web)

You can generate all from one image using [appicon.co](https://www.appicon.co) or similar.

### 4. Run locally

```bash
npx expo start
```

Then press `a` for Android or `i` for iOS simulator, or scan the QR code with Expo Go on a device.

## Building for production

Uses [EAS Build](https://docs.expo.dev/build/introduction/).

1. Install EAS CLI and log in:

   ```bash
   npm i -g eas-cli
   eas login
   ```

2. Configure the project (first time):

   ```bash
   eas build:configure
   ```

3. Build:

   ```bash
   eas build --platform all --profile production
   ```

See **[STORE_DEPLOYMENT.md](./STORE_DEPLOYMENT.md)** for step-by-step Google Play and App Store submission.

## Project structure

- `app/` — Expo Router screens (file-based routing)
  - `(auth)/` — Login
  - `(tabs)/` — Main tabs: Scan, Inventory, Assets, Work, More
- `lib/` — API client, Supabase client
- `constants/` — Config (API URL, Supabase)
- `hooks/` — useAuth

## Backend

The Next.js API already supports mobile: it accepts `Authorization: Bearer <access_token>` (see `src/util/supabase/require-auth.ts` and `getSessionSafe`). Use the same Supabase project so the same users can sign in on web and mobile.
