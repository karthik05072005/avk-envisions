/**
 * Catalogue seed — the four course tracks students choose between.
 *
 *   1. FREE_SERIES  — scheduled sectional tests, free
 *   2. PAID_SERIES  — full-length tests with All India ranking
 *   3. PYQ          — previous year papers, year-wise (Paper 1 / Paper 2)
 *   4. CHAPTERWISE  — practice by standard reference book, subject-wise
 *
 * This seeds the *structure* only. Tests are created with their real question
 * count, which is zero until questions are attached — the catalogue UI shows
 * those as "content being added" rather than offering a Start button that would
 * fail. The one exception is the 2024 December Polity paper, which is wired to
 * the five real PYQ questions already in the bank.
 *
 * Run with: npm run db:seed:catalogue
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/** The admin account that owns all seeded content. */
function adminEmail() {
  return (process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com').toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The ten subjects a KAS Prelims paper is broken into, and their typical weight. */
const KAS_SUBJECTS: { name: string; questions: number; icon: string; color: string }[] = [
  // Indian and Karnataka history are taught and tested together, so they are a
  // single subject. General Studies was dropped: it overlapped Current Affairs
  // without describing a distinct body of questions.
  { name: 'History', questions: 24, icon: 'Landmark', color: '#b45309' },
  { name: 'Indian Economy', questions: 15, icon: 'IndianRupee', color: '#15803d' },
  { name: 'Geography', questions: 13, icon: 'Globe2', color: '#0891b2' },
  { name: 'Indian Polity', questions: 12, icon: 'Scale', color: '#4338ca' },
  { name: 'Current Affairs', questions: 12, icon: 'Newspaper', color: '#be123c' },
  { name: 'Science & Technology', questions: 8, icon: 'Atom', color: '#7c3aed' },
  { name: 'Environment', questions: 6, icon: 'Leaf', color: '#16a34a' },
  { name: 'Mental Ability', questions: 5, icon: 'Brain', color: '#db2777' },
];

/** Subjects folded into another, or dropped, after the catalogue was first seeded. */
const RETIRED_SUBJECTS: { slug: string; mergeIntoSlug?: string }[] = [
  { slug: 'indian-history', mergeIntoSlug: 'history' },
  { slug: 'karnataka-history', mergeIntoSlug: 'history' },
  { slug: 'general-studies' },
];

/** Previous-year papers KPSC has actually conducted. */
const PYQ_YEARS: { year: number; session?: string; papers: number[]; free?: boolean }[] = [
  // 2011 is the free sample: a complete, genuine KAS paper a student can
  // attempt end to end before paying for anything.
  { year: 2011, papers: [1, 2], free: true },
  { year: 2014, papers: [1, 2] },
  { year: 2015, papers: [1, 2] },
  { year: 2020, papers: [1, 2] },
  { year: 2024, session: 'August', papers: [1, 2] },
  { year: 2024, session: 'December', papers: [1, 2] },
];

/** Standard reference books the chapterwise track is organised around. */
const CHAPTERWISE_TRACKS = [
  {
    name: 'Polity',
    source: 'Laxmikanth',
    icon: 'Scale',
    color: '#4338ca',
    blurb: 'Chapterwise questions from Indian Polity by M. Laxmikanth.',
  },
  {
    name: 'History',
    source: 'Spectrum',
    icon: 'Castle',
    color: '#be123c',
    blurb: 'Chapterwise questions from Spectrum Modern India.',
  },
  {
    name: 'Geography',
    source: '11th & 12th NCERT',
    icon: 'Globe2',
    color: '#15803d',
    blurb: 'Chapterwise questions from NCERT Geography (11th & 12th).',
  },
  {
    name: 'Environment',
    source: 'Shankar IAS',
    icon: 'Leaf',
    color: '#7c3aed',
    blurb: 'Chapterwise questions from Environment by Shankar IAS.',
  },
  {
    name: 'Economy',
    source: 'Budget & Survey',
    icon: 'IndianRupee',
    color: '#ea580c',
    blurb: 'Chapterwise questions from the Union Budget and Economic Survey.',
  },
];

/** Phase 1 of the free series, as scheduled in the course plan. */
const FREE_SCHEDULE: { day: string; subject: string }[] = [
  { day: '2026-07-06', subject: 'Indian Polity and Constitution - 1' },
  { day: '2026-07-10', subject: 'Indian Polity and Constitution - 2' },
  { day: '2026-07-14', subject: 'Indian Economy - 1' },
  { day: '2026-07-18', subject: 'Indian Economy - 2' },
  { day: '2026-07-22', subject: 'Environment and Ecology - 1' },
  { day: '2026-07-25', subject: 'Environment and Ecology - 2' },
  { day: '2026-07-29', subject: 'Geography - Physical and Indian' },
  { day: '2026-08-01', subject: 'Karnataka Geography' },
  { day: '2026-08-05', subject: 'Ancient and Medieval Indian History' },
  { day: '2026-08-08', subject: 'Modern Indian History' },
  { day: '2026-08-12', subject: 'Karnataka History' },
  { day: '2026-08-18', subject: 'Science and Tech 1' },
  { day: '2026-08-22', subject: 'Science and Tech 2' },
  { day: '2026-08-26', subject: 'CSAT: Quantitative Aptitude' },
  { day: '2026-08-29', subject: 'CSAT: Logical Reasoning' },
  { day: '2026-09-02', subject: 'CSAT: Comprehension, DI, Quant & LR' },
  { day: '2026-09-05', subject: 'Current Affairs: National & International' },
  { day: '2026-09-09', subject: 'Current Affairs: State' },
  { day: '2026-09-12', subject: 'Current Affairs: Economic Survey & Budget' },
];

/** Standard instructions for a full 100-question, 2-hour paper. */
const FULL_PAPER_INSTRUCTIONS = [
  'This paper follows the actual KAS Prelims pattern.',
  '',
  '• 100 questions, 2 hours. Each question carries 1 mark.',
  '• 0.25 marks are deducted for every incorrect answer. Unanswered questions carry no penalty.',
  '• You may move freely between questions and mark any question for review.',
  '• Your answers save automatically. If your connection drops, resume and continue where you left off.',
  '• The timer runs on our servers, so closing the tab does not pause it. The paper is submitted automatically when time expires.',
].join('\n');

async function main() {
  if (!(process.env.DATABASE_URL ?? '').startsWith('file:') && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error('Refusing to seed a non-file database. Set ALLOW_REMOTE_SEED=1 if intended.');
  }

  console.log('\nSeeding catalogue tracks...\n');

  const exam = await db.exam.findUnique({ where: { slug: 'kas' }, select: { id: true } });
  if (!exam) throw new Error('KAS exam not found — run `npm run db:seed:kas` first.');

  const author = await db.user.findUnique({
    where: { emailNormal: adminEmail() },
    select: { id: true },
  });
  if (!author) throw new Error('Admin account missing — run `npm run db:seed` first.');

  const examId = exam.id;
  const authorId = author.id;

  // --- Subjects ----------------------------------------------------------
  const subjectIds = new Map<string, string>();
  for (const [index, subject] of KAS_SUBJECTS.entries()) {
    const record = await db.subject.upsert({
      where: { examId_slug: { examId, slug: slugify(subject.name) } },
      update: { colorHex: subject.color },
      create: {
        examId,
        name: subject.name,
        slug: slugify(subject.name),
        colorHex: subject.color,
        sortOrder: index + 1,
      },
      select: { id: true },
    });
    subjectIds.set(subject.name, record.id);
  }
  console.log(`  ok  ${KAS_SUBJECTS.length} subjects`);

  // --- Retire merged / dropped subjects -----------------------------------
  // The catalogue was first seeded with separate Indian and Karnataka history
  // subjects and a General Studies subject. Re-running must converge an
  // existing database rather than leave orphaned subjects on the site, so
  // questions are moved to the surviving subject *before* anything is deleted
  // — a subject delete would otherwise take real questions with it.
  for (const retired of RETIRED_SUBJECTS) {
    const old = await db.subject.findFirst({
      where: { examId, slug: retired.slug },
      select: { id: true, name: true },
    });
    if (!old) continue;

    let targetId: string | null = null;
    if (retired.mergeIntoSlug) {
      targetId =
        (
          await db.subject.findFirst({
            where: { examId, slug: retired.mergeIntoSlug },
            select: { id: true },
          })
        )?.id ?? null;

      if (!targetId) {
        throw new Error(
          `Cannot merge "${retired.slug}": target subject "${retired.mergeIntoSlug}" does not exist.`,
        );
      }
    }

    // A subject being dropped outright has nowhere to put its content, and
    // `Question.subjectId` is not nullable. Rather than delete real questions
    // to satisfy a config change, leave the subject in place and say so.
    if (!targetId) {
      const [questions, chapters] = await Promise.all([
        db.question.count({ where: { subjectId: old.id } }),
        db.chapter.count({ where: { subjectId: old.id } }),
      ]);
      if (questions > 0 || chapters > 0) {
        console.log(
          `  !!  "${old.name}" still holds ${questions} question(s) and ${chapters} chapter(s).` +
            ` Left in place — move them to another subject first, then re-run.`,
        );
        continue;
      }
    }

    const moved = targetId
      ? await db.question.updateMany({ where: { subjectId: old.id }, data: { subjectId: targetId } })
      : { count: 0 };
    if (targetId) {
      await db.chapter.updateMany({ where: { subjectId: old.id }, data: { subjectId: targetId } });
    }

    // Subject-wise tests for a retired subject have no meaning; their questions
    // live on in the full-length paper and the surviving subject's test.
    const staleTests = await db.test.findMany({
      where: { subjectId: old.id },
      select: { id: true, slug: true },
    });
    for (const test of staleTests) {
      const attempts = await db.testAttempt.count({ where: { testId: test.id } });
      if (attempts > 0) {
        // Somebody sat this paper. Detach it rather than destroy their result.
        await db.test.update({
          where: { id: test.id },
          data: { ...(targetId ? { subjectId: targetId } : {}), status: 'ARCHIVED' },
        });
        continue;
      }
      await db.testQuestion.deleteMany({ where: { testId: test.id } });
      await db.test.delete({ where: { id: test.id } });
    }

    await db.subject.delete({ where: { id: old.id } });
    console.log(
      `  ok  retired "${old.name}"${retired.mergeIntoSlug ? ` into ${retired.mergeIntoSlug}` : ''}` +
        ` (${moved.count} questions moved, ${staleTests.length} tests cleared)`,
    );
  }

  /** Creates a test, refreshing its metadata but never touching its questions. */
  async function upsertTest(input: {
    slug: string;
    title: string;
    seriesId: string;
    category: string;
    accessType: string;
    durationMinutes: number;
    description?: string;
    instructions?: string;
    paperNumber?: number;
    subjectId?: string;
    maxAttempts?: number;
    startDate?: Date;
  }) {
    return db.test.upsert({
      where: { slug: input.slug },
      // Rules and placement are refreshed on every run so a configuration
      // change here actually reaches existing rows; questions are never touched.
      update: {
        title: input.title,
        testSeriesId: input.seriesId,
        status: 'PUBLISHED',
        maxAttempts: input.maxAttempts ?? 2,
        accessType: input.accessType,
        durationMinutes: input.durationMinutes,
        paperNumber: input.paperNumber,
        subjectId: input.subjectId,
        startDate: input.startDate,
      },
      create: {
        examId,
        testSeriesId: input.seriesId,
        title: input.title,
        slug: input.slug,
        description: input.description,
        instructions: input.instructions ?? FULL_PAPER_INSTRUCTIONS,
        category: input.category,
        mode: 'EXAM',
        durationMinutes: input.durationMinutes,
        accessType: input.accessType,
        // Retakes are capped at two, per the course rules.
        maxAttempts: input.maxAttempts ?? 2,
        negativeMarkingEnabled: true,
        defaultNegativeRatio: 0.25,
        paperNumber: input.paperNumber,
        subjectId: input.subjectId,
        startDate: input.startDate,
        randomizeOptions: false,
        showResultImmediately: true,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: authorId,
      },
      select: { id: true },
    });
  }

  // --- 1. Free test series ----------------------------------------------
  const free = await db.testSeries.upsert({
    where: { slug: 'kas-prelims-free-test-series' },
    update: { track: 'FREE_SERIES', priceInPaise: 0, status: 'PUBLISHED' },
    create: {
      examId,
      name: 'KPSC KAS Prelims — Free Test Series',
      slug: 'kas-prelims-free-test-series',
      track: 'FREE_SERIES',
      iconName: 'ClipboardCheck',
      accentHex: '#15803d',
      tagline: 'Attempt free tests and evaluate your preparation level.',
      description:
        'A scheduled sectional test series covering the full KAS Prelims syllabus. Tests unlock on their scheduled date and are attempted in one sitting, exactly as in the real examination.',
      difficulty: 'MIXED',
      priceInPaise: 0,
      comparePriceInPaise: 0,
      accessDurationDays: 0,
      status: 'PUBLISHED',
      isFeatured: true,
      sortOrder: 1,
      featuresJson: JSON.stringify([
        'Sectional tests across the entire prelims syllabus',
        'Attempt on schedule, exactly like the real exam',
        'Detailed solutions and a synopsis after each test',
        'Performance report with subject-level accuracy',
        'Completely free',
      ]),
    },
    select: { id: true },
  });

  for (const [index, entry] of FREE_SCHEDULE.entries()) {
    await upsertTest({
      slug: `kas-free-${index + 1}-${slugify(entry.subject)}`,
      title: entry.subject,
      seriesId: free.id,
      category: 'SECTIONAL',
      accessType: 'FREE',
      durationMinutes: 120,
      startDate: new Date(`${entry.day}T00:00:00.000Z`),
      description: `Sectional test on ${entry.subject}.`,
    });
  }
  console.log(`  ok  free series + ${FREE_SCHEDULE.length} scheduled sectional tests`);

  // --- 2. Paid test series ----------------------------------------------
  const paid = await db.testSeries.upsert({
    where: { slug: 'kas-prelims-paid-test-series' },
    update: { track: 'PAID_SERIES', status: 'PUBLISHED' },
    create: {
      examId,
      name: 'KPSC KAS Prelims — Paid Test Series',
      slug: 'kas-prelims-paid-test-series',
      track: 'PAID_SERIES',
      iconName: 'ClipboardList',
      accentHex: '#ea580c',
      tagline: 'Full-length tests with detailed analysis and All India Ranking.',
      description:
        'Full-length mock tests modelled on the KAS Prelims pattern, each followed by a complete performance report: All India rank, percentile, subject and topic breakdowns, and a solution for every question.',
      difficulty: 'ADVANCED',
      priceInPaise: 249900,
      comparePriceInPaise: 399900,
      accessDurationDays: 365,
      status: 'PUBLISHED',
      isFeatured: true,
      sortOrder: 2,
      featuresJson: JSON.stringify([
        'Full-length tests in the exact prelims pattern',
        'All India Ranking and percentile after every test',
        'Subject, chapter and topic level analysis',
        'Detailed solution for every question',
        'Compare each attempt against your own history',
      ]),
    },
    select: { id: true },
  });

  for (let i = 1; i <= 6; i++) {
    await upsertTest({
      slug: `kas-paid-full-mock-${i}`,
      title: `KAS Prelims Full Mock Test ${i}`,
      seriesId: paid.id,
      category: 'FULL_MOCK',
      accessType: 'PAID',
      durationMinutes: 120,
      description: 'Full-length mock in the KAS Prelims pattern, with All India ranking.',
    });
  }
  console.log('  ok  paid series + 6 full mock tests');

  // --- 3. Previous year papers ------------------------------------------
  let pyqTests = 0;

  for (const [index, entry] of PYQ_YEARS.entries()) {
    const label = entry.session ? `${entry.session} ${entry.year}` : `${entry.year}`;
    const slug = entry.session
      ? `kas-pyq-${entry.year}-${slugify(entry.session)}`
      : `kas-pyq-${entry.year}`;

    const price = entry.free ? 0 : 99900;
    const comparePrice = entry.free ? 0 : 149900;
    const accessType = entry.free ? 'FREE' : 'PAID';

    const series = await db.testSeries.upsert({
      where: { slug },
      update: {
        track: 'PYQ',
        examYear: entry.year,
        sessionLabel: entry.session ?? null,
        status: 'PUBLISHED',
        // Refreshed every run so a pricing change here reaches existing rows.
        priceInPaise: price,
        comparePriceInPaise: comparePrice,
      },
      create: {
        examId,
        name: `${label} KAS Prelims`,
        slug,
        track: 'PYQ',
        examYear: entry.year,
        sessionLabel: entry.session ?? null,
        iconName: 'CalendarDays',
        tagline: `Attempt the full-length ${label} paper or practise it subject by subject.`,
        description: `The complete ${label} KAS Preliminary examination, reproduced in the real exam format with the actual timing and marking scheme. Attempt the full paper end to end, or drill a single subject using only the questions from that subject in this paper.`,
        difficulty: 'MIXED',
        priceInPaise: price,
        comparePriceInPaise: comparePrice,
        accessDurationDays: 365,
        status: 'PUBLISHED',
        sortOrder: index + 1,
        featuresJson: JSON.stringify([
          'Genuine previous-year paper, reproduced verbatim',
          'Real exam timing and marking scheme',
          'Full-length attempt plus subject-wise practice',
          'Detailed solution for every question',
        ]),
      },
      select: { id: true },
    });

    // Full-length papers
    for (const paper of entry.papers) {
      await upsertTest({
        slug: `${slug}-paper-${paper}`,
        title: `${label} Full-Length PYQ Test — Paper ${paper}`,
        seriesId: series.id,
        category: 'PREVIOUS_YEAR',
        accessType,
        durationMinutes: 120,
        paperNumber: paper,
        description: `Complete ${label} KAS Prelims Paper ${paper}.`,
      });
      pyqTests += 1;
    }

    // Subject-wise practice drawn from the same paper
    for (const subject of KAS_SUBJECTS) {
      await upsertTest({
        slug: `${slug}-subject-${slugify(subject.name)}`,
        title: `${subject.name} — ${label}`,
        seriesId: series.id,
        category: 'TOPIC',
        accessType,
        // Sized to the subject's share of the paper, at roughly 1.2 min/question.
        durationMinutes: Math.max(10, Math.round(subject.questions * 1.2)),
        subjectId: subjectIds.get(subject.name),
        // Capped at two like every other test, per the course rules. Raise this
        // to 0 (unlimited) if subject drills should be freely repeatable.
        maxAttempts: 2,
        description: `Only the ${subject.name} questions from the ${label} paper.`,
        instructions: [
          `This test contains only the ${subject.name} questions from the ${label} KAS Prelims paper.`,
          '',
          '• Each question carries 1 mark, with 0.25 deducted for an incorrect answer.',
          '• Unanswered questions carry no penalty.',
          '• Your answers save automatically as you go.',
        ].join('\n'),
      });
      pyqTests += 1;
    }
  }
  console.log(`  ok  ${PYQ_YEARS.length} PYQ papers + ${pyqTests} tests`);

  // --- 4. Chapterwise ----------------------------------------------------
  for (const [index, track] of CHAPTERWISE_TRACKS.entries()) {
    await db.testSeries.upsert({
      where: { slug: `chapterwise-${slugify(track.name)}` },
      update: { track: 'CHAPTERWISE', status: 'PUBLISHED' },
      create: {
        examId,
        name: `${track.name} (${track.source})`,
        slug: `chapterwise-${slugify(track.name)}`,
        track: 'CHAPTERWISE',
        iconName: track.icon,
        accentHex: track.color,
        tagline: track.blurb,
        description: `${track.blurb} Work through the book chapter by chapter, with a test for each chapter and a running record of which chapters you have actually mastered.`,
        difficulty: 'INTERMEDIATE',
        priceInPaise: 79900,
        comparePriceInPaise: 129900,
        accessDurationDays: 365,
        status: 'PUBLISHED',
        sortOrder: index + 1,
        featuresJson: JSON.stringify([
          `Questions mapped to every chapter of ${track.source}`,
          'Attempt a chapter at a time, at your own pace',
          'Chapter-level mastery tracking',
          'Detailed solution for every question',
        ]),
      },
    });
  }
  console.log(`  ok  ${CHAPTERWISE_TRACKS.length} chapterwise subjects`);

  // --- Wire the real Polity PYQs into the 2024 December subject test -----
  const polityTest = await db.test.findUnique({
    where: { slug: 'kas-pyq-2024-december-subject-indian-polity' },
    select: { id: true },
  });
  const realQuestions = await db.question.findMany({
    where: { code: { startsWith: 'KAS-PYQ-2024' } },
    orderBy: { code: 'asc' },
    select: { id: true, marks: true, negativeMarks: true },
  });

  if (polityTest && realQuestions.length > 0) {
    for (const [index, question] of realQuestions.entries()) {
      await db.testQuestion.upsert({
        where: { testId_questionId: { testId: polityTest.id, questionId: question.id } },
        update: { sortOrder: index + 1 },
        create: {
          testId: polityTest.id,
          questionId: question.id,
          sortOrder: index + 1,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
        },
      });
    }
    await db.test.update({
      where: { id: polityTest.id },
      data: {
        totalQuestions: realQuestions.length,
        totalMarks: realQuestions.reduce((sum, q) => sum + q.marks, 0),
      },
    });
    console.log(`  ok  wired ${realQuestions.length} real questions into 2024 December Polity`);
  }

  const empty = await db.test.count({ where: { totalQuestions: 0, status: 'PUBLISHED' } });
  console.log(`\n  note: ${empty} tests have no questions yet and show as "content being added".`);
  console.log('\nDone. View at /courses\n');
}

main()
  .catch((error) => {
    console.error('\nCatalogue seed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
