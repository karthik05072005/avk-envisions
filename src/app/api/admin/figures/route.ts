import { errors } from '@/lib/api';
import { route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { imageKind, storeFigure } from '@/server/services/figure-storage';

/**
 * POST /api/admin/figures — upload a diagram for a question.
 *
 * Many KAS questions are unanswerable without their figure, and the scanned
 * papers bake diagrams into the page image where no extractor can reach them.
 * Someone has to be able to crop one and attach it by hand; this is that path.
 *
 * The file's type is decided by its leading bytes, not its name or the
 * browser's content-type, because both are supplied by the caller. SVG is
 * refused: it can carry script, and these files are served from the site's own
 * origin.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const POST = route(async ({ request }) => {
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  if (!form) throw errors.badRequest('Expected a file upload.');

  const file = form.get('file');
  if (!(file instanceof File)) throw errors.badRequest('No image was attached.');

  if (file.size === 0) throw errors.badRequest('That file is empty.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw errors.badRequest(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = imageKind(buffer);
  if (!kind) {
    throw errors.badRequest('That is not a PNG, JPEG, GIF or WebP image.');
  }

  const url = await storeFigure(buffer, kind);

  return { data: { url }, message: 'Image uploaded.' };
});
