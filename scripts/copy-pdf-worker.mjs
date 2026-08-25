/**
 * Copies the PDF.js worker into public/ so the analysis viewer can load it
 * from our own origin rather than a CDN.
 *
 * Run automatically before every build: the file must match the installed
 * pdfjs-dist version, and a stale copy fails at runtime with a version
 * mismatch that is easy to misread as a corrupt document.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require.resolve('pdfjs-dist/package.json');
const source = path.join(path.dirname(pkg), 'build', 'pdf.worker.min.mjs');

await mkdir('public', { recursive: true });
await copyFile(source, path.join('public', 'pdf.worker.min.mjs'));
console.log('pdf.worker.min.mjs -> public/');
