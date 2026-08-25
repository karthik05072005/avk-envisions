/**
 * End-to-end verification of the "Analysed PDF" flow, driven through HTTP
 * exactly as a browser would.
 *
 * The question this answers: after buying a paper, does a student clicking
 * "Analysed PDF" actually receive the right document — and does someone who
 * has not bought it receive nothing?
 *
 * Checks, in order:
 *   1. A signed-out visitor is refused.
 *   2. A signed-in student without a purchase is refused.
 *   3. The same student, once entitled, receives a PDF.
 *   4. The bytes match the file on disk for that specific test — not another
 *      year's, which is the failure that renaming the years could have caused.
 *   5. The document's own cover page names the paper it is meant to analyse.
 *   6. The free paper needs no purchase, but still must be sat first.
 *   7. Revoking access closes it again.
 *
 * Requires the server to be running. Run with:
 *   node scripts/e2e-synopsis.mjs
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { extractText, getDocumentProxy } from 'unpdf';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = `synopsis-e2e-${Date.now()}@example.com`;
const PASSWORD = 'SynopsisCheck123';

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

function synopsisDir() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('file:')) {
    return path.join(path.dirname(url.slice('file:'.length)), 'synopses');
  }
  return path.resolve('storage/synopses');
}

async function main() {
  console.log(`\nAnalysed PDF — end to end against ${BASE}\n`);

  // --- Pick a paper to test the gate on, and a free one -------------------
  //
  // The catalogue is free, so a priced series may not exist. Where one does,
  // the purchase gate is exercised; where none does, those checks are skipped
  // rather than reported as failures — there is no gate left to test.
  const priced = await db.testSeries.findFirst({
    where: { track: 'PYQ', priceInPaise: { gt: 0 }, deletedAt: null },
    orderBy: { examYear: 'asc' },
    select: {
        id: true,
        name: true,
        examYear: true,
        priceInPaise: true,
        tests: {
          where: { synopsisFileName: { not: null }, deletedAt: null },
          select: { id: true, slug: true, title: true, synopsisFileName: true },
          take: 1,
        },
    },
  });

  const paid =
    priced ??
    (await db.testSeries.findFirst({
      where: { track: 'PYQ', deletedAt: null, examYear: { not: 2011 } },
      orderBy: { examYear: 'asc' },
      select: {
        id: true,
        name: true,
        examYear: true,
        priceInPaise: true,
        tests: {
          where: { synopsisFileName: { not: null }, deletedAt: null },
          select: { id: true, slug: true, title: true, synopsisFileName: true },
          take: 1,
        },
      },
    }));

  const free = await db.testSeries.findFirst({
    where: { track: 'PYQ', priceInPaise: 0, deletedAt: null },
    select: {
      examYear: true,
      tests: {
        where: { synopsisFileName: { not: null }, deletedAt: null },
        select: { id: true, slug: true },
        take: 1,
      },
    },
  });

  const paidTest = paid?.tests[0];
  const freeTest = free?.tests[0];

  if (!paidTest || !freeTest) {
    console.log('  Cannot run: no paper has an analysis attached. Run db:synopses first.');
    process.exitCode = 1;
    return;
  }

  console.log(`  paid paper: ${paid.name} -> ${paidTest.slug}`);
  console.log(`  free paper: ${free.examYear} -> ${freeTest.slug}\n`);

  const url = `${BASE}/api/synopsis/test/${paidTest.id}`;

  // --- 1. Signed out --------------------------------------------------------
  const anon = await fetch(url, { redirect: 'manual' });
  check('signed-out visitor is refused', anon.status === 401 || anon.status === 403,
    `HTTP ${anon.status}`);

  // --- Register a fresh student --------------------------------------------
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Synopsis Checker',
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      acceptTerms: true,
    }),
  });

  const cookie = (reg.headers.get('set-cookie') ?? '').split(';')[0];
  if (!reg.ok || !cookie) {
    console.log(`  Cannot run: registration failed (HTTP ${reg.status}) ${await reg.text()}`);
    process.exitCode = 1;
    return;
  }

  const user = await db.user.findFirst({ where: { emailNormal: EMAIL }, select: { id: true } });

  // --- 2. Signed in, not entitled ------------------------------------------
  const isPriced = (paid.priceInPaise ?? 0) > 0;
  if (isPriced) {
    const unpaid = await fetch(url, { headers: { cookie } });
    check('student without a purchase is refused', unpaid.status === 403, `HTTP ${unpaid.status}`);
  } else {
    console.log('  SKIP  purchase gate — the catalogue is free, nothing is priced');
  }

  // --- 3. Grant access, as a completed payment would -----------------------
  await db.entitlement.create({
    data: {
      userId: user.id,
      testSeriesId: paid.id,
      sourceType: 'PURCHASE',
      startsAt: new Date(Date.now() - 1000),
    },
  });

  // With a free catalogue the remaining gate is the attempt, not the payment:
  // the analysis is the answer key, so the paper has to be sat first. Papers
  // with no questions yet waive that, since it could never be satisfied.
  const paperHasQuestions = await db.test.count({
    where: { id: paidTest.id, totalQuestions: { gt: 0 } },
  });
  if (paperHasQuestions > 0) {
    const s1 = await fetch(`${BASE}/api/attempts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ testId: paidTest.id }),
    });
    const id1 = (await s1.json().catch(() => ({})))?.data?.attemptId;
    if (id1) {
      await fetch(`${BASE}/api/attempts/${id1}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ reason: 'MANUAL' }),
      });
    }
  }

  const bought = await fetch(url, { headers: { cookie } });
  check('a student who has sat the paper receives the document', bought.ok, `HTTP ${bought.status}`);
  check(
    'served as an inline PDF',
    bought.headers.get('content-type') === 'application/pdf' &&
      (bought.headers.get('content-disposition') ?? '').startsWith('inline'),
    `${bought.headers.get('content-type')} / ${bought.headers.get('content-disposition')}`,
  );
  check(
    'not cacheable by intermediaries',
    (bought.headers.get('cache-control') ?? '').includes('no-store'),
    bought.headers.get('cache-control') ?? 'missing',
  );

  const body = Buffer.from(await bought.arrayBuffer());
  check('body is a real PDF', body.subarray(0, 5).toString('latin1') === '%PDF-',
    `${(body.length / 1024 / 1024).toFixed(1)} MB`);

  // --- 4. The right file, byte for byte ------------------------------------
  const onDisk = await readFile(path.join(synopsisDir(), paidTest.synopsisFileName));
  const served = createHash('sha256').update(body).digest('hex');
  const expected = createHash('sha256').update(onDisk).digest('hex');
  check('bytes match the file registered for this test', served === expected,
    `${served.slice(0, 12)} vs ${expected.slice(0, 12)}`);

  // --- 5. The document says which paper it analyses ------------------------
  try {
    const pdf = await getDocumentProxy(new Uint8Array(body));
    const { text } = await extractText(pdf, { mergePages: true });
    const head = String(text).slice(0, 3000);
    const heading = head.split(/\s{2,}|\n/).map((l) => l.trim())
      .find((l) => /KAS\s*PRELIMS/i.test(l)) ?? '(no heading found)';
    const years = [...new Set([...head.matchAll(/\b20\d{2}\b/g)].map((m) => m[0]))];
    console.log(`  INFO  cover heading: ${heading.slice(0, 70)}`);
    console.log(`  INFO  years named in document: ${years.join(', ') || 'none'}`);
    check('document names the year the site advertises',
      years.includes(String(paid.examYear)),
      `site says ${paid.examYear}, document says ${years.join('/') || 'nothing'}`);
  } catch (error) {
    check('document text extractable', false, error.message);
  }

  // --- 6. Free paper: no purchase, but the paper must be sat first ---------
  //
  // The analysis is the answer key. Handing it over before the attempt would
  // turn the free paper into a reading exercise, so "free" removes the payment
  // gate, not the attempt gate.
  const freeUrl = `${BASE}/api/synopsis/test/${freeTest.id}`;

  const beforeAttempt = await fetch(freeUrl, { headers: { cookie } });
  check('free paper is closed until it has been attempted', beforeAttempt.status === 403,
    `HTTP ${beforeAttempt.status}`);

  const started = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ testId: freeTest.id }),
  });
  const attemptId = (await started.json())?.data?.attemptId;
  check('attempt starts on the free paper', typeof attemptId === 'string', `HTTP ${started.status}`);

  if (attemptId) {
    const submitted = await fetch(`${BASE}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ reason: 'MANUAL' }),
    });
    check('attempt submits', submitted.ok, `HTTP ${submitted.status}`);

    const afterAttempt = await fetch(freeUrl, { headers: { cookie } });
    check('free paper opens once it has been sat', afterAttempt.ok, `HTTP ${afterAttempt.status}`);

    const freeBody = Buffer.from(await afterAttempt.arrayBuffer());
    check('free analysis is a real PDF', freeBody.subarray(0, 5).toString('latin1') === '%PDF-',
      `${(freeBody.length / 1024 / 1024).toFixed(1)} MB`);
  }

  // --- 7. Revoking closes it again -----------------------------------------
  await db.entitlement.updateMany({
    where: { userId: user.id, testSeriesId: paid.id },
    data: { revokedAt: new Date() },
  });
  if (isPriced) {
    const revoked = await fetch(url, { headers: { cookie } });
    check('revoked access is refused again', revoked.status === 403, `HTTP ${revoked.status}`);
  } else {
    console.log('  SKIP  revocation — free papers have nothing to revoke');
  }

  // --- Clean up -------------------------------------------------------------
  await db.testAnswer.deleteMany({ where: { attempt: { userId: user.id } } });
  await db.attemptEvent.deleteMany({ where: { attempt: { userId: user.id } } });
  await db.testAttempt.deleteMany({ where: { userId: user.id } });
  await db.entitlement.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('\nRun failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
