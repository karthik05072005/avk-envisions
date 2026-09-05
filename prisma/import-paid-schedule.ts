/**
 * Lays out the twelve-test paid series from its published timetable.
 *
 * The same document students open from the series page is what creates the
 * tests, so the table and the PDF cannot say different things. Each row gives
 * the test number, date, day, subject, question count and sitting time — which
 * is every column the schedule table renders.
 *
 * Reading the PDF as lines does not work: the columns extract with a single
 * space between them and no delimiter. The file does carry each cell's
 * x-position, so the parser reads the layout rather than the string.
 *
 * Tests are created unpublished. A paper reaches students only once an admin
 * attaches its questions, which is the rule the free series and the fifty-day
 * challenge both follow.
 *
 *   npm run db:paid:schedule -- --dry-run
 *
 * Run with: npm run db:paid:schedule
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { getDocumentProxy } from 'unpdf';

import { MARKS_PER_QUESTION, NEGATIVE_MARKS_PER_QUESTION } from '../src/lib/marking';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const SERIES_SLUG = 'kas-prelims-paid-test-series';
const SCHEDULE = path.resolve('prisma/assets/kas-paid-12-test-schedule.pdf');

/** Column boundaries, in PDF points, read from the document itself. */
const COLUMN_X = { test: 0, date: 75, day: 165, subject: 215, questions: 420, timing: 465 };

/** Subject names as printed, mapped to the catalogue's own. */
const SUBJECT_ALIASES: Record<string, string> = {
  Polity: 'Indian Polity',
  History: 'History',
  Geography: 'Geography',
  'Economy & Budget & Economic Survey': 'Indian Economy',
  Economy: 'Indian Economy',
  'Environment & Ecology': 'Environment',
  'Science & Technology': 'Science & Technology',
  'Current Affairs': 'Current Affairs',
  CSAT: 'Mental Ability',
};

interface Row {
  test: number;
  date: Date;
  day: string;
  subject: string;
  questions: number;
  timing: string;
}

interface Cell {
  x: number;
  y: number;
  text: string;
}

function columnOf(x: number): keyof typeof COLUMN_X {
  if (x >= COLUMN_X.timing) return 'timing';
  if (x >= COLUMN_X.questions) return 'questions';
  if (x >= COLUMN_X.subject) return 'subject';
  if (x >= COLUMN_X.day) return 'day';
  if (x >= COLUMN_X.date) return 'date';
  return 'test';
}

/**
 * Groups cells into rows by vertical proximity, then reads each column.
 *
 * Proximity rather than an exact baseline: a tall row centres its number
 * against wrapped subject text, so keying on the exact value would split the
 * row in two and lose the number from it.
 */
function parseCells(cells: Cell[]): Row[] {
  const rows: Row[] = [];

  const sorted = [...cells].sort((a, b) => b.y - a.y);
  const lines: Cell[][] = [];

  for (const cell of sorted) {
    const open = lines[lines.length - 1];
    const anchor = open?.[0]?.y;

    if (open && anchor !== undefined && Math.abs(anchor - cell.y) <= 6) open.push(cell);
    else lines.push([cell]);
  }

  // Where the row currently being extended sits, so a continuation is only
  // accepted from the line directly beneath it.
  let openY: number | null = null;

  for (const line of lines) {
    const columns: Record<string, string> = {};
    for (const cell of line.sort((a, b) => a.x - b.x)) {
      const column = columnOf(cell.x);
      columns[column] = `${columns[column] ?? ''} ${cell.text}`.trim();
    }

    const test = Number(columns.test ?? '');
    const dateText = columns.date ?? '';

    if (Number.isInteger(test) && test >= 1 && test <= 12 && /\d{4}/.test(dateText)) {
      rows.push({
        test,
        date: new Date(`${dateText} 00:00:00`),
        day: columns.day ?? '',
        subject: columns.subject ?? '',
        questions: Number(columns.questions ?? '') || 100,
        timing: columns.timing ?? '',
      });
      openY = line[0]?.y ?? null;
      continue;
    }

    // A continuation: the subject wraps onto the next line.
    //
    // Only immediately after its own row, though. The timetable is followed by
    // several syllabus pages, and without this the last test kept absorbing
    // their headings — it ended up titled "Full Prelims Simulation – 2: Paper
    // II KAS PRELIMS 2026 12-TEST PRELIMS TEST SERIES…".
    const open = rows[rows.length - 1];
    if (!open || !columns.subject) continue;

    const gap = Math.abs((openY ?? 0) - (line[0]?.y ?? 0));
    if (gap <= 20) {
      open.subject = `${open.subject} ${columns.subject}`.trim();
      openY = line[0]?.y ?? openY;
    }
  }

  return rows.sort((a, b) => a.test - b.test);
}

