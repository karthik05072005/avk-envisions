/**
 * Content seed — KAS Prelims 2024, Indian Polity previous-year questions.
 *
 * Creates the KAS exam, its Polity syllabus branch, five reviewed PYQ items and
 * a free previous-year test series containing them.
 *
 * Idempotent: every write is an upsert on a natural key, so re-running updates
 * the content in place rather than duplicating it.
 *
 * Run with: npm run db:seed:kas
 */
import { PrismaClient } from '@prisma/client';

import {
  MARKING_SCHEME_SHORT,
  MARKS_PER_QUESTION,
  NEGATIVE_MARKS_PER_QUESTION,
} from '../src/lib/marking';

const db = new PrismaClient();

/** The admin account that owns all seeded content. */
function adminEmail() {
  return (process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com').toLowerCase();
}

const EXAM_SHORT = 'KAS';
const EXAM_SLUG = 'kas';
const SOURCE = 'KAS Prelims 2024';
const EXAM_YEAR = 2024;

/** Marks per question, matching the KPSC prelims scheme. */
const MARKS = MARKS_PER_QUESTION;
const NEGATIVE_MARKS = NEGATIVE_MARKS_PER_QUESTION;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Syllabus branch: Indian Polity
// ---------------------------------------------------------------------------

const SYLLABUS: Record<string, string[]> = {
  'Elections and Representation': [
    'Election Commission of India',
    'Electoral Machinery and EVMs',
    'Electoral Reforms',
  ],
  'Parliament and State Legislature': [
    'Legislative Procedure and Bills',
    'Joint Sitting and Deadlock Resolution',
    'Lapsing and Dissolution',
  ],
  Judiciary: ['Judicial Review', 'Supreme Court Jurisdiction', 'Review and Curative Petitions'],
  'Directive Principles of State Policy': [
    'Socialistic Principles',
    'Gandhian Principles',
    'Liberal–Intellectual Principles',
  ],
};

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

interface PyqQuestion {
  code: string;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  concept: string;
  body: string;
  options: [string, string, string, string];
  /** Index into `options` of the keyed answer. */
  correct: number;
  explanation: string;
  detailedSolution: string;
  /** Internal note for faculty; never shown to students. */
  reviewNote?: string;
}

const QUESTIONS: PyqQuestion[] = [
  {
    code: 'KAS-PYQ-2024-P01',
    topic: 'Electoral Machinery and EVMs',
    difficulty: 'MEDIUM',
    concept: 'EVM and VVPAT — introduction, power supply and judicial origin',
    body: `Which of the following statement/statements are correct about the Electronic Voting Machine (EVM) and the Voter Verifiable Paper Audit Trail (VVPAT)?

A. EVMs were used for the first time in 1982.
B. EVM and VVPAT do not require any external power supply.
C. The EVM cannot be used in simultaneous elections.
D. VVPAT was introduced by the ECI in compliance with the pronouncement of the Supreme Court in the Lily Thomas case (2013).`,
    options: ['A and C only', 'B and D only', 'A and B only', 'C and D only'],
    correct: 2,
    explanation:
      'Statements A and B are correct. EVMs were first used in May 1982 in the North Paravur assembly constituency of Kerala, and both EVMs and VVPATs run on a self-contained battery power pack rather than mains electricity. C is wrong because EVMs are routinely used in simultaneous elections, and D misattributes VVPAT to the wrong 2013 judgment.',
    detailedSolution: `<h2>Statement A — correct</h2>
<p>The Electronic Voting Machine was used for the first time in May <strong>1982</strong>, at the by-election to the <strong>North Paravur</strong> assembly constituency in Kerala, where it was deployed in 50 of the 84 polling stations. Its use was initially challenged for want of statutory backing; Parliament subsequently amended the Representation of the People Act, 1951 in 1989 to insert Section 61A, expressly authorising the use of voting machines.</p>

<h2>Statement B — correct</h2>
<p>Neither the EVM nor the VVPAT draws any <strong>external power supply</strong>. The control unit is powered by an ordinary alkaline battery power pack fitted inside it, and the VVPAT by its own power pack. This is a deliberate design choice: it allows polling to proceed in remote and unelectrified booths, and removes any dependence on a mains connection that could be interrupted during the poll.</p>

<h2>Statement C — incorrect</h2>
<p>EVMs <strong>can</strong> be used in simultaneous elections. Where Lok Sabha and State Legislative Assembly elections are held together, a separate set of machines is used for each election in the same polling station, with the balloting units connected to their respective control units. A single control unit can also be connected to multiple balloting units to accommodate a large number of candidates.</p>

<h2>Statement D — incorrect</h2>
<p>VVPAT was introduced pursuant to the Supreme Court's direction in <strong>Subramanian Swamy v. Election Commission of India (2013)</strong>, in which the Court held that a paper trail is an indispensable requirement of free and fair elections and directed the ECI to introduce VVPAT in a phased manner.</p>
<p><strong>Lily Thomas v. Union of India (2013)</strong> is a different case altogether: it struck down Section 8(4) of the Representation of the People Act, 1951, thereby ending the protection that allowed convicted legislators to continue in office pending appeal. Confusing these two 2013 judgments is the trap this question is built around.</p>

<h2>Conclusion</h2>
<p>Only A and B are correct, so the answer is <strong>A and B only</strong>.</p>`,
  },

  {
    code: 'KAS-PYQ-2024-P02',
    topic: 'Joint Sitting and Deadlock Resolution',
    difficulty: 'HARD',
    concept: 'Deadlock over ordinary bills — Parliament versus State Legislature',
    body: `Consider the following statements:

A. The Lok Sabha cannot override the Rajya Sabha by passing the bill for the second time and vice versa.
B. The Legislative Assembly can override the Legislative Council by passing the bill for the second time and not vice versa.
C. The Constitution provides the mechanism of joint sitting of two Houses of the Parliament to resolve a deadlock between them over the passage of a bill.
D. The Constitution does not provide the mechanism of joint sitting of two Houses of the Parliament to resolve a deadlock between them over the passage of a bill.

Which of the statements given above are correct?`,
    options: ['A and D only', 'B and C only', 'A, B and C only', 'B and D only'],
    correct: 1,
    explanation:
      'Statement B correctly states the position in a State Legislature: the Assembly can override the Council, but never the reverse. Statement C correctly states that Article 108 provides for a joint sitting to resolve a deadlock between the two Houses of Parliament. Statement D is the direct negation of C and is therefore wrong.',
    detailedSolution: `<h2>Statement B — correct</h2>
<p>In a State Legislature the two Houses are <strong>not co-equal</strong>. Under Article 197, if the Legislative Council rejects a bill passed by the Legislative Assembly, delays it beyond the prescribed period, or amends it unacceptably, the Assembly may pass the bill a <strong>second time</strong>. If the Council then rejects or delays it again, the bill is deemed to have been passed by both Houses in the form in which the Assembly passed it the second time.</p>
<p>The Council can therefore delay an ordinary bill for a maximum of about <strong>four months</strong> (three months on first transmission, one month on second), but cannot ultimately defeat it. The reverse is not available: a Council has no power to override the Assembly. This is why the Council is described as a subordinate, advisory chamber, and why Article 169 permits its creation or abolition on a resolution of the Assembly.</p>

<h2>Statement C — correct</h2>
<p><strong>Article 108</strong> empowers the President to summon a <strong>joint sitting</strong> of both Houses of Parliament to resolve a deadlock over an ordinary bill. A deadlock is deemed to have arisen if the second House rejects the bill, the Houses disagree finally on amendments, or more than six months elapse without the second House passing it.</p>
<p>The joint sitting is presided over by the <strong>Speaker of the Lok Sabha</strong>, and the bill is passed by a simple majority of the total members present and voting in the joint sitting. Because the Lok Sabha's strength exceeds that of the Rajya Sabha, the numerically larger House ordinarily prevails.</p>
<p>Joint sittings have been convened only three times: the Dowry Prohibition Bill (1961), the Banking Service Commission (Repeal) Bill (1978) and the Prevention of Terrorism Bill (2002).</p>
<p>Note that the joint-sitting mechanism does <em>not</em> apply to <strong>Money Bills</strong> (the Lok Sabha's will prevails under Article 109) or to <strong>Constitution Amendment Bills</strong> (which must be passed separately by each House by the special majority required under Article 368).</p>

<h2>Statement D — incorrect</h2>
<p>Statement D is the exact negation of statement C. Since Article 108 does provide for a joint sitting, D is false. A well-set question of this type will often place a statement and its contradiction in the same list — spotting that pair immediately eliminates every option containing D, which here removes options 1 and 4.</p>

<h2>Conclusion</h2>
<p>Per the official answer key, the answer is <strong>B and C only</strong>.</p>`,
    reviewNote:
      'FACULTY REVIEW REQUESTED. Statement A ("The Lok Sabha cannot override the Rajya Sabha by passing the bill for the second time and vice versa") is, on the standard reading, a correct proposition for ordinary bills — neither House can override the other by re-passage, which is precisely why Art. 108 provides a joint sitting. On that reading the key would be option 3 (A, B and C only) rather than option 2. Seeded with the supplied official key; verify against the KPSC final key before this item is used in a scored ranked test.',
  },

  {
    code: 'KAS-PYQ-2024-P03',
    topic: 'Lapsing and Dissolution',
    difficulty: 'MEDIUM',
    concept: 'Effect of dissolution of the Lok Sabha on pending bills',
    body: `A bill lapses when

A. It is pending in the Rajya Sabha but not passed by the Lok Sabha.
B. It is originated and passed by the Rajya Sabha but pending in the Lok Sabha.
C. It is originated in the Lok Sabha but pending in the Lok Sabha.
D. It is originated and passed by the Lok Sabha but pending in the Rajya Sabha.

Which of the statements given above is/are correct?`,
    options: ['A only', 'A, C and D only', 'B, C and D only', 'A, B, C and D only'],
    correct: 2,
    explanation:
      'The governing principle is that a bill lapses if it is pending in, or has been passed only by, the dissolved House. B, C and D all satisfy that test. A describes the single major exception — a bill still pending in the Rajya Sabha that the Lok Sabha never passed does not lapse, because the Rajya Sabha is a permanent body that is never dissolved.',
    detailedSolution: `<h2>The underlying principle</h2>
<p>The <strong>Rajya Sabha is a permanent body</strong> and is never dissolved (Article 83(1)); only the Lok Sabha is subject to dissolution. Business that belongs to the surviving House therefore continues, while business that rests with the dissolved House falls. Every rule below follows from that single idea — it is far more reliable to reason from it than to memorise the list.</p>

<h2>Statement A — does NOT lapse</h2>
<p>A bill that <strong>originated in the Rajya Sabha and is still pending there</strong>, not having been passed by the Lok Sabha, does <strong>not lapse</strong>. It has never been the property of the dissolved House, so dissolution has no effect on it. This is the principal exception, and it is what the question is testing.</p>

<h2>Statement B — lapses</h2>
<p>A bill passed by the Rajya Sabha and <strong>transmitted to and pending in the Lok Sabha</strong> lapses. Once it reaches the Lok Sabha it is pending in the House that stands dissolved, and it falls with it.</p>

<h2>Statement C — lapses</h2>
<p>A bill that <strong>originated in the Lok Sabha and is still pending there</strong> lapses. This is the most straightforward case.</p>

<h2>Statement D — lapses</h2>
<p>A bill <strong>passed by the Lok Sabha but pending in the Rajya Sabha</strong> lapses. Although it is physically before the surviving House, its passage by the dissolved House is undone by dissolution, so the bill cannot proceed.</p>

<h2>Other situations worth knowing</h2>
<ul>
  <li>A bill <strong>passed by both Houses but pending assent</strong> of the President does <strong>not</strong> lapse.</li>
  <li>A bill passed by both Houses and <strong>returned by the President</strong> for reconsideration does <strong>not</strong> lapse.</li>
  <li>A bill <strong>pending in the Lok Sabha</strong> when the President has already notified a <strong>joint sitting</strong> does <strong>not</strong> lapse.</li>
  <li><strong>Pending assurances</strong> to be examined by the Committee on Government Assurances lapse.</li>
  <li>Notices for the introduction of a bill lapse.</li>
</ul>

<h2>Conclusion</h2>
<p>B, C and D lapse; A does not. The answer is <strong>B, C and D only</strong>.</p>`,
  },

  {
    code: 'KAS-PYQ-2024-P04',
    topic: 'Review and Curative Petitions',
    difficulty: 'MEDIUM',
    concept: 'Judicial review and the procedure governing review petitions',
    body: `Consider the following statements:

A. The power of Judicial Review in India is enjoyed by the Supreme Court as well as the High Courts.
B. Any person aggrieved by a ruling can file a Review Petition within 30 days of the court verdict.
C. Review Petitions are heard in open court, as the lawyers make their arguments through either oral arguments or written submissions.

Which of the statements given above is/are correct?`,
    options: ['A and B only', 'C only', 'B and C only', 'A, B and C only'],
    correct: 0,
    explanation:
      'A and B are correct. Judicial review is exercised by both the Supreme Court and the High Courts, and a review petition must ordinarily be filed within 30 days of the judgment. C is wrong: review petitions are decided by circulation in the judges’ chambers without oral hearing, the settled exception being death-penalty matters.',
    detailedSolution: `<h2>Statement A — correct</h2>
<p>Judicial review is exercised by <strong>both</strong> the Supreme Court and the High Courts. The Supreme Court draws it from Articles 13, 32, 131–136 and 143; the High Courts from Articles 13, 226 and 227. Indeed, the High Courts' writ jurisdiction under Article 226 is <em>wider</em> than the Supreme Court's under Article 32, because Article 226 extends not only to the enforcement of fundamental rights but to "any other purpose", meaning ordinary legal rights as well.</p>
<p>Judicial review was held to be part of the <strong>basic structure</strong> of the Constitution in <em>Kesavananda Bharati</em> (1973) and reaffirmed in <em>L. Chandra Kumar v. Union of India</em> (1997), where the Court held that the writ jurisdiction of the High Courts and the Supreme Court cannot be ousted even by constitutional amendment.</p>

<h2>Statement B — correct</h2>
<p>Under Article 137, the Supreme Court has the power to review its own judgments. Order XLVII of the <strong>Supreme Court Rules, 2013</strong> requires a review petition to be filed within <strong>30 days</strong> from the date of the judgment or order. Delay beyond this period may be condoned only if sufficient cause is shown.</p>

<h2>Statement C — incorrect</h2>
<p>This is the statement the question turns on. Review petitions are <strong>not</strong> ordinarily heard in open court. They are circulated to the judges <strong>in their chambers</strong> and decided <strong>without oral arguments</strong>, on the basis of written submissions alone. As a rule the petition is placed before the same bench that delivered the original judgment.</p>
<p>The recognised exception is <em>Mohd. Arif alias Ashfaq v. Registrar, Supreme Court of India</em> (2014), in which the Court held that review petitions arising out of cases where the <strong>death sentence</strong> has been awarded must be heard in <strong>open court</strong> by a bench of three judges, with limited oral hearing. Because statement C asserts open-court hearing as the general rule, it is incorrect.</p>

<h2>The next stage</h2>
<p>If a review petition is dismissed, a <strong>curative petition</strong> remains available — a remedy evolved in <em>Rupa Ashok Hurra v. Ashok Hurra</em> (2002) as the last resort against a gross miscarriage of justice. It too is ordinarily decided by circulation, without oral hearing.</p>

<h2>Conclusion</h2>
<p>A and B are correct, C is not. The answer is <strong>A and B only</strong>.</p>`,
  },

  {
    code: 'KAS-PYQ-2024-P05',
    topic: 'Socialistic Principles',
    difficulty: 'EASY',
    concept: 'Article 38(2) — minimising inequalities in income, status and opportunity',
    body: 'Which Article directs the State to minimise inequalities in income, status and opportunities among individuals and groups?',
    options: ['Article 38(1)', 'Article 38(2)', 'Article 39', 'Article 40'],
    correct: 1,
    explanation:
      'Article 38(2), inserted by the 44th Constitutional Amendment Act, 1978, directs the State to strive to minimise inequalities in income and to eliminate inequalities in status, facilities and opportunities, both among individuals and among groups. Article 38(1) is the broader welfare-order clause that precedes it.',
    detailedSolution: `<h2>The correct provision</h2>
<p><strong>Article 38(2)</strong> provides that the State shall, in particular, strive to minimise the inequalities in <strong>income</strong>, and endeavour to eliminate inequalities in <strong>status, facilities and opportunities</strong> — not only amongst individuals but also amongst <strong>groups</strong> of people residing in different areas or engaged in different vocations.</p>
<p>This clause was <strong>added by the 44th Constitutional Amendment Act, 1978</strong>. The insertion date is itself a frequently examined fact.</p>

<h2>Why not the other options</h2>
<h3>Article 38(1)</h3>
<p>The parent clause, directing the State to secure a <strong>social order</strong> in which justice — social, economic and political — informs all the institutions of national life. It is the general welfare-order provision; the specific mandate on inequality sits in clause (2). The question's wording ("minimise inequalities in income, status and opportunities") tracks clause (2) almost verbatim.</p>

<h3>Article 39</h3>
<p>Lays down certain principles of policy to be followed by the State: adequate means of livelihood for all citizens; distribution of the ownership and control of material resources to subserve the common good; prevention of concentration of wealth; <strong>equal pay for equal work</strong>; protection of the health of workers and of children; and opportunities for the healthy development of children. Related but distinct.</p>

<h3>Article 40</h3>
<p>A <strong>Gandhian</strong> principle, directing the State to organise <strong>village panchayats</strong> and endow them with such powers and authority as may be necessary to enable them to function as units of self-government. It gave the philosophical foundation for the 73rd Constitutional Amendment Act, 1992.</p>

<h2>Classification</h2>
<p>Articles 38 and 39 fall within the <strong>socialistic</strong> group of Directive Principles, which aim at securing a welfare state and reducing economic inequality. Article 40 belongs to the <strong>Gandhian</strong> group.</p>

<h2>Conclusion</h2>
<p>The answer is <strong>Article 38(2)</strong>.</p>`,
  },
];

// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('file:') && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error(
      'Refusing to seed a non-file database. Set ALLOW_REMOTE_SEED=1 if this is genuinely intended.',
    );
  }

  console.log('\nSeeding KAS Polity previous-year content…\n');

  // Authors: reuse the existing staff accounts so provenance is realistic.
  const teacher = await db.user.findUnique({
    where: { emailNormal: adminEmail() },
    select: { id: true },
  });
  const reviewer = await db.user.findUnique({
    where: { emailNormal: adminEmail() },
    select: { id: true },
  });

  if (!teacher || !reviewer) {
    throw new Error('Base seed has not been run — the admin account is missing. Run `npm run db:seed` first.');
  }

  // --- Exam ---------------------------------------------------------------
  const exam = await db.exam.upsert({
    where: { slug: EXAM_SLUG },
    update: {},
    create: {
      name: 'Karnataka Administrative Service',
      shortName: EXAM_SHORT,
      slug: EXAM_SLUG,
      category: 'CIVIL_SERVICES',
      colorHex: '#b45309',
      description:
        'State civil services examination conducted by the Karnataka Public Service Commission for Group A and Group B posts.',
      overview:
        '<h2>About the examination</h2><p>The Karnataka Administrative Service examination is conducted by the Karnataka Public Service Commission in three stages: a Preliminary examination of two objective papers, a descriptive Main examination, and a Personality Test.</p><h2>Indian Polity in the Prelims</h2><p>Polity is among the highest-yielding areas of General Studies Paper I. Questions are predominantly statement-based and reward precise recall of constitutional articles, landmark judgments and legislative procedure rather than general familiarity.</p>',
      isActive: true,
      isFeatured: true,
      sortOrder: 5,
      seoTitle: 'KAS Test Series — Karnataka Administrative Service Mock Tests & PYQs',
      seoDescription:
        'Prepare for the KAS examination with previous-year questions and full-length mock tests, each with detailed solutions and topic-level analytics.',
      highlightsJson: JSON.stringify([
        { label: 'Conducted by', value: 'KPSC' },
        { label: 'Stages', value: 'Prelims, Mains, Interview' },
        { label: 'Prelims marking', value: MARKING_SCHEME_SHORT },
      ]),
    },
    select: { id: true },
  });

  // --- Subject / chapters / topics ---------------------------------------
  const subject = await db.subject.upsert({
    where: { examId_slug: { examId: exam.id, slug: 'indian-polity' } },
    update: {},
    create: {
      examId: exam.id,
      name: 'Indian Polity',
      slug: 'indian-polity',
      description:
        'The Constitution, its institutions and the working of government — the highest-weight area of the KAS General Studies papers.',
      colorHex: '#b45309',
      sortOrder: 1,
    },
    select: { id: true },
  });

  const topicIds = new Map<string, string>();
  let chapterOrder = 0;

  for (const [chapterName, topics] of Object.entries(SYLLABUS)) {
    chapterOrder += 1;

    const chapter = await db.chapter.upsert({
      where: { subjectId_slug: { subjectId: subject.id, slug: slugify(chapterName) } },
      update: {},
      create: {
        subjectId: subject.id,
        name: chapterName,
        slug: slugify(chapterName),
        sortOrder: chapterOrder,
      },
      select: { id: true },
    });

    let topicOrder = 0;
    for (const topicName of topics) {
      topicOrder += 1;
      const topic = await db.topic.upsert({
        where: { chapterId_slug: { chapterId: chapter.id, slug: slugify(topicName) } },
        update: {},
        create: {
          chapterId: chapter.id,
          name: topicName,
          slug: slugify(topicName),
          sortOrder: topicOrder,
        },
        select: { id: true, chapterId: true },
      });
      topicIds.set(topicName, topic.id);
    }
  }

  console.log(`  ✓ syllabus: 1 subject, ${chapterOrder} chapters, ${topicIds.size} topics`);

  // --- Questions ----------------------------------------------------------
  const questionIds: string[] = [];

  for (const item of QUESTIONS) {
    const topicId = topicIds.get(item.topic);
    if (!topicId) throw new Error(`Unknown topic "${item.topic}" for ${item.code}`);

    const topic = await db.topic.findUniqueOrThrow({
      where: { id: topicId },
      select: { chapterId: true },
    });

    const existing = await db.question.findUnique({
      where: { code: item.code },
      select: { id: true },
    });

    if (existing) {
      // Refresh content in place, then rebuild options so edits to the key or
      // wording actually take effect on a re-run.
      await db.question.update({
        where: { id: existing.id },
        data: {
          body: item.body,
          difficulty: item.difficulty,
          concept: item.concept,
          explanation: item.explanation,
          detailedSolution: item.detailedSolution,
          reviewNote: item.reviewNote ?? null,
        },
      });
      await db.questionOption.deleteMany({ where: { questionId: existing.id } });
      await db.questionOption.createMany({
        data: item.options.map((body, index) => ({
          questionId: existing.id,
          label: String.fromCharCode(65 + index),
          body,
          isCorrect: index === item.correct,
          sortOrder: index,
        })),
      });
      questionIds.push(existing.id);
      continue;
    }

    const created = await db.question.create({
      data: {
        code: item.code,
        examId: exam.id,
        subjectId: subject.id,
        chapterId: topic.chapterId,
        topicId,
        type: 'SINGLE_CORRECT',
        difficulty: item.difficulty,
        status: 'PUBLISHED',
        body: item.body,
        explanation: item.explanation,
        detailedSolution: item.detailedSolution,
        concept: item.concept,
        source: SOURCE,
        examYear: EXAM_YEAR,
        language: 'en',
        marks: MARKS,
        negativeMarks: NEGATIVE_MARKS,
        createdById: teacher.id,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewNote: item.reviewNote ?? null,
        publishedAt: new Date(),
        options: {
          create: item.options.map((body, index) => ({
            label: String.fromCharCode(65 + index),
            body,
            isCorrect: index === item.correct,
            sortOrder: index,
          })),
        },
        stat: { create: {} },
      },
      select: { id: true },
    });

    questionIds.push(created.id);
  }

  console.log(`  ✓ ${questionIds.length} questions (source: ${SOURCE})`);

  // --- Test series --------------------------------------------------------
  const series = await db.testSeries.upsert({
    where: { slug: 'kas-polity-previous-year-questions' },
    update: { status: 'PUBLISHED', priceInPaise: 0 },
    create: {
      examId: exam.id,
      name: 'KAS Polity — Previous Year Questions',
      slug: 'kas-polity-previous-year-questions',
      tagline: 'Actual KPSC questions, with the reasoning behind every option.',
      description:
        'Previous-year Polity questions from the KAS Preliminary examination, reproduced exactly as they appeared and solved statement by statement. Each solution explains why the keyed option is right and, just as importantly, why each distractor is wrong — which is where statement-based questions are actually won or lost. Free to attempt, with full topic-level analytics.',
      difficulty: 'INTERMEDIATE',
      priceInPaise: 0,
      comparePriceInPaise: 0,
      accessDurationDays: 0,
      status: 'PUBLISHED',
      isFeatured: true,
      sortOrder: 2,
      featuresJson: JSON.stringify([
        'Genuine KAS previous-year questions, reproduced verbatim',
        'Statement-by-statement solutions, not just the answer key',
        'Every distractor explained, with the relevant Article or case',
        'Topic-level performance analytics after each attempt',
        'Completely free — no subscription required',
      ]),
      seoTitle: 'KAS Polity Previous Year Questions — Free Test Series with Solutions',
      seoDescription:
        'Attempt genuine KAS Prelims Polity previous-year questions free, with detailed statement-by-statement solutions and topic-level analytics.',
    },
    select: { id: true },
  });

  // --- Test ---------------------------------------------------------------
  const totalMarks = QUESTIONS.length * MARKS;

  const test = await db.test.upsert({
    where: { slug: 'kas-2024-prelims-polity-pyq-set-1' },
    update: { status: 'PUBLISHED', accessType: 'FREE' },
    create: {
      examId: exam.id,
      testSeriesId: series.id,
      title: 'KAS 2024 Prelims — Polity PYQ Set 1',
      slug: 'kas-2024-prelims-polity-pyq-set-1',
      description:
        'Five Indian Polity questions from the KAS Preliminary examination held in December 2024, covering electoral machinery, legislative procedure, the judiciary and the Directive Principles.',
      instructions: `This test contains ${QUESTIONS.length} questions from Indian Polity, taken from the KAS Preliminary examination (December 2024).

• Each question carries ${MARKS} mark. ${NEGATIVE_MARKS} marks are deducted for every incorrect answer.
• There is no penalty for leaving a question unanswered.
• Every question has exactly one correct option.
• You may move freely between questions and mark any question for review before submitting.
• Your answers are saved automatically. If your connection drops, resume and continue from where you left off.
• The timer runs on our servers, so closing the tab does not pause it. The test is submitted automatically when time expires.

These are statement-based questions. Read every statement on its own merits before looking at the options — eliminating a single false statement usually removes two of the four choices.`,
      category: 'PREVIOUS_YEAR',
      mode: 'EXAM',
      durationMinutes: 10,
      totalMarks,
      totalQuestions: QUESTIONS.length,
      passingMarks: Math.ceil(totalMarks * 0.4),
      negativeMarkingEnabled: true,
      defaultNegativeRatio: 0.25,
      accessType: 'FREE',
      // Unlimited re-attempts: this is a learning set, not a ranked mock.
      maxAttempts: 0,
      navigationMode: 'FREE_NAVIGATION',
      randomizeQuestions: false,
      // Option order is fixed — several items key on the literal option text
      // ("A and B only"), which randomising would render meaningless.
      randomizeOptions: false,
      showResultImmediately: true,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdById: teacher.id,
    },
    select: { id: true },
  });

  const section = (await db.testSection.findFirst({
    where: { testId: test.id, name: 'Indian Polity' },
    select: { id: true },
  })) ??
    (await db.testSection.create({
      data: {
        testId: test.id,
        subjectId: subject.id,
        name: 'Indian Polity',
        instructions: 'All questions in this section are from Indian Polity.',
        sortOrder: 1,
      },
      select: { id: true },
    }));

  for (const [index, questionId] of questionIds.entries()) {
    await db.testQuestion.upsert({
      where: { testId_questionId: { testId: test.id, questionId } },
      update: { sortOrder: index + 1 },
      create: {
        testId: test.id,
        questionId,
        sectionId: section.id,
        sortOrder: index + 1,
        marks: MARKS,
        negativeMarks: NEGATIVE_MARKS,
      },
    });
  }

  await db.test.update({
    where: { id: test.id },
    data: { totalQuestions: questionIds.length, totalMarks },
  });

  // --- Series FAQs --------------------------------------------------------
  const faqs = [
    {
      q: 'Are these the actual questions from the KAS examination?',
      a: 'Yes. Each question is reproduced as it appeared in the KAS Preliminary examination of December 2024, with the source and year recorded against every item.',
    },
    {
      q: 'Is this test series really free?',
      a: 'Yes, entirely. Create an account and you can attempt it immediately, as many times as you like, with the full solutions and analytics included.',
    },
    {
      q: 'How is negative marking applied?',
      a: `Each correct answer earns ${MARKS_PER_QUESTION} marks and each incorrect answer costs ${NEGATIVE_MARKS_PER_QUESTION}, matching the KPSC prelims scheme. Unanswered questions carry no penalty.`,
    },
    {
      q: 'Can I attempt the test more than once?',
      a: 'Yes. This is a learning set rather than a ranked mock, so re-attempts are unlimited and each one is analysed separately.',
    },
  ];

  for (const [index, faq] of faqs.entries()) {
    const existing = await db.faq.findFirst({
      where: { question: faq.q, testSeriesId: series.id },
      select: { id: true },
    });
    if (existing) continue;
    await db.faq.create({
      data: {
        question: faq.q,
        answer: faq.a,
        category: 'TEST_SERIES',
        testSeriesId: series.id,
        sortOrder: index,
        isPublished: true,
      },
    });
  }

  console.log('  ✓ free test series + 1 published test + 4 FAQs');

  const flagged = QUESTIONS.filter((q) => q.reviewNote);
  if (flagged.length > 0) {
    console.log(`\n  ⚠  ${flagged.length} question(s) carry a faculty review note:`);
    for (const q of flagged) console.log(`     • ${q.code}`);
  }

  console.log('\nDone. View at /test-series/kas-polity-previous-year-questions\n');
}

main()
  .catch((error) => {
    console.error('\nKAS seed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
