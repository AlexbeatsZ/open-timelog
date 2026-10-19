import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
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
