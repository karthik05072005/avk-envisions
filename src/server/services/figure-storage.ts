/**
 * Stores question figures and hands back the URL a student's browser will use.
 *
 * These are the only images the platform serves publicly, so unlike the
 * analysis documents they live *inside* the uploads directory that Caddy
 * serves directly. A diagram is part of the question; putting it behind the
 * access-checked streaming route would mean an authenticated round trip
 * through Node for every figure on every question of every attempt.
 *
 * Files are named by a hash of their contents, which makes writing them
 * idempotent: importing the same paper twice reuses the file rather than
 * accumulating copies, and two questions sharing a diagram share one file.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';


/**
 * Where figures are written.
 *
 * Derived from DATABASE_URL so it lands on the persistent volume in production
 * (`/var/lib/avkvisions/uploads/figures`) and inside the project in
 * development, without a second path to configure.
 */
export function figuresDir(): string {
  const explicit = process.env.FIGURES_DIR;
  if (explicit) return path.resolve(explicit);

  // In production the database sits on the persistent volume, and Caddy serves
  // `/uploads/*` from `uploads/` beside it — so deriving the path from
  // DATABASE_URL lands exactly where the web server is already looking.
  const url = process.env.DATABASE_URL ?? '';
  const dir = url.startsWith('file:') ? path.dirname(url.slice('file:'.length)) : '';
  if (path.isAbsolute(dir)) return path.join(dir, 'uploads', 'figures');

  // A relative DATABASE_URL means development, where the database is a file in
  // the repo and nothing serves a sibling `uploads/`. Next serves `public/`, so
  // figures go there instead — the same URL either way.
  return path.resolve('public/uploads/figures');
}

/** The public URL for a stored figure. */
export function figureUrl(fileName: string): string {
  const base = (process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? '').replace(/\/+$/, '');
  // Caddy serves the uploads directory at /uploads, so a relative path works
  // even when no absolute base is configured.
  return base ? `${base}/figures/${fileName}` : `/uploads/figures/${fileName}`;
}

/**
 * Writes a figure and returns its public URL.
 *
 * A file already present with the same content is left alone — the name is its
 * hash, so identical bytes are the same file by definition.
 */
/**
 * Image types an admin may upload.
 *
 * Deliberately narrow, and checked against the file's own leading bytes rather
 * than its name or the browser's content-type — both are attacker-controlled.
 * SVG is excluded on purpose: it is a document that can carry script, and these
 * files are served from the same origin as the site.
 */
const SIGNATURES: { ext: string; test: (b: Buffer) => boolean }[] = [
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.subarray(0, 6).toString('latin1').startsWith('GIF8') },
  {
    ext: 'webp',
    test: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

/** The image type these bytes actually are, or null if not a supported image. */
export function imageKind(data: Buffer): string | null {
  return SIGNATURES.find((s) => s.test(data))?.ext ?? null;
}

export async function storeFigure(data: Buffer, extension?: string): Promise<string> {
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 32);
  const fileName = `${hash}.${extension ?? 'png'}`;

  const dir = figuresDir();
  await mkdir(dir, { recursive: true });

  const target = path.join(dir, fileName);
  const existing = await stat(target).catch(() => null);
  if (!existing || existing.size !== data.byteLength) {
    await writeFile(target, data);
  }

  return figureUrl(fileName);
}
