-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_test_series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "bannerUrl" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'MIXED',
    "track" TEXT NOT NULL DEFAULT 'PAID_SERIES',
    "examYear" INTEGER,
    "sessionLabel" TEXT,
    "iconName" TEXT,
    "accentHex" TEXT,
    "priceInPaise" INTEGER NOT NULL DEFAULT 0,
    "comparePriceInPaise" INTEGER NOT NULL DEFAULT 0,
    "accessDurationDays" INTEGER NOT NULL DEFAULT 365,
    "featuresJson" TEXT NOT NULL DEFAULT '[]',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "test_series_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_test_series" ("accessDurationDays", "bannerUrl", "comparePriceInPaise", "createdAt", "deletedAt", "description", "difficulty", "endDate", "examId", "featuresJson", "id", "isFeatured", "name", "priceInPaise", "seoDescription", "seoTitle", "slug", "sortOrder", "startDate", "status", "tagline", "thumbnailUrl", "updatedAt") SELECT "accessDurationDays", "bannerUrl", "comparePriceInPaise", "createdAt", "deletedAt", "description", "difficulty", "endDate", "examId", "featuresJson", "id", "isFeatured", "name", "priceInPaise", "seoDescription", "seoTitle", "slug", "sortOrder", "startDate", "status", "tagline", "thumbnailUrl", "updatedAt" FROM "test_series";
DROP TABLE "test_series";
ALTER TABLE "new_test_series" RENAME TO "test_series";
CREATE UNIQUE INDEX "test_series_slug_key" ON "test_series"("slug");
CREATE INDEX "test_series_examId_status_idx" ON "test_series"("examId", "status");
CREATE INDEX "test_series_status_isFeatured_sortOrder_idx" ON "test_series"("status", "isFeatured", "sortOrder");
CREATE TABLE "new_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "testSeriesId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FULL_MOCK',
    "paperNumber" INTEGER,
    "subjectId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'EXAM',
    "durationMinutes" INTEGER NOT NULL,
    "totalMarks" REAL NOT NULL DEFAULT 0,
    "passingMarks" REAL,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultNegativeRatio" REAL NOT NULL DEFAULT 0.25,
    "accessType" TEXT NOT NULL DEFAULT 'PAID',
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "navigationMode" TEXT NOT NULL DEFAULT 'FREE_NAVIGATION',
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT false,
    "sectionTimingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "proctoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fullscreenRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxTabSwitches" INTEGER NOT NULL DEFAULT 0,
    "showResultImmediately" BOOLEAN NOT NULL DEFAULT true,
    "resultsAvailableAt" DATETIME,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" REAL NOT NULL DEFAULT 0,
    "completionRate" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tests_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tests_testSeriesId_fkey" FOREIGN KEY ("testSeriesId") REFERENCES "test_series" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tests_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tests" ("accessType", "attemptCount", "avgScore", "category", "completionRate", "createdAt", "createdById", "defaultNegativeRatio", "deletedAt", "description", "durationMinutes", "endDate", "examId", "fullscreenRequired", "id", "instructions", "maxAttempts", "maxTabSwitches", "mode", "navigationMode", "negativeMarkingEnabled", "passingMarks", "proctoringEnabled", "publishedAt", "randomizeOptions", "randomizeQuestions", "resultsAvailableAt", "sectionTimingEnabled", "showResultImmediately", "slug", "startDate", "status", "testSeriesId", "title", "totalMarks", "totalQuestions", "updatedAt") SELECT "accessType", "attemptCount", "avgScore", "category", "completionRate", "createdAt", "createdById", "defaultNegativeRatio", "deletedAt", "description", "durationMinutes", "endDate", "examId", "fullscreenRequired", "id", "instructions", "maxAttempts", "maxTabSwitches", "mode", "navigationMode", "negativeMarkingEnabled", "passingMarks", "proctoringEnabled", "publishedAt", "randomizeOptions", "randomizeQuestions", "resultsAvailableAt", "sectionTimingEnabled", "showResultImmediately", "slug", "startDate", "status", "testSeriesId", "title", "totalMarks", "totalQuestions", "updatedAt" FROM "tests";
DROP TABLE "tests";
ALTER TABLE "new_tests" RENAME TO "tests";
CREATE UNIQUE INDEX "tests_slug_key" ON "tests"("slug");
CREATE INDEX "tests_examId_status_idx" ON "tests"("examId", "status");
CREATE INDEX "tests_testSeriesId_status_idx" ON "tests"("testSeriesId", "status");
CREATE INDEX "tests_status_startDate_idx" ON "tests"("status", "startDate");
CREATE INDEX "tests_accessType_status_idx" ON "tests"("accessType", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