async function readSchedule(): Promise<Row[]> {
  const doc = await getDocumentProxy(new Uint8Array(await readFile(SCHEDULE)));
  const cells: Cell[] = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();

    for (const raw of content.items) {
      const item = raw as { str?: string; transform?: number[] };
      const text = (item.str ?? '').trim();
      if (text === '') continue;

      cells.push({
        x: item.transform?.[4] ?? 0,
        // Offset per page so later pages sort below earlier ones.
        y: (item.transform?.[5] ?? 0) - pageNo * 10_000,
        text,
      });
    }
  }

  return parseCells(cells);
}

/** `10 AM–12 PM` → 120 minutes. */
function minutesFrom(timing: string): number {
  const match = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(
    timing,
  );
  if (!match) return 120;

  const toMinutes = (hour: string, minute: string | undefined, meridiem: string): number => {
    let h = Number(hour) % 12;
    if (/pm/i.test(meridiem)) h += 12;
    return h * 60 + Number(minute ?? 0);
  };

  const start = toMinutes(match[1]!, match[2], match[3]!);
  const end = toMinutes(match[4]!, match[5], match[6]!);
  const span = end - start;

  return span > 0 ? span : 120;
}

async function main() {
  console.log(`\nLaying out the twelve paid tests${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const rows = await readSchedule();
  console.log(`  read ${rows.length} test(s) from the timetable\n`);

  if (rows.length !== 12) {
    throw new Error(`Expected 12 tests, read ${rows.length}. The layout is not what this expects.`);
  }

  for (const row of rows) {
    console.log(
      `  ${String(row.test).padStart(2)} ${row.date.toDateString().slice(4, 11)} ` +
        `${row.day.padEnd(9)} ${row.subject.padEnd(38)} ${row.questions}Q  ${row.timing}`,
    );
  }

  if (DRY_RUN) {
    console.log('\n  Nothing written.\n');
    return;
  }

  const series = await db.testSeries.findFirst({
    where: { slug: SERIES_SLUG, deletedAt: null },
    select: { id: true, examId: true },
  });
  if (!series) throw new Error('The paid series is missing. Run the catalogue seed first.');

  const subjects = await db.subject.findMany({ select: { id: true, name: true } });
  const subjectId = new Map(subjects.map((s) => [s.name, s.id]));

  let created = 0;
  let updated = 0;
  let withContent = 0;

  for (const row of rows) {
    const slug = `kas-paid-${row.test}`;
    const existing = await db.test.findFirst({
      where: { slug },
      select: { id: true, totalQuestions: true },
    });

    // The simulations name their paper; the sectional tests do not.
    const paperNumber = /Paper\s*II/i.test(row.subject)
      ? 2
      : /Paper\s*I\b/i.test(row.subject)
        ? 1
        : null;

    const schedule = {
      testSeriesId: series.id,
      title: row.subject,
      description: `${row.day}, ${row.timing}`,
      paperNumber,
      subjectId: subjectId.get(SUBJECT_ALIASES[row.subject] ?? '') ?? null,
      startDate: row.date,
      sortOrder: row.test,
      durationMinutes: minutesFrom(row.timing),
    };

    if (existing) {
      // Content is never touched: a rerun must not undo attached questions.
      await db.test.update({ where: { id: existing.id }, data: schedule });
      if (existing.totalQuestions > 0) withContent += 1;
      updated += 1;
      continue;
    }

    await db.test.create({
      data: {
        ...schedule,
        examId: series.examId,
        slug,
        category: 'FULL_MOCK',
        accessType: 'PAID',
        // Draft until it has questions, so a test appears to students only when
        // there is something behind it.
        status: 'DRAFT',
        mode: 'EXAM',
        maxAttempts: 2,
        totalQuestions: 0,
        totalMarks: row.questions * MARKS_PER_QUESTION,
        passingMarks: Math.round(row.questions * MARKS_PER_QUESTION * 0.35),
        negativeMarkingEnabled: true,
        defaultNegativeRatio: NEGATIVE_MARKS_PER_QUESTION / MARKS_PER_QUESTION,
      },
    });
    created += 1;
  }

  console.log(
    `\n  ${created} created, ${updated} rescheduled (${withContent} already have questions).` +
      `\n  Add questions at /admin/tests, then publish each test.\n`,
  );
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
