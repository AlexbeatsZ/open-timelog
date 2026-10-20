import { packager } from '@electron/packager';
import { mkdir, mkdtemp, cp, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Stage exactly the shipping app; never package browser profiles/research/tests.
const root = process.cwd();
const platform = process.argv.includes('--mac') ? 'darwin' : 'win32';
const architectures = platform === 'darwin' ? ['arm64', 'x64'] : ['x64'];
await mkdir(path.join(root, 'work'), { recursive: true });
const staging = await mkdtemp(path.join(root, 'work', `package-${platform}-`));
await cp(path.join(root, 'dist'), path.join(staging, 'dist'), {
  recursive: true,
  force: true,
});
await cp(path.join(root, 'electron'), path.join(staging, 'electron'), {
  recursive: true,
  force: true,
});
await cp(path.join(root, 'LICENSE'), path.join(staging, 'LICENSE'));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(
  path.join(staging, 'package.json'),
  JSON.stringify({
    name: manifest.name,
    productName: manifest.productName,
    version: manifest.version,
    description: manifest.description,
    main: manifest.main,
    author: manifest.author,
    license: manifest.license,
  }),
);
const outputs = await packager({
  dir: staging,
  out: path.join(root, 'release'),
  name: 'Open Timelog',
  icon: path.join(root, 'public', platform === 'darwin' ? 'icon.icns' : 'icon.ico'),
  platform,
  arch: architectures,
  appBundleId: 'io.github.alexbeatsz.opentimelog',
  appCategoryType: 'public.app-category.productivity',
  extendInfo: { NSHumanReadableCopyright: 'MIT — Open Timelog contributors' },
  electronVersion: manifest.devDependencies.electron.replace(/^[~^]/, ''),
  ...(process.env.TIMELOG_ELECTRON_ZIP_DIR
    ? { electronZipDir: process.env.TIMELOG_ELECTRON_ZIP_DIR }
    : {}),
  overwrite: true,
  asar: true,
  prune: false,
  win32metadata: {
    CompanyName: 'Open Timelog contributors',
    FileDescription: 'Open Timelog — offline time tracking',
    ProductName: 'Open Timelog',
  },
});
console.log(outputs.join('\n'));
if (platform === 'darwin' && process.platform === 'darwin') {
  for (const output of outputs) {
    const bundle = path.join(output, 'Open Timelog.app');
    execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], {
      stdio: 'inherit',
    });
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], {
      stdio: 'inherit',
    });
    const arch = output.endsWith('arm64') ? 'arm64' : 'x64';
    const file = path.join(root, 'release', `Open-Timelog-${manifest.version}-macOS-${arch}.zip`);
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, file], {
      stdio: 'inherit',
    });
    console.log(file);
  }
}
