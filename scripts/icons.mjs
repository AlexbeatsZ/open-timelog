import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
for (const size of [192, 512])
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
const sizes = [16, 32, 48, 64, 128, 256];
const entries = await Promise.all(
  sizes.map((size) => sharp('public/icon.svg').resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((entry, index) => {
  const at = 6 + 16 * index;
  header[at] = sizes[index] % 256;
  header[at + 1] = sizes[index] % 256;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(entry.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += entry.length;
});
await writeFile('public/icon.ico', Buffer.concat([header, ...entries]));
const macEntries = [];
for (const [type, size] of [
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
]) {
  const png = await sharp('public/icon.svg').resize(size, size).png().toBuffer();
  const chunk = Buffer.alloc(8);
  chunk.write(type, 0);
  chunk.writeUInt32BE(png.length + 8, 4);
  macEntries.push(chunk, png);
}
const macHeader = Buffer.alloc(8);
macHeader.write('icns');
macHeader.writeUInt32BE(8 + macEntries.reduce((n, b) => n + b.length, 0), 4);
await writeFile('public/icon.icns', Buffer.concat([macHeader, ...macEntries]));
for (const [density, size] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  await mkdir(directory, { recursive: true });
  for (const file of ['ic_launcher.png', 'ic_launcher_round.png'])
    await sharp('public/icon.svg').resize(size, size).png().toFile(`${directory}/${file}`);
}
const foreground = await sharp('public/icon.svg').resize(288, 288).png().toBuffer();
await mkdir('android/app/src/main/res/drawable-nodpi', { recursive: true });
await sharp({ create: { width: 432, height: 432, channels: 4, background: '#256f68' } })
  .composite([{ input: foreground, left: 72, top: 72 }])
  .png()
  .toFile('android/app/src/main/res/drawable-nodpi/ic_timelog_foreground.png');
