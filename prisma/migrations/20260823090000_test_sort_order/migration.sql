-- Position of a test within its series.
--
-- The free series carries no dates, so ordering fell back to the title and the
-- schedule read alphabetically. This records the timetable position instead.

-- AlterTable
ALTER TABLE "tests" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "tests_testSeriesId_sortOrder_idx" ON "tests"("testSeriesId", "sortOrder");
