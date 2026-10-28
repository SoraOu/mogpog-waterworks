// Builds the single-file decrypt.html (tweetnacl inlined) from decrypt.template.html.
// Usage (from the project root):  node admin-tool/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const nacl = readFileSync(join(here, '..', 'node_modules', 'tweetnacl', 'nacl-fast.min.js'), 'utf8');
const tpl = readFileSync(join(here, 'decrypt.template.html'), 'utf8');
writeFileSync(join(here, 'decrypt.html'), tpl.replace('/*NACL*/', () => nacl.replace(/<\/script/gi, '<\\/script')));
console.log('wrote admin-tool/decrypt.html');
