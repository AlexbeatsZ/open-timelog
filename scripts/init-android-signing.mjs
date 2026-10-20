import { writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const directory = path.resolve('.local');
await mkdir(directory, { recursive: true });
const keyStore = path.join(directory, 'android-release.p12');
try {
  await access(keyStore);
  console.log('Existing project signing key retained.');
  process.exit(0);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const password = randomBytes(32).toString('base64url');
const storePasswordFile = path.join(directory, 'android-store.pass'),
  keyPasswordFile = path.join(directory, 'android-key.pass');
await writeFile(storePasswordFile, password, { mode: 0o600, flag: 'wx' });
await writeFile(keyPasswordFile, password, { mode: 0o600, flag: 'wx' });
const candidate =
  process.env.TIMELOG_JAVA_HOME ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Android/Android Studio/jbr'
    : process.env.JAVA_HOME);
if (!candidate) throw new Error('JDK 21 is required for keytool');
execFileSync(
  path.join(candidate, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool'),
  [
    '-genkeypair',
    '-keystore',
    keyStore,
    '-storetype',
    'PKCS12',
    '-storepass:file',
    storePasswordFile,
    '-keypass:file',
    keyPasswordFile,
    '-alias',
    'open-timelog',
    '-keyalg',
    'RSA',
    '-keysize',
    '3072',
    '-validity',
    '10000',
    '-dname',
    'CN=Open Timelog Release, O=Open Timelog, C=US',
  ],
  { stdio: 'inherit' },
);
await writeFile(
  path.join(directory, 'android-signing.properties'),
  `storeFile=${keyStore.replaceAll('\\', '/')}\nstorePassword=${password}\nkeyAlias=open-timelog\nkeyPassword=${password}\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log('Project signing key created in ignored .local; retain it for app updates.');
