import 'server-only';

import { AppError } from '@/lib/api';
import { logger } from '@/server/logger';

import { parseQuestionPaper, type ParseResult } from './question-parser';

/**
 * PDF ingestion.
 *
 * A thin wrapper: get text out of the file, hand it to the pure parser. The
 * split matters because text extraction depends on a native-ish library and is
 * awkward to test, whereas the parsing rules are the part that decides whether
 * a student is marked correctly — and those are covered exhaustively in
 * `question-parser.test.ts`.
 */

/** Refused above this size, before any parsing work is done. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface ImportedFigure {
  /** Question number this belongs under, or null if it could not be placed. */
  questionNumber: number | null;
  page: number;
  /** Public URL, already written to storage. */
  url: string;
  width: number;
  height: number;
}

export interface PdfImportResult extends ParseResult {
  fileName: string;
  pageCount: number;
  /** Extracted text, so the admin can see what the parser was working from. */
  extractedText: string;
  /**
   * Diagrams found in the file, already stored.
   *
   * Written during parse rather than commit so the admin can see them while
   * reviewing. An unused file is a few kilobytes of waste; a question published
   * without the map it refers to is unanswerable.
   */
  figures: ImportedFigure[];
  figureWarnings: string[];
}

/**
 * Extracts text from a PDF buffer.
 *
 * `unpdf` is imported dynamically so its (sizeable) bundle is only loaded when
 * an import actually happens, rather than on every server start.
 */
async function extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const { extractText: unpdfExtract, getDocumentProxy } = await import('unpdf');

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await unpdfExtract(pdf, { mergePages: true });

    return {
      text: Array.isArray(text) ? text.join('\n') : text,
      pageCount: totalPages,
    };
  } catch (error) {
    logger.error({ error }, 'PDF text extraction failed');
    throw new AppError(
      'BAD_REQUEST',
      'That file could not be read as a PDF. If it is password protected or corrupted, fix that first and try again.',
    );
  }
}

export async function importQuestionsFromPdf(
  buffer: Buffer,
  fileName: string,
): Promise<PdfImportResult> {
  if (buffer.byteLength === 0) {
    throw new AppError('BAD_REQUEST', 'That file is empty.');
  }
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new AppError(
      'BAD_REQUEST',
      `That file is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
    );
  }

  // Every PDF begins with this signature. Checking it gives a clear message
  // instead of a confusing parse failure when someone uploads a .docx.
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new AppError('BAD_REQUEST', 'That file is not a PDF.');
  }

  const { text, pageCount } = await extractText(buffer);
  const parsed = parseQuestionPaper(text);

  // Figures are best-effort: a paper with none is normal, and a failure to read
  // them must not cost the admin the questions that did parse.
  const figures: ImportedFigure[] = [];
  let figureWarnings: string[] = [];
  try {
    const { extractFigures } = await import('./pdf-figures');
    const { storeFigure } = await import('./figure-storage');
    const found = await extractFigures(buffer);
    figureWarnings = found.warnings;

    for (const figure of found.figures) {
      figures.push({
        questionNumber: figure.questionNumber,
        page: figure.page,
        url: await storeFigure(figure.data),
        width: figure.width,
        height: figure.height,
      });
    }
  } catch (error) {
    logger.error({ error, fileName }, 'Figure extraction failed');
    figureWarnings = ['Figures could not be read from this file; the questions are unaffected.'];
  }

  logger.info(
    {
      fileName,
      pageCount,
      found: parsed.stats.found,
      withAnswer: parsed.stats.withAnswer,
      figures: figures.length,
    },
    'PDF import parsed',
  );

  return {
    ...parsed,
    fileName,
    pageCount,
    // Capped: this is a diagnostic aid, not a document store.
    extractedText: text.slice(0, 20_000),
    figures,
    figureWarnings,
  };
}
