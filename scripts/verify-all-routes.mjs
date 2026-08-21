/**
 * Probes every page route as a real browser would.
 *
 * The route audit proves no link points at a missing file. This proves the
 * files actually render — a page that 500s is just as broken as one that 404s,
 * and only a request reveals it.
 *
 * Each route is checked with the session it is meant for: public routes signed
 * out, student routes as a student, admin routes as an admin.
 *
 * Run with: node scripts/verify-all-routes.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin2024';

let failures = 0;

async function signIn(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = response.headers.get('set-cookie');
  const body = await response.json().catch(() => null);

  if (!body?.success) {
    throw new Error(`Could not sign in as ${email}: ${body?.error?.code ?? response.status}`);
  }
  return setCookie.split(';')[0];
}

async function probe(path, cookie) {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: 'manual',
  });
  return response.status;
}

async function group(title, paths, cookie, expect = 200) {
  console.log(`\n${title}`);
  for (const path of paths) {
    const status = await probe(path, cookie);
    const ok = status === expect;
    if (!ok) failures += 1;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${path.padEnd(42)} ${status}`);
  }
}

async function main() {
  console.log('\nRoute reachability\n' + '='.repeat(60));

  const student = await signIn('student@avkvisions.com', 'Demo@Pass2024');
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  await group(
    'Public',
    [
      '/',
      '/courses',
      '/courses/free-test-series',
      '/courses/paid-test-series',
      '/pyq',
      '/pyq/kas-pyq-2011',
      '/chapterwise',
      '/exams',
      '/exams/kas',
      '/test-series',
      '/pricing',
      '/blog',
      '/faq',
      '/success-stories',
      '/contact',
      '/about',
      '/privacy',
      '/terms',
      '/refund-policy',
      '/login',
      '/register',
      '/forgot-password',
      '/account-suspended',
    ],
    null,
  );

  await group(
    'Student area',
    [
      '/dashboard',
      '/my-tests',
      '/practice',
      '/study-planner',
      '/analytics',
      '/bookmarks',
      '/wrong-questions',
      '/leaderboard',
      '/ai-coach',
      '/achievements',
      '/subscriptions',
      '/support',
      '/profile',
      '/settings',
      '/notifications',
    ],
    student,
  );

  await group(
    'Admin area',
    [
      '/admin',
      '/admin/questions',
      '/admin/questions/new',
      '/admin/import',
      '/admin/tests',
      '/admin/tests/new',
      '/admin/test-series',
      '/admin/exams',
      '/admin/users',
      '/admin/orders',
      '/admin/support',
      '/admin/analytics',
      '/admin/blog',
      '/admin/settings',
    ],
    admin,
  );

  // Onboarding redirects once completed, which is correct behaviour rather
  // than a failure — checked separately so the expectation is explicit.
  console.log('\nRedirect behaviour');
  const onboarding = await probe('/onboarding', student);
  const onboardingOk = onboarding === 200 || (onboarding >= 300 && onboarding < 400);
  if (!onboardingOk) failures += 1;
  console.log(
    `  [${onboardingOk ? 'PASS' : 'FAIL'}] ${'/onboarding'.padEnd(42)} ${onboarding} (200 or redirect if already onboarded)`,
  );

  const studentAtAdmin = await probe('/admin', student);
  const bounced = studentAtAdmin >= 300 && studentAtAdmin < 400;
  if (!bounced) failures += 1;
  console.log(
    `  [${bounced ? 'PASS' : 'FAIL'}] ${'student -> /admin'.padEnd(42)} ${studentAtAdmin} (must redirect)`,
  );

  const anonAtDashboard = await probe('/dashboard', null);
  const gated = anonAtDashboard >= 300 && anonAtDashboard < 400;
  if (!gated) failures += 1;
  console.log(
    `  [${gated ? 'PASS' : 'FAIL'}] ${'signed out -> /dashboard'.padEnd(42)} ${anonAtDashboard} (must redirect)`,
  );

  console.log('\n' + '='.repeat(60));
  console.log(failures === 0 ? 'Every route responds.\n' : `${failures} route(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nAborted:', error.message, '\n');
  process.exit(1);
});
