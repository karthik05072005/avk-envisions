-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "page" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");
