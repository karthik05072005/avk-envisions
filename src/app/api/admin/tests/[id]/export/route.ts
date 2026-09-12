import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';

/**
 * GET /api/admin/tests/[id]/export — one paper as a printable document.
 *
 * Returns HTML rather than a generated PDF. Every browser prints to PDF, and
 * the page it produces has selectable text, real page breaks and a header —
 * which is better than anything a server-side generator would emit here, and
 * adds no dependency. Opening it and pressing print is the whole workflow.
 *
 * Admin only: it prints the answer key beside every question.
 */
export const dynamic = 'force-dynamic';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Keeps the line structure the parser preserved, safely. */
function paragraphs(text: string): string {
  return escape(text)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => `<p>${line}</p>`)
    .join('');
}

/**
 * Written as a plain handler rather than through `route()`, which JSON-encodes
 * whatever it is given — this endpoint has to return HTML the browser will
 * render and print.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Caught rather than thrown: outside `route()` there is no error handler, so
  // an unauthorised request would surface as a 500 instead of being refused.
  try {
    await requireAdmin();
  } catch {
    return new Response('Not permitted.', { status: 403 });
  }

  const { id: testId } = await params;

  const test = await db.test.findFirst({
    where: { id: testId, deletedAt: null },
    select: {
      title: true,
      slug: true,
      durationMinutes: true,
      totalQuestions: true,
      totalMarks: true,
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          sortOrder: true,
          marks: true,
          question: {
            select: {
              code: true,
              body: true,
              explanation: true,
              subject: { select: { name: true } },
              options: {
                orderBy: { sortOrder: 'asc' },
                select: { label: true, body: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  if (!test) return new Response('Test not found.', { status: 404 });

  const rows = test.questions
    .map((row) => {
      const q = row.question;
      const options = q.options
        .map(
          (option) =>
            `<li class="${option.isCorrect ? 'right' : ''}">` +
            `<b>${escape(option.label)}.</b> ${escape(option.body)}` +
            `${option.isCorrect ? ' <span class="key">correct</span>' : ''}</li>`,
        )
        .join('');

      // A question with no key is called out rather than printed as though it
      // were finished — that is exactly what someone proof-reading needs to
      // catch.
      const unkeyed = q.options.every((option) => !option.isCorrect)
        ? '<p class="warn">No correct option is set.</p>'
        : '';

      return `
        <article>
          <header>
            <span class="num">${row.sortOrder}</span>
            <span class="meta">${escape(q.code ?? '')}${
              q.subject ? ` · ${escape(q.subject.name)}` : ''
            } · ${row.marks} mark${row.marks === 1 ? '' : 's'}</span>
          </header>
          <div class="stem">${paragraphs(q.body)}</div>
          <ol class="options">${options}</ol>
          ${unkeyed}
          ${
            q.explanation
              ? `<div class="explanation"><b>Explanation</b>${paragraphs(q.explanation)}</div>`
              : ''
          }
        </article>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(test.title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 28px;
    font: 12pt/1.5 Georgia, 'Times New Roman', serif; color: #111;
    max-width: 60rem;
  }
  h1 { font-size: 18pt; margin: 0 0 2px; }
  .sub { color: #555; font-size: 10pt; margin: 0 0 20px; }
  .hint { background: #f3f4f6; padding: 8px 12px; border-radius: 6px;
          font: 10pt/1.4 system-ui, sans-serif; color: #374151; margin-bottom: 20px; }
  article { border-top: 1px solid #ddd; padding: 14px 0; break-inside: avoid; }
  article header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .num { font-weight: 700; font-size: 13pt; }
  .meta { font: 9pt system-ui, sans-serif; color: #6b7280; }
  .stem p { margin: 0 0 6px; }
  .options { list-style: none; margin: 8px 0 0; padding: 0; }
  .options li { padding: 3px 0 3px 4px; }
  .options li.right { background: #ecfdf5; border-left: 3px solid #059669; padding-left: 8px; }
  .key { font: 8pt system-ui, sans-serif; color: #059669; text-transform: uppercase;
         letter-spacing: .06em; margin-left: 6px; }
  .warn { font: 9pt system-ui, sans-serif; color: #b91c1c; margin: 6px 0 0; }
  .explanation { margin-top: 10px; padding: 10px 12px; background: #fffbeb;
                 border-left: 3px solid #f59e0b; font-size: 11pt; }
  .explanation p { margin: 4px 0 0; }
  .explanation b { font: 9pt system-ui, sans-serif; text-transform: uppercase;
                   letter-spacing: .06em; color: #92400e; }
  @media print {
    body { padding: 0; max-width: none; }
    .hint { display: none; }
  }
</style>
</head>
<body>
  <h1>${escape(test.title)}</h1>
  <p class="sub">
    ${test.totalQuestions} question${test.totalQuestions === 1 ? '' : 's'} ·
    ${test.totalMarks} marks · ${test.durationMinutes} minutes · ${escape(test.slug)}
  </p>
  <p class="hint">Print this page (Ctrl/Cmd&nbsp;+&nbsp;P) and choose "Save as PDF".
  The answer key and explanations are included — this is a staff document.</p>
  ${rows || '<p>This paper has no questions yet.</p>'}
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Never cached: it carries the answer key.
      'Cache-Control': 'no-store',
    },
  });
}
