-- Question-wise analysis PDF attached to a previous-year paper.
--
-- Only the file name is stored. The file itself sits outside the web root and
-- is streamed through a route that checks entitlement and attempt history, so
-- there is never a public URL to the document.

-- AlterTable
ALTER TABLE "test_series" ADD COLUMN "synopsisFileName" TEXT;
