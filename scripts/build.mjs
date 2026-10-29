import { cp, mkdir, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const manifest = JSON.parse(await readFile(new URL('data/assets-manifest.json', root), 'utf8'));
const records = JSON.parse(await readFile(new URL('data/costume-zh.json', root), 'utf8'));
const expected = records.flatMap(item => [item.缩略图, item.大图, item.原图]);
if (manifest.count !== expected.length || Object.keys(manifest.files).length !== expected.length) {
  throw new Error('Image manifest does not match the dataset. Run python scripts/verify.py.');
}
for (const path of expected) {
  const details = await stat(new URL(path, root));
  if (!details.isFile() || details.size !== manifest.files[path]?.bytes) {
    throw new Error(`Missing or incomplete image: ${path}. Run python scripts/download.py.`);
  }
}
await mkdir(output, { recursive: true });
for (const path of ['index.html', 'styles.css', 'app.js', 'data', 'thumbs', 'img', 'png', 'og-cover.jpg', 'robots.txt', 'sitemap.xml', '_headers']) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
console.log(`Static site ready in dist/ with ${expected.length} bundled images.`);
