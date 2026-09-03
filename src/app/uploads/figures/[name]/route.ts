import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { figuresDir } from '@/server/services/figure-storage';

/**
 * GET /uploads/figures/[name] — serve a question diagram.
 *
 * In production Caddy serves this directory straight off disk and never reaches
 * Node. This route exists for development, where `public/` is only scanned at
 * build time: a figure uploaded at runtime is on disk but 404s until the next
 * build, which makes attaching an image look broken to whoever is doing the
 * content work.
 *
 * These are public by design — a diagram is part of its question, and questions
 * are readable without an account.
 */
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  // `basename` strips any directory component, so "../../production.db" cannot
  // escape the figures directory.
  const fileName = path.basename(name);
  const extension = path.extname(fileName).toLowerCase();
  const contentType = TYPES[extension];
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  const file = path.join(figuresDir(), fileName);
  if (!(await stat(file).catch(() => null))) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(await readFile(file)), {
    headers: {
      'Content-Type': contentType,
      // Content-addressed by hash, so a given name's bytes never change.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
