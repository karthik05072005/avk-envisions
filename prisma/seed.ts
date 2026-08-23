/**
 * Development seed.
 *
 * Creates the exam-agnostic fixtures: admin and student accounts, permissions,
 * achievements, subscription plans, CMS content and site settings.
 *
 * Exam content lives in the KAS seeds. This portal covers a single exam
 * (Karnataka Administrative Service), so there is no generic curriculum here —
 * run db:seed:kas, db:seed:catalogue and db:seed:2011 after this one.
 *
 * The script is idempotent — every write is an upsert keyed on a natural key —
 * so it can be re-run against an existing database without duplicating rows.
 *
 * Run with: npm run db:seed
 *
 * SAFETY: refuses to run against a non-file (i.e. hosted) database unless
 * ALLOW_REMOTE_SEED=1 is set, so it cannot accidentally overwrite production.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

import { ALL_PERMISSIONS } from '../src/server/auth/permissions';

const db = new PrismaClient();

const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

/** Demo credentials. Documented in README; never valid in production. */
const DEMO_PASSWORD = 'Demo@Pass2024';

/**
 * The single admin account. Module scope because both the user seed and the
 * content seeds need to resolve the same identity.
 */
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com').toLowerCase();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    const [category] = key.split('.');
    await db.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        label: key
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        category: category ?? 'general',
      },
    });
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`);
}

async function seedUsers() {
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? DEMO_PASSWORD;
  const adminHash = await hash(adminPassword, ARGON2_OPTIONS);

  // Two roles, so two kinds of demo account: the admin who runs the platform,
  // and the learners who use it.
  const accounts = [
    { name: 'AVK Administrator', email: adminEmail, role: 'ADMIN', hash: adminHash },
    { name: 'Ananya Sharma', email: 'student@avkvisions.com', role: 'STUDENT', hash: passwordHash },
    { name: 'Rohan Desai', email: 'rohan@example.com', role: 'STUDENT', hash: passwordHash },
    { name: 'Meera Krishnan', email: 'meera@example.com', role: 'STUDENT', hash: passwordHash },
  ] as const;

  const created: Record<string, string> = {};

  for (const account of accounts) {
    const user = await db.user.upsert({
      where: { emailNormal: account.email },
      update: { name: account.name, role: account.role, status: 'ACTIVE' },
      create: {
        name: account.name,
        email: account.email,
        emailNormal: account.email,
        passwordHash: account.hash,
        role: account.role,
        status: 'ACTIVE',
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    created[account.email] = user.id;

    await db.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    if (account.role === 'STUDENT') {
      await db.studentProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, displayName: account.name, targetYear: new Date().getFullYear() + 1 },
      });
      await db.streak.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    }

  }

  console.log(`  ✓ ${accounts.length} users`);
  return created;
}

/**
 * Subscription plans.
 *
 * Exam-agnostic: plans are linked to whatever exams and series exist at the
 * time, so the KAS seeds can run before or after this without the two needing
 * to know about each other.
 */
async function seedPlans() {
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      tagline: 'Everything you need to try the platform properly.',
      price: 0,
      compare: 0,
      days: 3650,
      featured: false,
      order: 1,
      ai: 0,
      features: [
        'Access to all free mock tests',
        '25 practice questions per day',
        'Basic performance report',
        'Bookmarks and wrong-question review',
      ],
    },
    {
      name: 'Pro',
      slug: 'pro',
      tagline: 'For students preparing seriously this cycle.',
      price: 149900,
      compare: 249900,
      days: 365,
      featured: true,
      order: 2,
      ai: 100,
      features: [
        'Every test series for your chosen exam',
        'Unlimited practice questions',
        'Full topic-level analytics and trends',
        'Weak-topic detection and targeted practice',
        'AVK AI Coach — 100 requests per month',
        'All-India ranking and percentile',
      ],
    },
    {
      name: 'Premium',
      slug: 'premium',
      tagline: 'Multi-exam access with the highest AI limits.',
      price: 249900,
      compare: 399900,
      days: 365,
      featured: false,
      order: 3,
      ai: 500,
      features: [
        'Everything in Pro',
        'Access across every exam on the platform',
        'AVK AI Coach — 500 requests per month',
        'Priority support responses',
        'Downloadable study material',
      ],
    },
  ];

  // Linked against whatever the KAS seeds have created. On a first run these
  // are empty and the plans are still created; the links appear the next time
  // the seed runs, which is why every write here is an upsert.
  const [allExams, paidSeries] = await Promise.all([
    db.exam.findMany({ where: { deletedAt: null }, select: { id: true } }),
    db.testSeries.findMany({
      where: { deletedAt: null, priceInPaise: { gt: 0 } },
      select: { id: true },
    }),
  ]);

  for (const plan of plans) {
    const record = await db.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: { priceInPaise: plan.price, featuresJson: JSON.stringify(plan.features) },
      create: {
        name: plan.name,
        slug: plan.slug,
        tagline: plan.tagline,
        priceInPaise: plan.price,
        comparePriceInPaise: plan.compare,
        durationDays: plan.days,
        isFeatured: plan.featured,
        sortOrder: plan.order,
        maxAiRequestsPerMonth: plan.ai,
        maxPracticeQuestionsPerDay: plan.slug === 'free' ? 25 : -1,
        includesAllTestSeries: plan.slug !== 'free',
        featuresJson: JSON.stringify(plan.features),
      },
      select: { id: true },
    });

    // Paid plans cover every paid series that exists at seed time.
    for (const series of plan.slug === 'free' ? [] : paidSeries) {
      await db.planTestSeries.upsert({
        where: { planId_testSeriesId: { planId: record.id, testSeriesId: series.id } },
        update: {},
        create: { planId: record.id, testSeriesId: series.id },
      });
    }

    if (plan.slug === 'premium') {
      for (const exam of allExams) {
        await db.planExam.upsert({
          where: { planId_examId: { planId: record.id, examId: exam.id } },
          update: {},
          create: { planId: record.id, examId: exam.id },
        });
      }
    }
  }

  console.log(`  ✓ ${plans.length} subscription plans`);
}

async function seedAchievements() {
  const achievements = [
    { key: 'first-test', name: 'First Steps', description: 'Complete your first test.', category: 'TESTS', tier: 'BRONZE', metric: 'tests_completed', value: 1, points: 10 },
    { key: 'ten-tests', name: 'Consistent Performer', description: 'Complete 10 tests.', category: 'TESTS', tier: 'SILVER', metric: 'tests_completed', value: 10, points: 50 },
    { key: 'fifty-tests', name: 'Seasoned Campaigner', description: 'Complete 50 tests.', category: 'TESTS', tier: 'GOLD', metric: 'tests_completed', value: 50, points: 200 },
    { key: 'hundred-questions', name: 'Century', description: 'Solve 100 questions.', category: 'QUESTIONS', tier: 'BRONZE', metric: 'questions_solved', value: 100, points: 20 },
    { key: 'thousand-questions', name: 'Question Machine', description: 'Solve 1,000 questions.', category: 'QUESTIONS', tier: 'GOLD', metric: 'questions_solved', value: 1000, points: 150 },
    { key: 'accuracy-90', name: 'Precision', description: 'Finish a test with 90% accuracy or better.', category: 'ACCURACY', tier: 'GOLD', metric: 'accuracy_percent', value: 90, points: 100 },
    { key: 'streak-7', name: 'Seven Day Streak', description: 'Study for seven consecutive days.', category: 'STREAK', tier: 'SILVER', metric: 'streak_days', value: 7, points: 40 },
    { key: 'streak-30', name: 'Thirty Day Streak', description: 'Study for thirty consecutive days.', category: 'STREAK', tier: 'PLATINUM', metric: 'streak_days', value: 30, points: 250 },
    { key: 'top-100', name: 'Top 100', description: 'Finish a test inside the top 100.', category: 'RANK', tier: 'GOLD', metric: 'best_rank', value: 100, points: 120 },
    { key: 'perfect-score', name: 'Flawless', description: 'Score full marks on any test.', category: 'MILESTONE', tier: 'PLATINUM', metric: 'perfect_scores', value: 1, points: 300 },
  ];

  for (const [index, achievement] of achievements.entries()) {
    await db.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: {
        key: achievement.key,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        points: achievement.points,
        sortOrder: index,
        criteriaJson: JSON.stringify({
          metric: achievement.metric,
          op: achievement.metric === 'best_rank' ? '<=' : '>=',
          value: achievement.value,
        }),
      },
    });
  }

  console.log(`  ✓ ${achievements.length} achievements`);
}

async function seedContent(authorId: string) {
  const faqs = [
    { q: 'Do I need to pay to try AVK Envisions?', a: 'No. Create a free account and you get immediate access to free mock tests, daily practice questions and your basic performance report. You only pay when you want the full test series or unlimited practice.', c: 'GENERAL' },
    { q: 'What happens if my internet drops during a test?', a: 'Nothing is lost. Your answers save continuously to our servers as you work, and the timer runs server-side. Reconnect and you resume exactly where you were, with the correct time remaining.', c: 'TESTS' },
    { q: 'How is the percentile calculated?', a: 'Your percentile is computed against every student who has submitted that same test. It updates as more students attempt it, so early attempts may see their percentile shift slightly.', c: 'TESTS' },
    { q: 'Can I attempt a test more than once?', a: 'It depends on the test. Full-length mocks in a series usually allow one scored attempt so rankings stay meaningful, while practice and sectional tests can generally be re-attempted. The attempt limit is shown before you start.', c: 'TESTS' },
    { q: 'Which payment methods do you accept?', a: 'We accept UPI, credit and debit cards, net banking and supported wallets through Razorpay. Your card details never touch our servers.', c: 'PAYMENT' },
    { q: 'What is your refund policy?', a: 'If you have attempted fewer than two tests in a paid series, write to us within 7 days of purchase and we will process a full refund. Details are on our refund policy page.', c: 'PAYMENT' },
    { q: 'I found a mistake in a question. What should I do?', a: 'Use the report button on the question itself. It goes straight to the subject faculty who wrote it, and you will see the outcome once it is reviewed.', c: 'ACCOUNT' },
    { q: 'Can I use AVK Envisions on my phone?', a: 'Yes. The whole platform is responsive and the test interface is specifically tuned for one-handed use on mobile, with the question palette in a bottom sheet.', c: 'GENERAL' },
  ];

  for (const [index, faq] of faqs.entries()) {
    const existing = await db.faq.findFirst({ where: { question: faq.q }, select: { id: true } });
    if (existing) continue;
    await db.faq.create({
      data: { question: faq.q, answer: faq.a, category: faq.c, sortOrder: index, isPublished: true },
    });
  }

  // Supplied by AVK Envisions. Unattributed on purpose: these are feedback
  // about the product, not claims about a named individual's result.
  // Success stories intentionally carry no seeded rows.
  //
  // The platform sells KPSC KAS only, and the previous seed invented three
  // named students with JEE/NEET/KCET ranks and named college admissions.
  // Presenting fabricated results as real outcomes is not something to ship on
  // a live site that takes money, so the section stays empty and the home page
  // hides it until there are genuine, consented stories to publish. Add them
  // from /admin once you have them.
  const removedStoryNames = ['Aditya Kulkarni', 'Fatima Sheikh', 'Vikram Shetty'];
  const purged = await db.testimonial.deleteMany({
    where: { kind: 'SUCCESS_STORY', studentName: { in: removedStoryNames } },
  });
  if (purged.count > 0) console.log(`  ✓ removed ${purged.count} placeholder success stories`);

  // Older non-KAS testimonials from the first seed are removed for the same reason.
  const staleTestimonials = await db.testimonial.deleteMany({
    where: {
      kind: 'TESTIMONIAL',
      studentName: { in: ['Sneha Rao', 'Karthik Prasad', 'Divya Nair', 'KPSC KAS Aspirant'] },
    },
  });
  if (staleTestimonials.count > 0) {
    console.log(`  ✓ removed ${staleTestimonials.count} non-KAS testimonials`);
  }

  // Supplied by AVK Envisions, attributed as shown on the Results page.
  const testimonials = [
    {
      name: 'Rohit M.',
      quote:
        'The tests were really useful for understanding the KPSC question pattern. The PYQ-based questions made my preparation much more focused.',
      exam: 'KPSC KAS Aspirant',
      city: 'Mysuru, Karnataka',
      featured: true,
    },
    {
      name: 'Anusha B.',
      quote:
        'What I liked most was the analysis after every test. It helped me identify where I was making mistakes and what I actually needed to revise.',
      exam: 'KPSC KAS Aspirant',
      city: 'Bengaluru, Karnataka',
      featured: true,
    },
    {
      name: 'Sandeep H.',
      quote:
        'It was more than just taking a test. Going through the PYQs, explanations and mistakes helped me understand how to approach KPSC preparation better.',
      exam: 'KPSC KAS Aspirant',
      city: 'Hubballi, Karnataka',
      featured: true,
    },
  ];



  for (const [index, item] of testimonials.entries()) {
    const existing = await db.testimonial.findFirst({
      where: { studentName: item.name, kind: 'TESTIMONIAL' },
      select: { id: true },
    });
    if (existing) continue;
    await db.testimonial.create({
      data: {
        kind: 'TESTIMONIAL',
        studentName: item.name,
        quote: item.quote,
        examName: item.exam,
        city: item.city,
        isFeatured: item.featured,
        isPublished: true,
        sortOrder: index,
        rating: 5,
      },
    });
  }


  // Legal and informational pages.
  const pages = [
    {
      slug: 'about',
      title: 'About AVK Envisions',
      content:
        '<h2>Why we built this</h2><p>Most test platforms hand a student a score and leave them to work out what it means. AVK Envisions was built around the opposite idea: every attempt should end with a clear, evidence-backed answer to the question "what should I do next?"</p><h2>How we work</h2><p>Every question in our bank is written by subject faculty and reviewed by a second person before it is published. When a student reports a problem with a question, it is triaged by the faculty who owns that subject, and the outcome is visible to the student who reported it.</p><h2>What we do not do</h2><p>We do not publish inflated success figures, and we do not claim a topic is your weakness on the basis of a single wrong answer. Our analytics wait until there is enough evidence to say something useful.</p>',
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      content:
        '<h2>What we collect</h2><p>We collect the name and email address you provide at registration, the answers and timings from tests you attempt, and standard technical information such as your device type and approximate location derived from your IP address.</p><h2>How we use it</h2><p>Your attempt data powers your own analytics and your position on leaderboards. We use your email to send account, security and purchase messages, and — only if you opt in — study reminders and product updates.</p><h2>What we never do</h2><p>We do not sell your personal data. We do not share your individual performance with other students. Staff access to your account is limited by role and every administrative action is recorded in an audit log.</p><h2>Your rights</h2><p>You can export or delete your account data at any time from your account settings, or by contacting our support team.</p>',
    },
    {
      slug: 'terms',
      title: 'Terms & Conditions',
      content:
        '<h2>Your account</h2><p>You are responsible for keeping your password confidential and for all activity under your account. Accounts are for a single individual — sharing credentials is grounds for suspension.</p><h2>Acceptable use</h2><p>You may not copy, redistribute or resell questions, tests or solutions from the platform. Attempting to manipulate timers, scores or rankings will result in the affected attempts being voided.</p><h2>Access and availability</h2><p>Paid access runs for the duration stated at the time of purchase. We aim for continuous availability but do not guarantee uninterrupted service, and we may take the platform down for scheduled maintenance.</p>',
    },
    {
      slug: 'refund-policy',
      title: 'Refund Policy',
      content:
        '<h2>Eligibility</h2><p>If you have attempted fewer than two tests in a purchased test series, you may request a full refund within 7 days of purchase.</p><h2>How to request one</h2><p>Raise a support ticket from your account, or email our support address, quoting your order number. We respond to refund requests within two working days.</p><h2>Processing</h2><p>Approved refunds are returned to the original payment method through Razorpay and typically settle within 5 to 7 working days, depending on your bank.</p><h2>Exceptions</h2><p>Subscription plans are refundable on the same terms. Purchases made with a promotional coupon are refunded at the amount actually paid.</p>',
    },
  ];

  for (const page of pages) {
    await db.page.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content },
      create: { ...page, status: 'PUBLISHED', seoTitle: page.title },
    });
  }

  // Blog
  const category = await db.blogCategory.upsert({
    where: { slug: 'preparation-strategy' },
    update: {},
    create: {
      name: 'Preparation Strategy',
      slug: 'preparation-strategy',
      description: 'Practical guidance on how to prepare, not motivational filler.',
    },
    select: { id: true },
  });

  const posts = [
    {
      title: 'How many mock tests should you actually attempt?',
      slug: 'how-many-mock-tests-should-you-attempt',
      excerpt:
        'More is not automatically better. What matters is the gap between attempts, and what you do inside it.',
      content:
        '<p>The most common mistake we see is students attempting mock tests back to back with no analysis in between. A mock test is a measurement instrument, not a study method — the learning happens in what you do with the result.</p><h2>A workable rhythm</h2><p>For most students preparing over six months, one full-length mock every 7 to 10 days is enough. Between mocks, the time belongs to the topics the last report flagged.</p><h2>What to do after each attempt</h2><ul><li>Review every incorrect answer before looking at the score.</li><li>Separate genuine knowledge gaps from careless errors — they need different fixes.</li><li>Practise the two weakest topics directly, then move on.</li></ul><p>If you are attempting three mocks a week and your score is flat, the problem is almost never the number of mocks.</p>',
    },
    {
      title: 'Negative marking: when to guess and when to leave it',
      slug: 'negative-marking-when-to-guess',
      excerpt:
        'The arithmetic of guessing is simple, and most students get it wrong in both directions.',
      content:
        '<p>With one mark awarded and 0.25 deducted, a blind guess between four options has an expected value of exactly zero. That is the baseline everything else is measured against.</p><h2>The rule that follows</h2><p>If you can confidently eliminate even one option, guessing becomes positive expected value. If you cannot eliminate any, guessing is a coin flip that costs you nothing on average but adds variance.</p><h2>Where students go wrong</h2><p>Some leave everything they are unsure about, which quietly costs marks they could have earned. Others attempt everything, which is fine mathematically but eats time they needed for questions they could actually solve.</p><p>The real constraint is usually time, not the marking scheme.</p>',
    },
  ];

  for (const post of posts) {
    await db.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        ...post,
        content: post.content,
        authorId,
        categoryId: category.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        readMinutes: 4,
        tagsJson: JSON.stringify(['strategy', 'mock tests']),
        seoTitle: post.title,
        seoDescription: post.excerpt,
      },
    });
  }

  console.log('  ✓ CMS content: FAQs, testimonials, stories, pages, blog');
}

async function seedSettings() {
  const settings = [
    { key: 'site.name', value: 'AVK Envisions', group: 'general', label: 'Site name' },
    { key: 'site.tagline', value: 'Prepare Smarter. Perform Better. Achieve More.', group: 'general', label: 'Tagline' },
    { key: 'site.supportEmail', value: 'support@avkvisions.com', group: 'contact', label: 'Support email' },
    { key: 'site.contactEmail', value: 'hello@avkvisions.com', group: 'contact', label: 'Contact email' },
    { key: 'site.maintenanceMode', value: 'false', valueType: 'BOOLEAN', group: 'general', label: 'Maintenance mode' },
    { key: 'site.registrationOpen', value: 'true', valueType: 'BOOLEAN', group: 'general', label: 'Registration open' },
    { key: 'seo.defaultTitle', value: 'AVK Envisions — Online Test Series & Exam Preparation', group: 'seo', label: 'Default SEO title' },
    { key: 'weakTopic.minAttempts', value: '8', valueType: 'NUMBER', group: 'analytics', label: 'Minimum attempts before a topic is classified' },
    { key: 'weakTopic.threshold', value: '50', valueType: 'NUMBER', group: 'analytics', label: 'Accuracy % below which a topic counts as weak' },
  ];

  for (const setting of settings) {
    await db.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        valueType: setting.valueType ?? 'STRING',
        group: setting.group,
        label: setting.label,
      },
    });
  }

  console.log(`  ✓ ${settings.length} site settings`);
}

// ---------------------------------------------------------------------------

/**
 * Removes the demo accounts that existed only to demonstrate the retired
 * TEACHER / SUPPORT roles.
 *
 * Their content is reassigned to the admin first. The foreign keys are
 * `SetNull`, so deleting them outright would blank the author on every
 * question and test they created — losing provenance that the audit trail and
 * the admin UI both rely on.
 */
async function retireLegacyStaffAccounts(adminId: string) {
  const legacy = ['manager@avkvisions.com', 'teacher@avkvisions.com', 'support@avkvisions.com'];

  for (const email of legacy) {
    const user = await db.user.findUnique({ where: { emailNormal: email }, select: { id: true } });
    if (!user || user.id === adminId) continue;

    const [questions, reviews, tests, posts] = await Promise.all([
      db.question.updateMany({ where: { createdById: user.id }, data: { createdById: adminId } }),
      db.question.updateMany({ where: { reviewedById: user.id }, data: { reviewedById: adminId } }),
      db.test.updateMany({ where: { createdById: user.id }, data: { createdById: adminId } }),
      db.blogPost.updateMany({ where: { authorId: user.id }, data: { authorId: adminId } }),
    ]);

    await db.user.delete({ where: { id: user.id } });

    console.log(
      `  ok  retired ${email} (reassigned ${questions.count} questions, ` +
        `${reviews.count} reviews, ${tests.count} tests, ${posts.count} posts)`,
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('file:') && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error(
      'Refusing to seed a non-file database. Set ALLOW_REMOTE_SEED=1 if this is genuinely intended.',
    );
  }

  console.log('\nSeeding AVK Envisions…\n');

  await seedPermissions();
  const users = await seedUsers();

  // All content is authored and reviewed by the admin — there is no separate
  // faculty role for content to belong to.
  const adminId = users[adminEmail]!;

  // Exams, subjects, questions and tests belong entirely to the KAS seeds.
  // This portal covers a single exam, so there is nothing generic to create.
  await seedPlans();
  await seedAchievements();
  await seedContent(adminId);
  await seedSettings();
  await retireLegacyStaffAccounts(users[adminEmail]!);

  console.log('\nSeed complete.\n');
  console.log('Next, load the exam content:');
  console.log('  npm run db:seed:kas        KAS exam and Polity syllabus');
  console.log('  npm run db:seed:catalogue  course tracks, series and tests');
  console.log('  npm run db:seed:2011       KAS 2011 Paper I questions\n');
  console.log('Demo credentials (development only):');
  console.log(`  Admin    ${adminEmail}  /  see SEED_ADMIN_PASSWORD in .env`);
  console.log(`  Student  student@avkvisions.com  /  ${DEMO_PASSWORD}`);
  console.log(`  Student  rohan@example.com       /  ${DEMO_PASSWORD}`);
  console.log(`  Student  meera@example.com       /  ${DEMO_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
