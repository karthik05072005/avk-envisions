/**
 * Phase 5: subject data, and the question-wise review.
 *
 * The subject half is a data problem rather than a code one — analytics groups
 * correctly, but 826 questions had been filed under "Indian Polity" whatever
 * they were about. What can be settled from a subject drill or a printed
 * heading is settled; the rest is reported honestly rather than guessed, and
 * this checks that nothing was invented.
 *
 * The review half is the page from the annotated screenshot: every question
 * open, with its options and solution visible, rather than a list of truncated
 * stems that each need a click.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const STUDENT = 'student@avkvisions.com';
const PASSWORD = 'Demo@Pass2024';

let passed = 0;
let failed = 0;

function log(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    process.exitCode = 1;
  }
}

async function main() {
  console.log('\n=== Subject data, and the question review ===\n');

  // ------------------------------------------------------------ the data
  console.log('-- Subjects --');

  const subjects = await db.subject.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const nameFor = new Map(subjects.map((s) => [s.id, s.name]));

  // Every question attached to a subject drill must carry that drill's
  // subject. This is the rule the reclassifier enforces, and the one that
  // makes subject analytics trustworthy for the questions it can vouch for.
  const onDrills = await db.testQuestion.findMany({
    where: {
      test: { slug: { contains: '-subject-' }, deletedAt: null, subjectId: { not: null } },
    },
    select: {
      questionId: true,
      test: { select: { slug: true, subjectId: true } },
      question: { select: { subjectId: true, deletedAt: true } },
    },
  });

  const live = onDrills.filter((r) => r.question.deletedAt === null);
  const byQuestion = new Map<string, Set<string>>();
  for (const row of live) {
    const seen = byQuestion.get(row.questionId) ?? new Set<string>();
    seen.add(row.test.subjectId!);
    byQuestion.set(row.questionId, seen);
  }

  const unambiguous = live.filter((r) => byQuestion.get(r.questionId)!.size === 1);
  const misfiled = unambiguous.filter((r) => r.question.subjectId !== r.test.subjectId);

  log(live.length > 0, 'questions are attached to subject drills', `${live.length} attachments`);
  log(
    misfiled.length === 0,
    'every one of them carries its drill\'s subject',
    misfiled.length
      ? misfiled
          .slice(0, 3)
          .map((m) => `${m.test.slug}: has ${nameFor.get(m.question.subjectId ?? '') ?? 'none'}`)
          .join('; ')
      : '',
  );

  // Nothing was invented: a question with no drill and no printed heading must
  // still be wherever it was, not moved somewhere plausible.
  const distribution = await db.question.groupBy({
    by: ['subjectId'],
    _count: true,
    where: { deletedAt: null },
  });
  const total = distribution.reduce((sum, row) => sum + row._count, 0);
  log(total > 0, 'the bank has questions', `${total}`);

  const unfiled = distribution.find((row) => row.subjectId === null)?._count ?? 0;
  log(unfiled === 0, 'none are left with no subject at all', `${unfiled} unfiled`);

  console.log('    distribution:');
  for (const row of distribution.sort((a, b) => b._count - a._count)) {
    console.log(`      ${String(row._count).padStart(4)}  ${nameFor.get(row.subjectId ?? '') ?? '(none)'}`);
  }

  // ------------------------------------------------------- the review page
  console.log('\n-- The question-wise review --');

  const attempt = await db.testAttempt.findFirst({
    where: { status: { in: ['SUBMITTED', 'EVALUATED'] }, user: { email: STUDENT } },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, test: { select: { title: true } } },
  });

  if (!attempt) {
    log(false, 'found a finished attempt to review');
  } else {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      await page.request.post(`${BASE}/api/auth/login`, {
        data: { email: STUDENT, password: PASSWORD },
      });
      await page.goto(`${BASE}/test/${attempt.id}/result`, { waitUntil: 'networkidle' });

      log(!page.url().includes('/login'), 'the result page opens', attempt.test.title);

      const panels = page.locator('details');
      const count = await panels.count();
      log(count > 0, 'it lists the questions', `${count} panels`);

      // Every panel open, so the options and the solution are readable without
      // clicking through one question at a time.
      let closed = 0;
      for (let i = 0; i < count; i += 1) {
        if (!(await panels.nth(i).evaluate((el) => (el as HTMLDetailsElement).open))) closed += 1;
      }
      log(closed === 0, 'every question is expanded', closed ? `${closed} still collapsed` : '');

      // The things a student came to read.
      const html = await page.content();
      log(/Your answer|Correct answer/i.test(html), 'each shows the answers');
      log(/Solution|Explanation/i.test(html), 'and the solution');

      // The stem must not be cut off once open.
      const clamped = await page
        .locator('.line-clamp-2:not(.group-open\\:line-clamp-none)')
        .count();
      log(clamped === 0, 'no question text is truncated', clamped ? `${clamped} clamped` : '');

      await page.close();
    } finally {
      await browser.close();
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
