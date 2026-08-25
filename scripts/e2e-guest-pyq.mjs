/**
 * Verifies that the whole previous-year section is open without an account.
 *
 * A visitor should be able to arrive with no login, give a name and a phone
 * number, sit any paper, and read its analysis. This drives that over HTTP
 * exactly as a browser would, for a paper with questions and one without.
 *
 * Requires the server to be running. Run with:
 *   node scripts/e2e-guest-pyq.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PHONE = `9${String(Date.now()).slice(-9)}`;

const db = new PrismaClient();
let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Follows nothing: we want to see the redirect itself. */
async function raw(path, cookie) {
  return fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  });
}

async function main() {
  console.log(`\nPYQ open access — end to end against ${BASE}\n`);

  const withQuestions = await db.test.findFirst({
    where: {
      slug: { startsWith: 'kas-pyq-' },
      totalQuestions: { gt: 0 },
      synopsisFileName: { not: null },
      deletedAt: null,
    },
    select: { id: true, slug: true },
  });

  const withoutQuestions = await db.test.findFirst({
    where: {
      slug: { startsWith: 'kas-pyq-' },
      totalQuestions: 0,
      synopsisFileName: { not: null },
      deletedAt: null,
    },
    select: { id: true, slug: true },
  });

  if (!withQuestions) {
    console.log('  Cannot run: no previous-year test has questions.');
    process.exitCode = 1;
    return;
  }

  console.log(`  paper with questions: ${withQuestions.slug}`);
  console.log(`  paper without        : ${withoutQuestions?.slug ?? '(none)'}\n`);

  // --- 1. Signed out, opening a paper -------------------------------------
  const toTest = await raw(`/test/${withQuestions.id}`);
  const testLocation = toTest.headers.get('location') ?? '';
  check(
    'opening a paper sends a visitor to the guest form, not to login',
    toTest.status >= 300 && toTest.status < 400 && testLocation.includes('/start/'),
    `HTTP ${toTest.status} -> ${testLocation || 'no redirect'}`,
  );

  // --- 2. Signed out, opening an analysis ---------------------------------
  const toAnalysis = await raw(`/synopsis/test/${withQuestions.id}`);
  const analysisLocation = toAnalysis.headers.get('location') ?? '';
  check(
    'opening an analysis sends a visitor to the guest form',
    toAnalysis.status >= 300 && toAnalysis.status < 400 && analysisLocation.includes('/start/'),
    `HTTP ${toAnalysis.status} -> ${analysisLocation || 'no redirect'}`,
  );
  check(
    'and remembers the analysis as the destination',
    decodeURIComponent(analysisLocation).includes('/synopsis/test/'),
    decodeURIComponent(analysisLocation) || 'no next parameter',
  );

  // --- 3. The guest form itself loads -------------------------------------
  const form = await fetch(`${BASE}/start/${withQuestions.id}`);
  check('the guest form loads without an account', form.ok, `HTTP ${form.status}`);

  // --- 4. Name and phone is enough to get in ------------------------------
  const started = await fetch(`${BASE}/api/guest/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Open Access Check',
      phone: PHONE,
      testId: withQuestions.id,
      next: `/synopsis/test/${withQuestions.id}`,
    }),
  });

  const payload = await started.json().catch(() => ({}));
  const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0];
  check('a name and phone number is accepted', started.ok, `HTTP ${started.status}`);
  check('and returns a session', Boolean(cookie), cookie ? 'cookie set' : 'no cookie');
  check(
    'and honours where the visitor was heading',
    payload?.data?.redirectTo === `/synopsis/test/${withQuestions.id}`,
    payload?.data?.redirectTo ?? 'no destination',
  );

  if (!cookie) {
    console.log('\n  Cannot continue without a session.\n');
    process.exitCode = 1;
    return;
  }

  // --- 5. The guest can sit the paper --------------------------------------
  const attempt = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ testId: withQuestions.id }),
  });
  const attemptId = (await attempt.json().catch(() => ({})))?.data?.attemptId;
  check('the guest can start the paper', typeof attemptId === 'string', `HTTP ${attempt.status}`);

  if (attemptId) {
    const submit = await fetch(`${BASE}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ reason: 'MANUAL' }),
    });
    check('and submit it', submit.ok, `HTTP ${submit.status}`);
  }

  // --- 6. And read the analysis --------------------------------------------
  const pdf = await fetch(`${BASE}/api/synopsis/test/${withQuestions.id}`, { headers: { cookie } });
  const body = pdf.ok ? Buffer.from(await pdf.arrayBuffer()) : Buffer.alloc(0);
  check('the guest can read the analysis', pdf.ok, `HTTP ${pdf.status}`);
  check(
    'and it is a real PDF',
    body.subarray(0, 5).toString('latin1') === '%PDF-',
    body.length ? `${(body.length / 1024 / 1024).toFixed(1)} MB` : 'empty',
  );

  // --- 7. A paper with no questions still opens its analysis --------------
  if (withoutQuestions) {
    const empty = await fetch(`${BASE}/api/synopsis/test/${withoutQuestions.id}`, {
      headers: { cookie },
    });
    check(
      'a paper still being prepared still shows its analysis',
      empty.ok,
      `HTTP ${empty.status}`,
    );
  }

  // --- 8. The lead is recorded ---------------------------------------------
  const lead = await db.user.findFirst({
    where: { phone: PHONE },
    select: { id: true, name: true, phone: true, signupSource: true },
  });
  check(
    'the name and number are recorded as a lead',
    lead?.signupSource === 'GUEST_FREE_TEST' && lead?.phone === PHONE,
    lead ? `${lead.name} / ${lead.phone} / ${lead.signupSource}` : 'not found',
  );

  // --- Clean up -------------------------------------------------------------
  if (lead) {
    await db.testAnswer.deleteMany({ where: { attempt: { userId: lead.id } } });
    await db.attemptEvent.deleteMany({ where: { attempt: { userId: lead.id } } });
    await db.testAttempt.deleteMany({ where: { userId: lead.id } });
    await db.session.deleteMany({ where: { userId: lead.id } });
    await db.user.delete({ where: { id: lead.id } });
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('\nRun failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
