import { readFile, writeFile, cp } from 'node:fs/promises';
const names = [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  'idb',
  '@capacitor/core',
  '@capacitor/app',
];
let result = 'Open Timelog — bundled web dependencies\n\n';
for (const name of names) {
  const manifest = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  let license = '';
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
    try {
      license = await readFile(`node_modules/${name}/${filename}`, 'utf8');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!license) throw new Error(`Missing license for ${name}`);
  result += `${name} ${manifest.version}\n${'='.repeat(60)}\n${license}\n\n`;
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', result);
await cp('LICENSE', 'dist/LICENSE.txt');
