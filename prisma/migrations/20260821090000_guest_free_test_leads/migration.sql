-- Guest lead capture for the free test.
--
-- A visitor who takes the free test supplies a name and phone number instead
-- of registering. That still creates a real STUDENT row, so every downstream
-- system — attempts, scoring, results, analytics — works unchanged. This
-- column is what lets the admin panel tell the two populations apart.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "signupSource" TEXT NOT NULL DEFAULT 'REGISTERED';

-- CreateIndex
CREATE INDEX "users_signupSource_createdAt_idx" ON "users"("signupSource", "createdAt");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");
