import { errors } from '@/lib/api';
import { route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { MAX_PDF_BYTES, importQuestionsFromPdf } from '@/server/services/pdf-import';

/**
 * POST /api/admin/import/parse — read a PDF and return what was found.
 *
 * Writes nothing. Parsing and committing are deliberately two separate calls so
 * a human sees exactly what the parser understood before any of it becomes a
 * question a student can be marked against.
 */
export const POST = route(
  async ({ request }) => {
    await requireAdmin();

    const form = await request.formData().catch(() => null);
    if (!form) throw errors.badRequest('Expected a file upload.');

    const file = form.get('file');
    if (!(file instanceof File)) throw errors.badRequest('No file was attached.');

    if (file.size > MAX_PDF_BYTES) {
      throw errors.badRequest(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importQuestionsFromPdf(buffer, file.name);

    return {
      data: result,
      message:
        result.stats.found === 0
          ? 'No questions were recognised in that file.'
          : `Found ${result.stats.found} question${result.stats.found === 1 ? '' : 's'}, ${result.stats.withAnswer} with an answer key.`,
      headers: { 'Cache-Control': 'no-store' },
    };
  },
  // Parsing a large PDF is expensive, so it gets its own tighter budget.
  { rateLimit: 'aiGenerate' },
);
