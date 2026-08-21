/**
 * Verifies the relaxed password policy through the real registration API.
 *
 * The point is not that weak passwords are a good idea — it is that the
 * platform now accepts them as specified, and that the one remaining rule (a
 * length floor) is still enforced on the server rather than only in the form.
 *
 * Run with: node scripts/verify-password-policy.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();

let failures = 0;
const created = [];

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function register(password) {
  const email = `pwtest-${Math.random().toString(36).slice(2, 10)}@example.com`;

  const response = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Policy Test',
      email,
      password,
      confirmPassword: password,
      acceptTerms: true,
    }),
  });

  const body = await response.json().catch(() => null);
  if (body?.success) created.push(email);

  return { ok: Boolean(body?.success), email, body };
}

async function main() {
  console.log('\nPassword policy verification\n');

  // --- Previously rejected, must now be accepted -------------------------
  console.log('1. Simple passwords are accepted');

  // Kept deliberately small: /api/auth/register allows 5 attempts per hour per
  // IP, and burning that budget here would make the results meaningless. The
  // full matrix of accepted passwords lives in src/lib/password-policy.test.ts.
  const shouldPass = [
    ['Test@123456', 'the one from the screenshot — was rejected as sequential'],
    ['password', 'a common password'],
  ];

  for (const [password, why] of shouldPass) {
    const result = await register(password);
    check(`accepts "${password}"`, result.ok, why);
    if (!result.ok) console.log(`         ${JSON.stringify(result.body?.error?.details ?? result.body?.error?.message)}`);
  }

  // --- The one remaining rule --------------------------------------------
  console.log('\n2. The length floor is still enforced server-side');

  const tooShort = await register('abc');
  // Must be rejected *for length*. A RATE_LIMITED response here would be a
  // false pass — the endpoint would have refused it for the wrong reason.
  check(
    'rejects a 3-character password on length, not throttling',
    !tooShort.ok && tooShort.body?.error?.code === 'VALIDATION_ERROR',
    tooShort.body?.error?.code,
  );

  // --- The accepted password actually works ------------------------------
  console.log('\n3. A simple password can sign in, and is still hashed properly');

  // Reuse the first account created above rather than registering another —
  // every extra registration eats into the 5-per-hour budget.
  const target = created[0];
  if (target) {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target, password: 'Test@123456' }),
    });
    const body = await login.json().catch(() => null);
    check('signs in with the simple password', body?.success === true, body?.error?.code);

    const stored = await db.user.findUnique({
      where: { emailNormal: target },
      select: { passwordHash: true },
    });
    // Relaxing the policy must not weaken storage: a weak password is still
    // hashed with Argon2id, never plaintext or a fast digest.
    check('still stored as an Argon2id hash', stored?.passwordHash.startsWith('$argon2id$'));
  } else {
    check('an account was created to sign in with', false, 'registration was throttled');
  }

  // --- Cleanup ------------------------------------------------------------
  const emails = [...new Set(created)];
  const users = await db.user.findMany({
    where: { emailNormal: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);

  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } });
  await db.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
  await db.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await db.streak.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n  cleaned up ${ids.length} test accounts`);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
