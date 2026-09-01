/**
 * Finds the figures in an uploaded PDF and says which question each belongs to.
 *
 * Text extraction alone loses every map, diagram and chart, and loses them
 * silently: a question reading "the number of triangles in the following
 * figure" arrives with nothing to count. Six such questions had already reached
 * students before this existed.
 *
 * Pixels come from `unpdf`'s `extractImages`, which drives pdf.js's own
 * decoder. That matters — the image streams are filtered, often chained, and
 * frequently carry a PNG predictor; decoding them by hand yields
 * plausible-looking noise rather than an obvious failure. Reading `page.objs`
 * directly does not work either, because outside a render those objects never
 * resolve and the wait hangs with no error.
 *
 * Position comes from the operator list, by tracking the transform stack. That
 * is what lets a figure be attributed to the question printed nearest above it,
 * the way a reader would. A figure whose position cannot be established is
 * returned unattributed for a human to assign, never guessed onto a question.
 *
 * Watermarks are rejected by comparing decoded pixels. These papers stamp a
 * logo on every page as a *separate* object, so looking for a repeated object
 * id finds nothing: 11,438 embedded images across the 2011 set proved to be
 * four real pictures and a great deal of letterhead.
 */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export interface PdfFigure {
  /** Question number this sits under, or null if it could not be placed. */
  questionNumber: number | null;
  /** 1-based page. */
  page: number;
  /** PNG bytes. */
  data: Buffer;
  width: number;
  height: number;
  /** Pixel hash — identical images share one, which is how furniture is found. */
  hash: string;
}

export interface FigureResult {
  figures: PdfFigure[];
  warnings: string[];
}

/** Smaller than this on the page and it is a rule, bullet or icon. */
const MIN_WIDTH_PT = 60;
const MIN_HEIGHT_PT = 45;

/** And smaller than this in pixels is too coarse to be a readable figure. */
const MIN_PIXELS_WIDE = 110;
const MIN_PIXELS_TALL = 80;

/** Appearing on this many pages makes an image a watermark, not content. */
const FURNITURE_PAGES = 3;

/**
 * Covering this much of the page makes an image the page itself.
 *
 * A scanned paper is one photograph per sheet, carrying every question printed
 * on it. It satisfies every test for a figure — large, high resolution, sitting
 * under a question number — but attaching it would show a student a picture of
 * six unrelated questions. Only something appreciably smaller than the sheet is
 * a figure *within* a question.
 */
const MAX_PAGE_COVERAGE = 0.6;

/**
 * Guards against one upload becoming a very long job.
 *
 * Counted *after* watermarks are discarded. Counting candidates instead meant a
 * paper that stamps its letterhead on every page spent the whole budget on
 * repeats of the logo and stopped before reaching the diagrams on page 61 —
 * silently returning nothing from a document full of figures.
 */
const MAX_FIGURES = 60;
const MAX_PAGES = 200;

/** pdf.js operators that paint a raster image. */
const PAINT_OPS = new Set([82, 85, 87]);

/** Operators that move or bracket the drawing position. */
const OP_TRANSFORM = 12;
const OP_SAVE = 10;
const OP_RESTORE = 11;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the page rectangle each image is painted into.
 *
 * An image is always drawn into the unit square, so the transform in force at
 * the moment it is painted *is* its position and size. Save and restore are
 * tracked so nesting does not corrupt that.
 */
function imageRects(ops: { fnArray: number[]; argsArray: unknown[][] }): Rect[] {
  const rects: Rect[] = [];
  const stack: number[][] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];

  const multiply = (a: number[], b: number[]): number[] => [
    (a[0] ?? 0) * (b[0] ?? 0) + (a[2] ?? 0) * (b[1] ?? 0),
    (a[1] ?? 0) * (b[0] ?? 0) + (a[3] ?? 0) * (b[1] ?? 0),
    (a[0] ?? 0) * (b[2] ?? 0) + (a[2] ?? 0) * (b[3] ?? 0),
    (a[1] ?? 0) * (b[2] ?? 0) + (a[3] ?? 0) * (b[3] ?? 0),
    (a[0] ?? 0) * (b[4] ?? 0) + (a[2] ?? 0) * (b[5] ?? 0) + (a[4] ?? 0),
    (a[1] ?? 0) * (b[4] ?? 0) + (a[3] ?? 0) * (b[5] ?? 0) + (a[5] ?? 0),
  ];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];

    if (fn === OP_SAVE) {
      stack.push([...ctm]);
      continue;
    }
    if (fn === OP_RESTORE) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      continue;
    }
    if (fn === OP_TRANSFORM) {
      const m = ops.argsArray[i] as number[] | undefined;
      if (m && m.length >= 6) ctm = multiply(ctm, m);
      continue;
    }
    if (!PAINT_OPS.has(fn ?? -1)) continue;

    const width = Math.abs(ctm[0] ?? 0);
    const height = Math.abs(ctm[3] ?? 0);
    rects.push({ x: ctm[4] ?? 0, y: (ctm[5] ?? 0) - height, width, height });
  }

  return rects;
}

interface Placed {
  number: number;
  /** Distance from the top of the page. */
  top: number;
}

/** Question numbers on a page, with how far down the page each sits. */
async function questionPositions(page: {
  getViewport: (o: { scale: number }) => { height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
}): Promise<Placed[]> {
  const placed: Placed[] = [];
  try {
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();

    for (const raw of content.items) {
      const item = raw as { str?: string; transform?: number[] };
      const text = (item.str ?? '').trim();
      const match = /^(?:Q\s*)?(\d{1,3})[.)](?:\s|$)/.exec(text);
      if (!match) continue;

      const n = Number(match[1]);
      if (n < 1 || n > 300) continue;

      placed.push({ number: n, top: height - (item.transform?.[5] ?? 0) });
    }
  } catch {
    // A page whose text will not read still yields images; they come back
    // unattributed rather than guessed.
  }
  return placed.sort((a, b) => a.top - b.top);
}

