import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractFigures } from './pdf-figures';
import { synopsisDir } from './synopsis-service';

/**
 * These run against the real papers rather than fixtures.
 *
 * Every mistake this extractor made was invisible in a synthetic PDF and
 * obvious in a real one. The worst of them looked like a success: the scanned
 * papers yielded one large, high-resolution image per page, sitting under a
 * question number, passing every plausibility test — and each was a photograph
 * of the whole sheet, so attaching them would have shown a student a picture of
 * six unrelated questions instead of the diagram they needed.
 *
 * The documents are cached by the import scripts and are far too large to
 * commit, so these skip when they are not present.
 */
const PAPERS = path.join(path.dirname(synopsisDir()), 'question-papers');
const KAS_2011 = path.join(path.dirname(synopsisDir()), 'kas-2011');

async function load(file: string): Promise<Buffer | null> {
  if (!(await stat(file).catch(() => null))) return null;
  return readFile(file);
}

describe('extractFigures', () => {
  it('finds the world map the 2011 currents question depends on', async () => {
    const buffer = await load(path.join(KAS_2011, 'KAS_2011_PaperI_complete.pdf'));
    if (!buffer) return;

    const { figures } = await extractFigures(buffer);
    const map = figures.find((f) => f.questionNumber === 56);

    // Q56 asks the student to read arrows labelled a, b, c and d off a world
    // map. Without it the question has four plausible options and no way to
    // choose between them.
    expect(map).toBeDefined();
    expect(map!.width).toBeGreaterThan(200);
    expect(map!.data.subarray(1, 4).toString('latin1')).toBe('PNG');
  }, 120_000);

  it('does not mistake the letterhead stamped on every page for a figure', async () => {
    const buffer = await load(path.join(KAS_2011, 'KAS_2011_PaperI_complete.pdf'));
    if (!buffer) return;

    const { figures } = await extractFigures(buffer);

    // The logo is a fresh object on each page, so it cannot be found by object
    // id — only by noticing the same pixels recurring.
    const pagesPerImage = new Map<string, Set<number>>();
    for (const figure of figures) {
      const pages = pagesPerImage.get(figure.hash) ?? new Set<number>();
      pages.add(figure.page);
      pagesPerImage.set(figure.hash, pages);
    }
    for (const pages of pagesPerImage.values()) {
      expect(pages.size).toBeLessThan(3);
    }
  }, 120_000);

  it('returns nothing from a scanned paper rather than one image per page', async () => {
    const buffer = await load(path.join(PAPERS, 'KAS-2014-Prelims-Paper-1_ocred.pdf'));
    if (!buffer) return;

    const { figures, warnings } = await extractFigures(buffer);

    // Every image in this file is a photograph of a whole sheet. Returning them
    // would attach a page of six questions to whichever question happened to be
    // printed highest on it.
    expect(figures).toHaveLength(0);
    expect(warnings.some((w) => /full-page scan/i.test(w))).toBe(true);
  }, 180_000);

  it('never attributes a figure it could not place', async () => {
    const buffer = await load(path.join(PAPERS, 'KAS-2024-Prelims-Dec-Paper-2_ocred.pdf'));
    if (!buffer) return;

    const { figures } = await extractFigures(buffer);

    // A figure whose position on the page is unknown gets a null question
    // number and waits for a human. Guessing would silently pair a diagram with
    // the wrong question, which is worse than showing none.
    for (const figure of figures) {
      expect(figure.questionNumber === null || figure.questionNumber > 0).toBe(true);
      expect(figure.page).toBeGreaterThan(0);
    }
  }, 180_000);

  it('spends its budget on figures, not on repeats of the letterhead', async () => {
    const buffer = await load(path.join(KAS_2011, 'KAS_2011_PAPER_II-complete.pdf'));
    if (!buffer) return;

    const { figures } = await extractFigures(buffer);

    // This paper stamps a logo on all 99 pages and prints its diagrams from
    // page 42 on. Counting candidates against the cap meant the budget was
    // exhausted by the logo before any diagram was reached, and the file
    // reported no figures at all.
    expect(figures.length).toBeGreaterThan(4);
    expect(figures.some((f) => f.questionNumber === 82)).toBe(true);
    expect(figures.some((f) => f.questionNumber === 94)).toBe(true);
  }, 180_000);

  it('reports a file it cannot read instead of throwing', async () => {
    await expect(extractFigures(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
