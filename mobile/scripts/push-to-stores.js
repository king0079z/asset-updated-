#!/usr/bin/env node
/**
 * Push AssetXAI mobile app to Google Play and App Store.
 *
 * YOU MUST DO THESE FIRST (the agent cannot access your accounts):
 * 1. Fill mobile/.env with:
 *    EXPO_PUBLIC_API_URL=https://assetxai.live
 *    EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
 * 2. In eas.json → submit.production.ios set: appleId, ascAppId, appleTeamId
 * 3. Place google-service-account.json in mobile/ (from Play Console → API access)
 * 4. Run: npm i -g eas-cli && eas login
 * 5. Replace placeholder icons in mobile/assets/ (see CONFIGURATION.md)
 *
 * Then run: node scripts/push-to-stores.js
 * Or: node scripts/push-to-stores.js --build-only   (no submit)
 * Or: node scripts/push-to-stores.js --submit-only (submit last build only)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

function run(cmd, opts = {}) {
  console.log('\n\u001b[36m$\u001b[0m', cmd);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function envToSecrets() {
  if (!fs.existsSync(ENV_PATH)) {
    console.warn('No mobile/.env found. Skipping EAS secrets. Set them manually or create .env.');
    return;
  }
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const vars = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  for (const name of vars) {
    const m = new RegExp(`${name}=(.+)`).exec(content);
    const val = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    if (!val || val.includes('your-project') || val.includes('your-anon')) {
      console.warn(`Skipping ${name} (not set or still placeholder in .env)`);
      continue;
    }
    try {
      const safe = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      run(`eas secret:create --name ${name} --value "${safe}" --type string --force`);
    } catch (e) {
      console.warn('Could not set secret', name, '(may already exist):', e.message);
    }
  }
}

function main() {
  const buildOnly = process.argv.includes('--build-only');
  const submitOnly = process.argv.includes('--submit-only');

  console.log('AssetXAI — Push to stores');
  console.log('Working directory:', ROOT);

  if (!submitOnly) {
    envToSecrets();
    run('eas build --platform all --profile production');
  }

  if (!buildOnly && !submitOnly) {
    run('eas submit --platform android --profile production');
    run('eas submit --platform ios --profile production');
  } else if (submitOnly) {
    run('eas submit --platform android --profile production');
    run('eas submit --platform ios --profile production');
  }

  console.log('\nDone. Check Play Console and App Store Connect for review status.');
}

main();
