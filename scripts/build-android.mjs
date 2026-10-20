import { spawnSync } from 'node:child_process';
import { access, mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const candidates = [
  process.env.TIMELOG_JAVA_HOME,
  process.platform === 'win32' ? 'C:/Program Files/Android/Android Studio/jbr' : null,
  process.env.JAVA_HOME,
].filter(Boolean);
let javaHome;
for (const candidate of candidates) {
  try {
    await access(path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'));
    javaHome = candidate;
    break;
  } catch {}
}
if (!javaHome) throw new Error('Set TIMELOG_JAVA_HOME to a JDK 21 installation for this command.');
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(root, '.tools', 'gradle'),
};
if (!env.ANDROID_HOME && process.platform === 'win32')
  env.ANDROID_HOME = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(command, ['--no-daemon', 'assembleRelease', 'lintRelease'], {
  cwd: path.join(root, 'android'),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.status !== 0) process.exit(result.status || 1);
await mkdir('release', { recursive: true });
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await cp(
  'android/app/build/outputs/apk/release/app-release.apk',
  `release/Open-Timelog-${manifest.version}-Android.apk`,
);
console.log(`release/Open-Timelog-${manifest.version}-Android.apk`);
