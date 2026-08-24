-- Correct the marking scheme: 2 marks a question, 0.5 deducted for a wrong one.
--
-- Everything was seeded at 1 mark with 0.25 negative, so a hundred-question
-- paper scored out of 100 rather than 200. The ratio was always right; the
-- per-question value was not.
--
-- Existing attempts are deliberately left alone. Each one stores a frozen
-- snapshot of the paper it was sat under, so an old result stays correct
-- against the paper the student actually took rather than being silently
-- restated against a scheme that did not exist at the time.

-- AlterTable: new questions default to the real scheme.
-- (Prisma rewrites the table for a default change; the data updates below
--  cover rows that already exist.)

-- Existing questions.
UPDATE "questions"
   SET "marks" = 2,
       "negativeMarks" = 0.5
 WHERE "marks" = 1;

-- The rows scoring actually reads.
UPDATE "test_questions"
   SET "marks" = 2,
       "negativeMarks" = 0.5
 WHERE "marks" = 1;

-- Recompute each paper's total from its questions.
UPDATE "tests"
   SET "totalMarks" = COALESCE(
         (SELECT SUM(tq."marks") FROM "test_questions" tq WHERE tq."testId" = "tests"."id"),
         0
       );

-- Pass mark is a share of the total, so it moves with it.
UPDATE "tests"
   SET "passingMarks" = CAST(ROUND("totalMarks" * 0.35) AS INTEGER)
 WHERE "passingMarks" IS NOT NULL AND "totalMarks" > 0;
