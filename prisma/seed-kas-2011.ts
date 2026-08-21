/**
 * Loads KAS Prelims 2011 Paper I — all 100 questions — into the question bank
 * and wires them into the tests that already exist for that year.
 *
 * Two things happen here:
 *   1. Every question is created (or refreshed) against its subject.
 *   2. The full-length Paper I test gets all 100, and each subject-wise test
 *      for 2011 gets exactly the questions from its own subject.
 *
 * Idempotent: re-running updates wording, options and keys in place rather than
 * duplicating. Question codes are the natural key.
 *
 * Run with: npm run db:seed:2011
 */
import { PrismaClient } from '@prisma/client';

import { KAS_2011_PAPER1, type PaperQuestion } from './data/kas-2011-paper1';

const db = new PrismaClient();

/** The admin account that owns all seeded content. */
function adminEmail() {
  return (process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com').toLowerCase();
}

const EXAM_SLUG = 'kas';
const SOURCE = 'KAS Prelims 2011 — Paper I';
const EXAM_YEAR = 2011;
const FULL_TEST_SLUG = 'kas-pyq-2011-paper-1';
const MARKS = 1;
const NEGATIVE_MARKS = 0.25;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function codeFor(question: PaperQuestion) {
  return `KAS-2011-P1-${String(question.n).padStart(3, '0')}`;
}

/**
 * A one-line explanation derived from the answer key.
 *
 * Deliberately not a fabricated justification: the source paper supplies no
 * reasoning, and inventing 100 plausible-sounding explanations would put wrong
 * statements in front of students under the platform's own byline. Faculty can
 * replace these through the admin CMS.
 */
function explanationFor(question: PaperQuestion) {
  const answer = question.options[question.correct]!;
  const base = `The correct answer is option ${question.correct + 1}: ${answer}.`;

  return question.note
    ? `${base}\n\nNote: this item carries a review flag — see the question's review note.`
    : base;
}

async function main() {
  if (!(process.env.DATABASE_URL ?? '').startsWith('file:') && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error('Refusing to seed a non-file database. Set ALLOW_REMOTE_SEED=1 if intended.');
  }

  console.log('\nLoading KAS Prelims 2011 Paper I...\n');

  // Sanity checks before touching the database — a malformed key here would
  // silently mark real students wrong.
  const problems: string[] = [];
  const seen = new Set<number>();

  for (const question of KAS_2011_PAPER1) {
    if (seen.has(question.n)) problems.push(`duplicate question number ${question.n}`);
    seen.add(question.n);

    if (question.options.length !== 4) {
      problems.push(`Q${question.n} has ${question.options.length} options, expected 4`);
    }
    if (question.correct < 0 || question.correct >= question.options.length) {
      problems.push(`Q${question.n} has an out-of-range answer index (${question.correct})`);
    }
    if (new Set(question.options).size !== question.options.length) {
      problems.push(`Q${question.n} has duplicate option text`);
    }
  }

  for (let n = 1; n <= 100; n++) {
    if (!seen.has(n)) problems.push(`missing question ${n}`);
  }

  if (problems.length > 0) {
    console.error('Refusing to load — the paper failed validation:\n');
    for (const problem of problems) console.error(`  • ${problem}`);
    throw new Error(`${problems.length} validation problem(s)`);
  }
  console.log(`  ok  validated ${KAS_2011_PAPER1.length} questions\n`);

  const exam = await db.exam.findUnique({ where: { slug: EXAM_SLUG }, select: { id: true } });
  if (!exam) throw new Error('KAS exam not found — run `npm run db:seed:kas` first.');

  const author = await db.user.findUnique({
    where: { emailNormal: adminEmail() },
    select: { id: true },
  });
  const reviewer = await db.user.findUnique({
    where: { emailNormal: adminEmail() },
    select: { id: true },
  });
  if (!author || !reviewer) throw new Error('Admin account missing — run `npm run db:seed` first.');

  // --- Subjects ----------------------------------------------------------
  const subjectNames = [...new Set(KAS_2011_PAPER1.map((q) => q.subject))];
  const subjectIds = new Map<string, string>();

  for (const name of subjectNames) {
    const subject = await db.subject.findFirst({
      where: { examId: exam.id, slug: slugify(name) },
      select: { id: true },
    });
    if (!subject) {
      throw new Error(`Subject "${name}" not found — run \`npm run db:seed:catalogue\` first.`);
    }
    subjectIds.set(name, subject.id);
  }

  // --- Questions ---------------------------------------------------------
  const created = new Map<number, string>();
  let inserted = 0;
  let refreshed = 0;

  for (const question of KAS_2011_PAPER1) {
    const code = codeFor(question);
    const subjectId = subjectIds.get(question.subject)!;

    const existing = await db.question.findUnique({ where: { code }, select: { id: true } });

    if (existing) {
      await db.question.update({
        where: { id: existing.id },
        data: {
          subjectId,
          body: question.body,
          explanation: explanationFor(question),
          reviewNote: question.note ?? null,
          status: 'PUBLISHED',
        },
      });
      // Options are rebuilt so a corrected key actually takes effect on re-run.
      await db.questionOption.deleteMany({ where: { questionId: existing.id } });
      await db.questionOption.createMany({
        data: question.options.map((body, index) => ({
          questionId: existing.id,
          label: String.fromCharCode(65 + index),
          body,
          isCorrect: index === question.correct,
          sortOrder: index,
        })),
      });
      created.set(question.n, existing.id);
      refreshed += 1;
      continue;
    }

    const record = await db.question.create({
      data: {
        code,
        examId: exam.id,
        subjectId,
        type: 'SINGLE_CORRECT',
        // The paper does not grade its own questions; leaving every item at
        // MEDIUM is honest, and observed difficulty will replace it from real
        // attempt data as students answer.
        difficulty: 'MEDIUM',
        status: 'PUBLISHED',
        body: question.body,
        explanation: explanationFor(question),
        source: SOURCE,
        examYear: EXAM_YEAR,
        language: 'en',
        marks: MARKS,
        negativeMarks: NEGATIVE_MARKS,
        createdById: author.id,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewNote: question.note ?? null,
        publishedAt: new Date(),
        options: {
          create: question.options.map((body, index) => ({
            label: String.fromCharCode(65 + index),
            body,
            isCorrect: index === question.correct,
            sortOrder: index,
          })),
        },
        stat: { create: {} },
      },
      select: { id: true },
    });

    created.set(question.n, record.id);
    inserted += 1;
  }

  console.log(`  ok  ${inserted} questions created, ${refreshed} refreshed`);

  // --- Full-length paper --------------------------------------------------
  const fullTest = await db.test.findUnique({
    where: { slug: FULL_TEST_SLUG },
    select: { id: true, title: true },
  });
  if (!fullTest) throw new Error(`Test "${FULL_TEST_SLUG}" not found — run the catalogue seed.`);

  // Clear first so a re-run cannot leave a stale ordering behind.
  await db.testQuestion.deleteMany({ where: { testId: fullTest.id } });

  for (const question of KAS_2011_PAPER1) {
    await db.testQuestion.create({
      data: {
        testId: fullTest.id,
        questionId: created.get(question.n)!,
        sortOrder: question.n,
        marks: MARKS,
        negativeMarks: NEGATIVE_MARKS,
      },
    });
  }

  await db.test.update({
    where: { id: fullTest.id },
    data: {
      totalQuestions: KAS_2011_PAPER1.length,
      totalMarks: KAS_2011_PAPER1.length * MARKS,
      passingMarks: Math.round(KAS_2011_PAPER1.length * MARKS * 0.35),
    },
  });

  console.log(`  ok  ${KAS_2011_PAPER1.length} questions attached to "${fullTest.title}"`);

  // --- Subject-wise tests --------------------------------------------------
  let subjectTestsFilled = 0;

  for (const [name, subjectId] of subjectIds) {
    const slug = `kas-pyq-2011-subject-${slugify(name)}`;
    const test = await db.test.findUnique({ where: { slug }, select: { id: true } });
    if (!test) continue;

    const mine = KAS_2011_PAPER1.filter((q) => q.subject === name);

    await db.testQuestion.deleteMany({ where: { testId: test.id } });

    for (const [index, question] of mine.entries()) {
      await db.testQuestion.create({
        data: {
          testId: test.id,
          questionId: created.get(question.n)!,
          sortOrder: index + 1,
          marks: MARKS,
          negativeMarks: NEGATIVE_MARKS,
        },
      });
    }

    await db.test.update({
      where: { id: test.id },
      data: {
        totalQuestions: mine.length,
        totalMarks: mine.length * MARKS,
        // Roughly 1.2 minutes per question, floored so a tiny set still gets
        // a workable amount of time.
        durationMinutes: Math.max(10, Math.round(mine.length * 1.2)),
      },
    });

    console.log(`      ${name.padEnd(22)} ${String(mine.length).padStart(3)} questions`);
    subjectTestsFilled += 1;
  }

  console.log(`  ok  ${subjectTestsFilled} subject-wise tests filled`);

  // Subjects present in the catalogue but absent from this paper still have a
  // test row; report them so nobody wonders why they are empty.
  const emptySubjectTests = await db.test.count({
    where: { slug: { startsWith: 'kas-pyq-2011-subject-' }, totalQuestions: 0 },
  });
  if (emptySubjectTests > 0) {
    console.log(`  note: ${emptySubjectTests} subject test(s) have no questions in this paper.`);
  }

  const flagged = KAS_2011_PAPER1.filter((q) => q.note);
  if (flagged.length > 0) {
    console.log(`\n  ⚠  ${flagged.length} question(s) carry a review note:`);
    for (const q of flagged) console.log(`     Q${q.n} — ${q.note!.split('.')[0]}.`);
  }

  console.log('\nDone. View at /pyq/kas-pyq-2011\n');
}

main()
  .catch((error) => {
    console.error('\n2011 paper load failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
