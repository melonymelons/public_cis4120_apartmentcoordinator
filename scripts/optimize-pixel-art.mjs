import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('public/pixel');
for (const file of await readdir(directory)) {
  if (!file.endsWith('.png')) continue;
  const input = resolve(directory, file);
  const output = resolve(directory, file.replace(/\.png$/, '.webp'));
  const width = file === 'characters.png' ? 768 : file === 'bathroom.png' ? 512 : 384;
  await sharp(input).resize({ width, kernel: sharp.kernel.nearest, withoutEnlargement: true }).webp({ lossless: true, effort: 6 }).toFile(output);
  const source = (await stat(input)).size;
  const result = (await stat(output)).size;
  console.log(`${file}: ${Math.round(source / 1024)} → ${Math.round(result / 1024)} KB (pixel-sized, lossless WebP)`);
}
