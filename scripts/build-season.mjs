// Publish only the temporary page and its assets. Original website sources stay in Git.
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'season-dist');
if (dirname(output) !== root || basename(output) !== 'season-dist') {
  throw new Error('Refusing to clean a directory outside the season build output.');
}
await rm(output, { recursive: true, force: true });
const files = [
  'index.html',
  'assets/season.css',
  'assets/season.js',
  'assets/photos/pga-green.jpg',
  'logo-gct-full.png',
  'appfavicon.jpg',
];

for (const file of files) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}
console.log(`Temporary season site ready (${files.length} files).`);
