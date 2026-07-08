// Post-build: make tsc's ESM output loadable by Node.
//
// The packages compile with `moduleResolution: bundler`, so tsc emits
// extensionless relative imports (`from './store'`). Bundlers (Vite/Vitest)
// resolve those, but Node's native ESM loader requires an explicit extension,
// so the *published* package would fail `import '@reflow/core'` in plain Node.
// This walks the built output and appends `.js` to every relative specifier in
// import/export/dynamic-import statements (both .js and .d.ts). Same effect as
// tsc-alias, with zero dependencies.
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const HAS_EXT = /\.(js|mjs|cjs|json|css)$/;

// Match the module specifier after `from`, a bare `import`, or `import(`.
const SPECIFIER =
  /(\bfrom\s*|\bimport\s*|\bimport\(\s*)(['"])(\.\.?\/[^'"]+)(['"])/g;

function rewrite(source) {
  return source.replace(SPECIFIER, (whole, pre, q1, spec, q2) =>
    HAS_EXT.test(spec) ? whole : `${pre}${q1}${spec}.js${q2}`
  );
}

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (name.endsWith('.js') || name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const root = process.argv[2];
if (!root) {
  console.error('usage: append-js-extensions.mjs <build-dir>');
  process.exit(1);
}

let changed = 0;
for (const file of await walk(root)) {
  const before = await readFile(file, 'utf8');
  const after = rewrite(before);
  if (after !== before) {
    await writeFile(file, after);
    changed++;
  }
}
console.log(`append-js-extensions: rewrote ${changed} file(s) under ${root}`);
