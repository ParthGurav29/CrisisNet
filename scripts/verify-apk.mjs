import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString('utf8').trim();
}

function fail(msg) {
  console.error(`\n[verify-apk] ${msg}\n`);
  process.exit(1);
}

const repoRoot = process.cwd();

const wantsDebug =
  process.argv.includes('--debug') ||
  (process.env.APK_VARIANT || '').toLowerCase() === 'debug';

const buildRelease = process.argv.includes('--build');
const buildDebug = process.argv.includes('--build-debug');

if (buildRelease) {
  console.log('[verify-apk] Building release APK (clean + assembleRelease)…');
  execFileSync('./gradlew', ['clean', 'assembleRelease'], {
    cwd: path.resolve(repoRoot, 'android'),
    stdio: 'inherit',
  });
}

if (buildDebug) {
  console.log('[verify-apk] Building debug APK (clean + assembleDebug)…');
  execFileSync('./gradlew', ['clean', 'assembleDebug'], {
    cwd: path.resolve(repoRoot, 'android'),
    stdio: 'inherit',
  });
}

const defaultApk = wantsDebug
  ? path.resolve(repoRoot, 'android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk')
  : path.resolve(repoRoot, 'android/app/build/outputs/apk/release/app-arm64-v8a-release.apk');

const apkPath = process.env.APK_PATH ? path.resolve(repoRoot, process.env.APK_PATH) : defaultApk;

if (!existsSync(apkPath)) {
  fail(
    `APK not found at: ${apkPath}\n` +
      `Build it (cd android && ./gradlew ${wantsDebug ? 'assembleDebug' : 'assembleRelease'}) or set APK_PATH.\n` +
      `Or run: npm run verify:apk:build${wantsDebug ? ':debug' : ''}`,
  );
}

console.log(`[verify-apk] variant: ${wantsDebug ? 'debug' : 'release'}`);
console.log(`[verify-apk] APK: ${apkPath}`);

const gitSha = sh('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
console.log(`[verify-apk] git SHA: ${gitSha}`);

let versionCode = 'NA';
let versionName = 'NA';
try {
  const gradle = readFileSync(path.resolve(repoRoot, 'android/app/build.gradle'), 'utf8');
  const vc = gradle.match(/versionCode\s+(\d+)/);
  const vn = gradle.match(/versionName\s+"([^"]+)"/);
  if (vc) versionCode = vc[1];
  if (vn) versionName = vn[1];
} catch {
  // ignore
}
console.log(`[verify-apk] versionCode: ${versionCode}`);
console.log(`[verify-apk] versionName: ${versionName}`);

console.log('[verify-apk] Checking that the APK contains assets/index.android.bundle…');
const listing = sh('unzip', ['-l', apkPath]);
if (!listing.includes('assets/index.android.bundle')) {
  fail(
    'assets/index.android.bundle not found inside APK.\n' +
      'Without this file the app shows "Unable to load script" unless Metro is running.\n' +
      'For debug builds, ensure android/app/build.gradle sets react { debuggableVariants = [] }.',
  );
}

console.log('[verify-apk] Scanning embedded bundle for current source literals…');
const needles = [
  'AI Model Required',
  'One-time download needed for offline AI',
  'CrisisNet',
];

const needleBuffers = needles.map((n) => Buffer.from(n, 'utf8'));
const maxNeedleLen = needleBuffers.reduce((m, b) => Math.max(m, b.length), 0);

const foundMap = new Map(needles.map((n) => [n, false]));

await new Promise((resolve, reject) => {
  const child = spawn('unzip', ['-p', apkPath, 'assets/index.android.bundle'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let tail = Buffer.alloc(0);

  child.stdout.on('data', (chunk) => {
    const buf = tail.length ? Buffer.concat([tail, chunk]) : chunk;
    for (let i = 0; i < needles.length; i++) {
      if (!foundMap.get(needles[i]) && buf.includes(needleBuffers[i])) {
        foundMap.set(needles[i], true);
      }
    }
    tail = buf.subarray(Math.max(0, buf.length - (maxNeedleLen - 1)));
  });

  child.on('error', reject);
  child.stderr.on('data', () => {
    // ignore unzip stderr unless it exits non-zero
  });
  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(`unzip exited with code ${code}`));
      return;
    }
    resolve();
  });
});

let ok = true;
for (const n of needles) {
  const found = foundMap.get(n) === true;
  console.log(`[verify-apk]  - ${n}: ${found ? 'FOUND' : 'MISSING'}`);
  if (!found) ok = false;
}

if (!ok) {
  fail('One or more expected literals were missing. This may indicate a stale bundle or different code path.');
}

console.log('\n[verify-apk] OK: APK contains embedded JS bundle and expected literals.\n');
