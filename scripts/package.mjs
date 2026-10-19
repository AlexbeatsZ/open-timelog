import { packager } from '@electron/packager';
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// Stage exactly the shipping app; never package browser profiles/research/tests.
const root = process.cwd(),
  staging = path.join(root, 'work', 'package');
await mkdir(staging, { recursive: true });
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
  icon: path.join(root, 'public', 'icon.ico'),
  platform: 'win32',
  arch: 'x64',
  electronVersion: manifest.devDependencies.electron.replace(/^[~^]/, ''),
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
