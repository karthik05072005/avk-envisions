-- Collapse the five-role model to two: ADMIN and STUDENT.
--
-- Order matters. The data remap runs FIRST, while the old rows are still
-- present, so that no account is left holding a role the application no longer
-- understands. A user stranded on an unknown role would fail every permission
-- check and could not sign in to anything useful.

-- Every former staff role becomes ADMIN. SUPPORT and TEACHER both had strictly
-- fewer rights than ADMIN, and SUPER_ADMIN strictly more; collapsing upward is
-- the only option that does not silently strip someone of access they rely on.
-- This does widen SUPPORT/TEACHER accounts to full admin rights, which is the
-- intended consequence of removing those roles.
UPDATE "users"
SET "role" = 'ADMIN'
WHERE "role" IN ('SUPER_ADMIN', 'TEACHER', 'SUPPORT');

-- Anything not recognised falls back to the least-privileged role rather than
-- being left dangling.
UPDATE "users"
SET "role" = 'STUDENT'
WHERE "role" NOT IN ('ADMIN', 'STUDENT');

-- Teacher-only tables are no longer referenced by the schema.
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "teacher_exam_assignments";
DROP TABLE IF EXISTS "teacher_profiles";
PRAGMA foreign_keys=on;
