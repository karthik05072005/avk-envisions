/**
 * The registration and sign-in forms, in a real browser.
 *
 * The API tests prove the rules; this proves a person can actually meet them —
 * that the +91 is on screen, that the field refuses a bad number before
 * submitting, and that the sign-in box accepts a number where it used to
 * demand an email (the input was `type="email"`, which the browser itself
 * would have blocked).
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

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
const EMAIL = `ui-phone-${STAMP}@avkvisions.test`;
const PHONE = '9700000001';
const PASSWORD = 'Demo@Pass2024';

async function cleanup() {
  const users = await db.user.findMany({
    where: { OR: [{ email: { startsWith: 'ui-phone-' } }, { phone: PHONE }] },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  for (const table of ['session', 'emailVerificationToken', 'passwordResetToken',
                       'studentProfile', 'notificationPreference', 'streak'] as const) {
    await (db as any)[table].deleteMany({ where: { userId: { in: ids } } });
  }
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log('\n=== The phone field, in a browser ===\n');
  await cleanup();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // ------------------------------------------------------ the register form
    console.log('-- Register --');
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });

    const phoneField = page.locator('input[name="phone"]');
    log(await phoneField.count() === 1, 'the form has a mobile number field');
    log(await page.getByText('+91', { exact: true }).count() > 0, 'and shows +91 beside it');

    const label = page.locator('label[for="phone"]');
    log((await label.textContent())?.includes('Mobile number') ?? false,
        'labelled "Mobile number"', (await label.textContent())?.trim());

    log(await phoneField.getAttribute('maxlength') === '10', 'accepts at most ten digits');
    log(await phoneField.getAttribute('inputmode') === 'numeric', 'opens the numeric keypad');

    // A bad number must stop the form rather than reach the server.
    await page.fill('input[name="name"]', 'Ui Phone User');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '12345');
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirmPassword"]', PASSWORD);
    await page.locator('#acceptTerms').click();
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1200);

    const complaint = await page.getByText(/valid 10-digit mobile number/i).count();
    log(complaint > 0, 'a short number is refused on the page itself');
    log(page.url().includes('/register'), 'and the form does not submit');

    const notCreated = await db.user.count({ where: { email: EMAIL } });
    log(notCreated === 0, 'nothing reaches the database');

    // Now a good one.
    await page.fill('input[name="phone"]', PHONE);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const account = await db.user.findUnique({
      where: { email: EMAIL },
      select: { id: true, phone: true },
    });
    log(account !== null, 'a valid number completes the signup');
    log(account?.phone === PHONE, 'and the number is stored', String(account?.phone));

    // ---------------------------------------------------------- the login form
    console.log('\n-- Sign in --');
    const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await fresh.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

    const idField = fresh.locator('input[name="email"]');
    const type = await idField.getAttribute('type');
    log(type !== 'email', 'the sign-in box is not restricted to email addresses', `type="${type}"`);

    const loginLabel = fresh.locator('label[for="email"]');
    const labelText = (await loginLabel.textContent())?.trim() ?? '';
    log(/mobile|phone/i.test(labelText), 'and says a number will do', labelText);

    // The real test: type a number, and land signed in.
    await fresh.fill('input[name="email"]', PHONE);
    await fresh.fill('input[name="password"]', PASSWORD);
    await fresh.click('button[type="submit"]');
    await fresh.waitForTimeout(4000);

    const signedIn = !fresh.url().includes('/login');
    log(signedIn, 'signing in with the number lands inside', fresh.url().replace(BASE, ''));

    await fresh.close();
    await page.close();
  } finally {
    await browser.close();
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
  });
