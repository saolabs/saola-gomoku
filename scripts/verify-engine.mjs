import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync(new URL('../UPSTREAM.json', import.meta.url)));
for (const file of manifest.files) {
  const bytes = readFileSync(new URL('../' + file.target, import.meta.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== file.sha256) throw new Error(`Upstream file changed: ${file.target}`);
}
console.log(`Verified ${manifest.files.length} upstream engine, bot and test files.`);
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const react = Object.keys(lock.packages).filter(name => /node_modules\/(react|react-dom|react-scripts)$/.test(name));
if (react.length) throw new Error(`React dependency found: ${react.join(', ')}`);
const links = Object.entries(lock.packages).filter(([, info]) => info.link);
if (links.length) throw new Error('The lockfile contains local workspace links.');
console.log('Verified standalone dependencies: no React and no local workspace links.');
