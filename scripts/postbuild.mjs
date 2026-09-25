// After `vite build`: SPA fallback for GitHub Pages + sanity output.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
if (existsSync(join(dist, 'index.html'))) {
  copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
}
writeFileSync(join(dist, '.nojekyll'), '');
console.log('[postbuild] 404.html + .nojekyll written');