let crcTable: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}

/** Encodes decoded pixels as a PNG, without needing an image library. */
function encodePng(
  width: number,
  height: number,
  pixels: Uint8Array,
  channels?: number,
): Buffer | null {
  const n = channels ?? Math.round(pixels.length / (width * height));
  if (n !== 1 && n !== 3 && n !== 4) return null;
  if (pixels.length < width * height * n) return null;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * n;
      if (n === 1) {
        const v = pixels[i] ?? 0;
        raw[p++] = v;
        raw[p++] = v;
        raw[p++] = v;
      } else {
        raw[p++] = pixels[i] ?? 0;
        raw[p++] = pixels[i + 1] ?? 0;
        raw[p++] = pixels[i + 2] ?? 0;
      }
    }
  }

  const idat = deflateSync(raw, { level: 9 });

  const chunk = (type: string, body: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed) >>> 0);
    return Buffer.concat([len, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function extractFigures(buffer: Buffer): Promise<FigureResult> {
  const warnings: string[] = [];
  const collected: PdfFigure[] = [];
  let scannedPages = 0;

  const { getDocumentProxy, extractImages } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(buffer));

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  if (doc.numPages > MAX_PAGES) {
    warnings.push(`Only the first ${MAX_PAGES} pages were scanned for figures.`);
  }

  // Pages each distinct image appears on, tracked as we go so the budget can
  // be spent on figures rather than on repeats of the letterhead.
  const pagesPerHash = new Map<string, Set<number>>();
  const distinctSoFar = () =>
    [...pagesPerHash.values()].filter((pages) => pages.size < FURNITURE_PAGES).length;

  for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
    if (distinctSoFar() >= MAX_FIGURES) {
      warnings.push(`Stopped after ${MAX_FIGURES} figures; later pages were not scanned.`);
      break;
    }

    try {
      const page = await doc.getPage(pageNo);

      const [images, rects, placed] = await Promise.all([
        extractImages(doc, pageNo).catch(() => [] as unknown[]),
        page.getOperatorList().then(imageRects).catch(() => [] as Rect[]),
        questionPositions(page as never),
      ]);

      const list = images as unknown[];
      if (list.length === 0) continue;

      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;
      const pageWidth = viewport.width;

      // The image list and the operator walk traverse the page in the same
      // order, so the nth image occupies the nth rectangle. Where the counts
      // disagree the position is unknown, and those figures are left
      // unattributed rather than paired with someone else's rectangle.
      const aligned = list.length === rects.length;
      if (!aligned && rects.length > 0) {
        warnings.push(
          `Page ${pageNo}: ${list.length} image(s) but ${rects.length} position(s); left unplaced.`,
        );
      }

      for (const [index, raw] of list.entries()) {
        if (distinctSoFar() >= MAX_FIGURES) break;

        const image = raw as {
          width?: number;
          height?: number;
          data?: Uint8Array;
          channels?: number;
        };
        if (!image.data || !image.width || !image.height) continue;
        if (image.width < MIN_PIXELS_WIDE || image.height < MIN_PIXELS_TALL) continue;

        const rect = aligned ? rects[index] : undefined;
        if (rect && (rect.width < MIN_WIDTH_PT || rect.height < MIN_HEIGHT_PT)) continue;

        // Reject the scan of the whole sheet.
        if (rect && pageWidth > 0 && pageHeight > 0) {
          const coverage = (rect.width * rect.height) / (pageWidth * pageHeight);
          if (coverage > MAX_PAGE_COVERAGE) {
            scannedPages += 1;
            continue;
          }
        }

        const png = encodePng(image.width, image.height, image.data, image.channels);
        if (!png) continue;

        let questionNumber: number | null = null;
        if (rect) {
          const topOfFigure = pageHeight - rect.y - rect.height;
          const above = placed.filter((q) => q.top <= topOfFigure + 8);
          questionNumber = above.length > 0 ? above[above.length - 1]!.number : null;
        }

        const hash = createHash('sha256').update(png).digest('hex');
        const seen = pagesPerHash.get(hash) ?? new Set<number>();
        seen.add(pageNo);
        pagesPerHash.set(hash, seen);

        collected.push({
          questionNumber,
          page: pageNo,
          data: png,
          width: image.width,
          height: image.height,
          hash,
        });
      }
    } catch (error) {
      warnings.push(`Page ${pageNo}: ${(error as Error).message}`);
    }
  }

  // Reject watermarks by pixels, not by object id — these papers store the
  // stamp as a fresh object on every page.
  const figures = collected.filter((f) => (pagesPerHash.get(f.hash)?.size ?? 0) < FURNITURE_PAGES);
  const removed = collected.length - figures.length;
  if (removed > 0) {
    warnings.push(`${removed} repeated image(s) ignored as a watermark or header.`);
  }

  if (scannedPages > 0) {
    warnings.push(
      `${scannedPages} full-page scan(s) ignored. This document is a scanned paper, so any ` +
        `diagram in it is part of the page image and has to be cropped by hand.`,
    );
  }

  const unplaced = figures.filter((f) => f.questionNumber === null).length;
  if (unplaced > 0) {
    warnings.push(`${unplaced} figure(s) could not be matched to a question; assign them by hand.`);
  }

  return { figures, warnings };
}
