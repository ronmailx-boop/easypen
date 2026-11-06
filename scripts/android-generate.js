/*
 * Generates the Android app (a Trusted Web Activity) in android/ from twa-manifest.json,
 * with Bubblewrap's generator - the same project `bubblewrap init` makes, without its questions.
 *
 * Run again after changing twa-manifest.json (e.g. a new version: appVersionCode + appVersionName):
 *   npm i --no-save @bubblewrap/core@1.27.0
 *   node scripts/android-generate.js
 * The app itself is the website: a change to the site does not need a new Android build.
 * Signing is done by the GitHub Actions workflow (build-android.yml), never with a key in the repo.
 */
const path = require('path');
const fs = require('fs');
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');

async function main() {
  const root = path.resolve(__dirname, '..');
  const target = path.join(root, 'android');
  const manifest = await TwaManifest.fromFile(path.join(root, 'twa-manifest.json'));
  const error = manifest.validate();
  if (error) throw new Error(error);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target);
  await new TwaGenerator().createTwaProject(target, manifest, new ConsoleLog('android-generate'));
  // Fixes to Bubblewrap's project:
  // - No R8 shrinking: the app is tiny either way, and it hides crash causes behind renamed classes.
  //   (twa-manifest.json must keep enableSiteSettingsShortcut: true - with false, androidbrowserhelper
  //   2.7 still enables ManageDataLauncherActivity, which is then missing, and the app crashes on start.)
  // - The DelegationService always on: Google Play Billing (Digital Goods API) goes through it,
  //   while Bubblewrap ties it to notifications, which EasyPen doesn't use.
  patch(path.join(target, 'app', 'build.gradle'), 'minifyEnabled true', 'minifyEnabled false');
  patch(path.join(target, 'app', 'src', 'main', 'AndroidManifest.xml'),
    'android:enabled="@bool/enableNotification"\n            android:exported="@bool/enableNotification"',
    'android:enabled="true"\n            android:exported="true"');
  // Build output and signing keys never go into git
  fs.writeFileSync(path.join(target, '.gitignore'), 'build/\n.gradle/\nlocal.properties\n*.keystore\n*.p12\n*.jks\n');
  // Bubblewrap keeps its own copy of the manifest next to the project
  fs.copyFileSync(path.join(root, 'twa-manifest.json'), path.join(target, 'twa-manifest.json'));
  console.log('Android project ready in android/');
}

function patch(file, from, to) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`${path.basename(file)}: "${from}" not found`);
  fs.writeFileSync(file, text.replace(from, to));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
