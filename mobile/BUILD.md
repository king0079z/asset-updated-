# AssetXAI Mobile — Build Instructions

## Prerequisites
1. [Expo account](https://expo.dev) (free)
2. EAS CLI installed: `npm install -g eas-cli`
3. Logged in: `eas login`

## One-time setup (run once after cloning)
```bash
cd mobile
npm install
eas init        # links the project to your Expo account
```

## Build APK (Android — for direct installation)
```bash
eas build --platform android --profile preview
```
→ EAS builds in the cloud and gives you a download link for the `.apk` file.  
→ Install on any Android device with "Install unknown apps" enabled.

## Build AAB (Android — for Google Play Store)
```bash
eas build --platform android --profile production
```

## Build iOS (requires Apple Developer account — $99/year)
```bash
eas build --platform ios --profile production
```

## Build both platforms at once
```bash
eas build --platform all --profile preview
```

## Submit to stores
```bash
# Android → Google Play (needs google-service-account.json)
eas submit --platform android

# iOS → App Store (needs Apple credentials in eas.json)
eas submit --platform ios
```

## Environment variables
The `.env` file is already set with production values:
- `EXPO_PUBLIC_API_URL=https://assetxai.live`
- `EXPO_PUBLIC_SUPABASE_URL=...`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`

For EAS builds, set these as secrets so they're not in the repo:
```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_..."
```
