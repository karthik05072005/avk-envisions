-- Per-test analysis PDFs, and early-bird pricing tiers.
--
-- A test can carry its own analysis document; when it does not, the series
-- level document is used. Pricing tiers record the ladder only — how many
-- seats have gone is always counted from live entitlements, so the number a
-- visitor sees cannot drift away from what was actually sold.

-- AlterTable
ALTER TABLE "tests" ADD COLUMN "synopsisFileName" TEXT;

-- AlterTable
ALTER TABLE "test_series" ADD COLUMN "tier1PriceInPaise" INTEGER;
ALTER TABLE "test_series" ADD COLUMN "tier1Limit" INTEGER;
ALTER TABLE "test_series" ADD COLUMN "tier2PriceInPaise" INTEGER;
ALTER TABLE "test_series" ADD COLUMN "tier2Limit" INTEGER;
