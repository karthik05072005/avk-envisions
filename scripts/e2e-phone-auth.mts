/**
 * End-to-end check of the mandatory registration phone number and phone login.
 *
 * Exercises the real HTTP API as a browser would, then reads the database back
 * to confirm what was actually stored. The two things that matter most are the
 * ones easiest to get wrong:
 *
 *   - an existing account, created before the number was required, must still
 *     be able to sign in;
 *   - a guest row created by the free-test lead capture shares the phone
 *     column and must never be what a phone sign-in resolves to.
 */
import { PrismaClient } from '@prisma/client';

import { registerSchema } from '../src/validations/auth';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';

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

const STAMP = Date.now();
const NEW_EMAIL = `e2e-phone-${STAMP}@avkvisions.test`;
const NEW_PHONE = '9812345670';
const LEGACY_EMAIL = `e2e-legacy-${STAMP}@avkvisions.test`;
const GUEST_PHONE = '9812345671';
const PASSWORD = 'Demo@Pass2024';

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* some endpoints answer with no body */
  }
  return { status: res.status, body: json };
}

async function cleanup() {
  const emails = [NEW_EMAIL, LEGACY_EMAIL];
  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        { email: { startsWith: 'e2e-' } },
        { phone: { in: [NEW_PHONE, GUEST_PHONE, '9812345672', '9812345673', '9812345674', '9812345675'] } },
      ],
    },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } });
  await db.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
  await db.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await db.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
  await db.streak.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log('\n=== Registration phone number, and signing in with it ===\n');
  await cleanup();

  // ------------------------------------------------- 1. the number is required
  console.log('-- Registration requires a mobile number --');

  // Checked against the schema rather than over HTTP: registration allows five
  // attempts an hour, and spending them on inputs that never reach the
  // database would leave none for the flows below. The endpoint runs this
  // exact schema, which the 422 in the next section confirms.
  const base = {
    name: 'Test Phone Case',
    email: `e2e-bad-${STAMP}@avkvisions.test`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptTerms: true as const,
  };

  log(!registerSchema.safeParse(base).success, 'a registration with no number is invalid');

  for (const [label, phone] of [
    ['too short', '98123456'],
    ['too long', '98123456789'],
    ['starts with 5', '5812345670'],
    ['letters', 'abcdefghij'],
    ['empty', ''],
  ] as [string, string][]) {
    log(!registerSchema.safeParse({ ...base, phone }).success,
        `rejects a number that is ${label}`);
  }

  for (const [label, phone] of [
    ['ten digits', '9812345670'],
    ['with +91', '+919812345670'],
    ['with +91 and a space', '+91 9812345670'],
  ] as [string, string][]) {
    log(registerSchema.safeParse({ ...base, phone }).success, `accepts a number ${label}`);
  }

  // One HTTP call to prove the endpoint enforces the same rule.
  const noPhone = await post('/api/auth/register', {
    ...base,
    email: `e2e-nophone-${STAMP}@avkvisions.test`,
  });
  log(noPhone.status === 422 || noPhone.status === 400,
      'and the endpoint refuses it too', `status ${noPhone.status}`);

  // ------------------------------------------------------ 2. a good signup
  console.log('\n-- A valid registration --');

  const made = await post('/api/auth/register', {
    name: 'Test Phone User',
    email: NEW_EMAIL,
    phone: NEW_PHONE,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptTerms: true,
  });
  log(made.status === 201, 'creates the account', `status ${made.status}`);

  const created = await db.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { id: true, phone: true, signupSource: true },
  });
  log(created !== null, 'the account exists');
  log(created?.phone === NEW_PHONE, 'the number is stored as ten bare digits',
      String(created?.phone));

  // The +91 the form shows must not end up in the column.
  const withPrefix = await post('/api/auth/register', {
    name: 'Test Prefixed',
    email: `e2e-prefix-${STAMP}@avkvisions.test`,
    phone: `+91${NEW_PHONE.slice(0, 9)}9`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptTerms: true,
  });
  if (withPrefix.status === 201) {
    const p = await db.user.findUnique({
      where: { email: `e2e-prefix-${STAMP}@avkvisions.test` },
      select: { phone: true },
    });
    log(p?.phone?.length === 10 && !p.phone.startsWith('+'),
        'a number typed with +91 is stored without it', String(p?.phone));
    await cleanupOne(`e2e-prefix-${STAMP}@avkvisions.test`);
  } else {
    log(false, 'a number typed with +91 is accepted', `status ${withPrefix.status}`);
  }

  // --------------------------------------------------- 3. signing in, both ways
  console.log('\n-- Signing in --');

  // A known-good hash, so every fixture below shares one password.
  const { passwordHash: donorHash } = await db.user.findFirstOrThrow({
    where: { email: 'student@avkvisions.com' },
    select: { passwordHash: true },
  });

  // One account tolerates five sign-in attempts per fifteen minutes, and that
  // limit is a feature — so each spelling is tried against its own freshly
  // made account rather than hammering one and reading the throttle as a bug.
  //
  // Made directly rather than through the endpoint: registration allows five
  // an hour, which is also a control worth keeping, and these accounts exist
  // only to give each spelling its own sign-in budget. The registration path
  // itself is covered above, where it is the thing under test.
  async function accountFor(tag: string, phone: string) {
    const email = `e2e-${tag}-${STAMP}@avkvisions.test`;
    const row = await db.user.create({
      data: {
        name: 'Test Login Case',
        email,
        emailNormal: email,
        phone,
        passwordHash: donorHash,
        status: 'ACTIVE',
        emailVerified: new Date(),
      },
      select: { id: true },
    });
    await db.studentProfile.create({ data: { userId: row.id, displayName: 'Test Login Case' } });
    return { email, id: row.id };
  }

  const byEmail = await post('/api/auth/login', { email: NEW_EMAIL, password: PASSWORD });
  log(byEmail.status === 200, 'signs in with the email address', `status ${byEmail.status}`);

  // Its own account: the email sign-in above already spent one of the five
  // attempts NEW_EMAIL's account allows, and the point here is the lookup, not
  // how much throttle budget one account has left.
  const plain = await accountFor('plain', '9812345675');
  const byPhone = await post('/api/auth/login', { email: '9812345675', password: PASSWORD });
  log(byPhone.status === 200, 'signs in with the mobile number', `status ${byPhone.status}`);
  log(byPhone.body?.data?.user?.id === plain.id, 'and reaches that account');

  const plus = await accountFor('plus', '9812345672');
  const byPrefixed = await post('/api/auth/login', { email: '+919812345672', password: PASSWORD });
  log(byPrefixed.status === 200, 'signs in with +91 in front', `status ${byPrefixed.status}`);
  log(byPrefixed.body?.data?.user?.id === plus.id, 'and reaches that account');

  const spacedAcct = await accountFor('spaced', '9812345673');
  const spaced = await post('/api/auth/login', { email: '+91 9812345673', password: PASSWORD });
  log(spaced.status === 200, 'signs in with a space after +91', `status ${spaced.status}`);
  log(spaced.body?.data?.user?.id === spacedAcct.id, 'and reaches that account');

  const wrongAcct = await accountFor('wrongpass', '9812345674');
  const wrongPass = await post('/api/auth/login', { email: '9812345674', password: 'Wrong@Pass1' });
  log(wrongPass.status === 401, 'a wrong password is refused by number too',
      `status ${wrongPass.status}`);
  void wrongAcct;

  const unknown = await post('/api/auth/login', { email: '9800000001', password: PASSWORD });
  log(unknown.status === 401, 'an unknown number is refused', `status ${unknown.status}`);

  // ------------------------------------- 4. accounts that predate the change
  console.log('\n-- An existing account with no number --');

  const legacy = await db.user.create({
    data: {
      name: 'Test Legacy User',
      email: LEGACY_EMAIL,
      emailNormal: LEGACY_EMAIL,
      passwordHash: donorHash,
      phone: null,
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
    select: { id: true },
  });
  await db.studentProfile.create({ data: { userId: legacy.id, displayName: 'Test Legacy User' } });

  const legacyIn = await post('/api/auth/login', { email: LEGACY_EMAIL, password: PASSWORD });
  log(legacyIn.status === 200, 'an account with no number still signs in',
      `status ${legacyIn.status}`);

  const stillNull = await db.user.findUnique({
    where: { id: legacy.id },
    select: { phone: true },
  });
  log(stillNull?.phone === null, 'and is not forced to acquire one');

  // ------------------------------------------- 5. the guest row must not win
  console.log('\n-- A guest lead sharing the number --');

  const guest = await db.user.create({
    data: {
      name: 'Test Guest',
      email: `guest.${GUEST_PHONE}@guest.avkvisions.local`,
      emailNormal: `guest.${GUEST_PHONE}@guest.avkvisions.local`,
      passwordHash: donorHash,
      phone: GUEST_PHONE,
      signupSource: 'GUEST_FREE_TEST',
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  const registered = await post('/api/auth/register', {
    name: 'Test Real Account',
    email: `e2e-real-${STAMP}@avkvisions.test`,
    phone: GUEST_PHONE,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptTerms: true,
  });
  log(registered.status === 201, 'a real account can use a number a guest already has',
      `status ${registered.status}`);

  const real = await db.user.findUnique({
    where: { email: `e2e-real-${STAMP}@avkvisions.test` },
    select: { id: true },
  });

  const sharedIn = await post('/api/auth/login', { email: GUEST_PHONE, password: PASSWORD });
  log(sharedIn.status === 200, 'signing in by that number works', `status ${sharedIn.status}`);
  log(sharedIn.body?.data?.user?.id === real?.id,
      'and resolves to the real account, not the guest');
  log(sharedIn.body?.data?.user?.id !== guest.id, 'the guest row is never signed into');

  // ------------------------------------------------ 6. the admin can see it
  console.log('\n-- Admin visibility --');

  const shown = await db.user.findUnique({
    where: { email: NEW_EMAIL },
    select: { phone: true, name: true },
  });
  log(shown?.phone === NEW_PHONE, 'the number is on the user row the admin list reads',
      String(shown?.phone));

  const searchable = await db.user.findMany({
    where: { phone: { contains: NEW_PHONE.slice(-4) } },
    select: { id: true },
  });
  log(searchable.some((u) => u.id === created?.id), 'and is findable by the admin search');

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

async function cleanupOne(email: string) {
  const u = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) return;
  await db.session.deleteMany({ where: { userId: u.id } });
  await db.emailVerificationToken.deleteMany({ where: { userId: u.id } });
  await db.studentProfile.deleteMany({ where: { userId: u.id } });
  await db.notificationPreference.deleteMany({ where: { userId: u.id } });
  await db.streak.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    const strays = await db.user.findMany({
      where: { email: { startsWith: 'e2e-' } },
      select: { email: true },
    });
    for (const s of strays) await cleanupOne(s.email);
    await db.$disconnect();
  });
