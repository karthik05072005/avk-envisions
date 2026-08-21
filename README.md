# AVK Visions

A premium online examination and preparation platform — test series, mock tests,
practice, a reviewed question bank, and performance analytics that tell a student
what to study next.

> **Build status:** Phases 1–2 of 9 are implemented and verified. See
> [Implementation status](#implementation-status) for exactly what exists today
> and what does not. Nothing in this README describes a feature that has not
> been built.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Demo credentials](#demo-credentials)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Architecture](#architecture)
- [Implementation status](#implementation-status)
- [Testing](#testing)
- [Production deployment](#production-deployment)
- [Known limitations](#known-limitations)

---

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19 | Server components by default |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) | |
| Database | SQLite via Prisma 6 | Single-node by design; see [Known limitations](#known-limitations) |
| Styling | Tailwind CSS 3.4 + CSS custom properties | All tokens centralised |
| Components | Radix UI primitives, hand-built on top | shadcn-style, no CLI dependency |
| Auth | Email + password, Argon2id, DB-backed sessions | No OTP, phone, or social login |
| Validation | Zod, shared between client and server | |
| Email | Provider abstraction — Resend or console | |
| Payments | Razorpay (server-verified) | Not yet implemented |
| AI | Provider abstraction | Not yet implemented |
| Logging | pino, with secret redaction | |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    Then set AUTH_SECRET:  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 3. Create the database and apply migrations
npm run db:migrate

# 4. Seed realistic development content
npm run db:seed

# 5. Run
npm run dev
```

Open <http://localhost:3000>.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations without generating one (production) |
| `npm run db:seed` | Seed development data (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | **Destructive** — drop, re-migrate, re-seed |

---

## Demo credentials

Created by `npm run db:seed`. **Development only** — the seed refuses to run
against a non-file database unless `ALLOW_REMOTE_SEED=1` is set.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@avkvisions.com` | value of `SEED_ADMIN_PASSWORD` |
| Student | `student@avkvisions.com` | `Demo@Pass2024` |
| Student | `rohan@example.com` | `Demo@Pass2024` |
| Student | `meera@example.com` | `Demo@Pass2024` |

Change `SEED_ADMIN_PASSWORD` before seeding anything that is not a throwaway
local database.

---

## Environment variables

Every variable is documented in [`.env.example`](./.env.example) and validated at
startup by `src/lib/env.ts`. The server **refuses to boot** in production if a
required secret is missing or malformed, and prints every problem at once.

Non-fatal configuration issues (local file storage, no Redis, console email,
SQLite) are reported as startup warnings rather than errors, because each is a
legitimate single-node choice — they just rule out horizontal scaling.

Only `AUTH_SECRET` and `DATABASE_URL` are required to run locally.

---

## Database

SQLite was chosen deliberately for this build. Two consequences shape the schema:

**No native enums.** Every "enum" column is a `String`, with the allowed values
defined once in `src/lib/enums.ts` as a const tuple, a TypeScript union, and a Zod
schema. Validation happens at every API boundary. Each such column documents its
permitted values in `schema.prisma`.

**No scalar lists.** Repeated values use either a join table (when they need to be
queried) or a JSON-encoded `String` column suffixed `Json` (when they are only read
as a blob). Read those through the typed helpers in `src/lib/json.ts`, which
degrade to a safe default rather than throwing on malformed data.

Porting to PostgreSQL later means changing the `provider` in `schema.prisma` and,
optionally, promoting the documented `String` columns to real enums. No application
code depends on SQLite-specific behaviour.

Money is always stored as **integer paise**, never floats.

### Pragmas

`applySqlitePragmas()` runs at boot from `src/instrumentation.ts` and sets WAL mode,
a busy timeout, and `foreign_keys = ON` (off by default in SQLite — without it the
schema's referential guarantees are advisory only).

---

## Architecture

```
src/
  app/
    (marketing)/        Public site — server components
    api/                Route handlers, all wrapped by `route()`
  components/
    ui/                 Design-system primitives
    site/               Public site chrome
  emails/               HTML + plain-text templates
  lib/                  Isomorphic: enums, utils, api contract, env, json
  server/
    auth/               Password, tokens, sessions, permissions, guards
    services/           Business logic — the only place that mutates domain state
    db.ts               Prisma singleton + transaction helper
    api-handler.ts      Response envelope, error mapping, rate limiting
  validations/          Zod schemas shared with the client
prisma/
  schema.prisma         ~60 models
  seed.ts               Idempotent development seed
```

### API contract

Every endpoint returns one of exactly two shapes:

```jsonc
{ "success": true,  "data": {}, "message": "…", "meta": {} }
{ "success": false, "error": { "code": "…", "message": "…", "details": {}, "requestId": "…" } }
```

`AppError` is thrown anywhere in the server layer; `route()` maps it to the right
HTTP status. Internal errors never leak their message to the client in production —
the `requestId` on the response correlates to the full server log entry.

### Authentication

Email and password only. No OTP, phone, or social login anywhere in the codebase.

- **Hashing** — Argon2id at OWASP's baseline (19 MiB, t=2, p=1).
- **Sessions** — database-backed. The cookie holds a 256-bit random token; the
  database stores only its SHA-256 digest, so a database leak cannot be replayed
  as a login.
- **Two revocation paths** — `Session.revokedAt` kills one device;
  `User.sessionEpoch` is incremented on password change or "sign out everywhere"
  and instantly invalidates every session without touching each row.
- **Rate limiting** — per IP *and* per account, so rotating IPs cannot grind one
  account. Account lockout after 8 failures in 15 minutes, cleared by a success.
- **Timing** — a sign-in attempt against a non-existent account still performs an
  Argon2 hash, so a missing account is not detectably faster than a wrong password.
- **Enumeration** — password reset and resend-verification always return the same
  response whether or not the address is registered. Registration deliberately
  does not, because a signup form must tell you the email is taken; that endpoint
  is rate limited per IP instead.

### Authorization

Two roles, and only two: `ADMIN` and `STUDENT`.

- **`STUDENT`** — the learner. Attempts free and purchased tests, practises,
  tracks their own performance. Holds no permissions at all: everything a student
  may do is authorised by *owning the record* (their attempt, their bookmark,
  their ticket), not by a capability flag.
- **`ADMIN`** — runs the platform. Creates exams, questions and tests, manages
  users, content, orders and support. Holds every permission.

Permissions are dot-namespaced capability strings. An admin's base set is all of
them, with per-user grants and revocations applied on top — an explicit revocation
always wins, which is how one admin can be temporarily restricted without
inventing a third role.

Two guard families, and they are not interchangeable:

- `require*` — throw `AppError`. Use in route handlers and server actions.
- `enforce*` — redirect. Use in server components and layouts.

Both read a request-scoped cached session, so guarding a layout and then a nested
page costs one query, not two.

Because there is a single staff role, any admin can manage any other admin. That
is a deliberate consequence of the two-role model, appropriate for a small team
running one platform; it is the trade for not maintaining a role hierarchy nobody
needs.

---

## Implementation status

### Built and verified

- **Foundation** — project architecture, design system, ~60-model schema, initial
  migration, idempotent seed.
- **Authentication** — register, login, logout, email verification, forgot/reset
  password, change password, session listing, per-device and global revocation.
- **RBAC** — 58 permissions, five roles, route guards, teacher exam scoping.
- **Public site** — landing page with all 13 required sections, plus `/exams`,
  `/exams/[slug]` (full syllabus tree), `/test-series`, `/test-series/[slug]`
  (sales page), `/pricing`, `/blog` and `/blog/[slug]`. All read live CMS data;
  detail pages are statically pre-rendered with per-page SEO metadata and
  Article structured data.
- **Auth screens** — `/login`, `/register` (with live password-strength meter)
  and `/forgot-password`, on a shared split-screen shell, wired to the verified
  API.
- **Student dashboard** — `/dashboard` with the authenticated app shell
  (sidebar, mobile drawer, account menu, notification badge): performance stats,
  a ranked "do this next" list, subject breakdown, focus areas, recent attempts
  and available tests — every panel with a real empty state.
- **Infrastructure** — API envelope, error mapping, request ids, structured
  logging with secret redaction, audit log, rate limiting (Redis or in-process),
  email templates with a provider abstraction, startup config validation.

Verified by: `npm run build` passing, homepage rendering seeded content,
and an end-to-end auth flow (register → login → session → device list → logout).

### Not yet built

The following are specified but **not implemented**. No stub or fake version of
any of them exists in the codebase.

| Phase | Area |
| --- | --- |
| 2 | Admin question bank UI, CSV/Excel import, test builder |
| 2 | **Test engine** — attempt lifecycle, autosave, server timer, submission |
| 3 | Student dashboard, results, practice, bookmarks, leaderboards |
| 4 | Analytics, weak-topic engine, performance intelligence |
| 5 | Razorpay checkout, orders, invoices, coupons, subscriptions |
| 6 | Admin dashboard and CMS screens |
| 7 | Study planner, gamification, notifications, blog UI, support |
| 8 | AI question generation, AVK AI Coach, adaptive testing |
| 9 | Test suite, PWA, i18n wiring |

The schema, enums, permissions and service boundaries for all of the above are
already in place, which is why those phases are additive rather than structural.

---

## Testing

Vitest and Playwright are configured as dependencies, but **no test suite has been
written yet**. This is honest rather than aspirational: the spec requires unit
tests for scoring, negative marking, percentile, ranking, coupon calculation and
entitlement, and those modules do not exist yet.

Verification so far has been manual and is reproducible:

```bash
npm run typecheck   # passes
npm run build       # passes
npm run db:seed     # passes, idempotent
```

---

## Production deployment

1. Provision durable storage for the SQLite file, or migrate to PostgreSQL.
2. Set every variable in `.env.example`. `AUTH_SECRET` must be ≥ 32 characters.
3. `npm run db:deploy` — never `db:migrate` in production.
4. `npm run build && npm start`.
5. Terminate TLS in front of the app. Session cookies are `Secure` in production
   and will not be sent over plain HTTP.

Startup warnings will tell you which single-node constraints are active.

---

## Known limitations

- **SQLite serialises writers.** Correct for a single node; a submission burst
  from thousands of concurrent students needs PostgreSQL. WAL mode and a busy
  timeout mitigate but do not remove this.
- **In-process rate limiting** without `REDIS_URL`. Does not coordinate across
  instances.
- **Local file storage** loses uploads on an ephemeral filesystem. Use S3/R2 for
  containerised deployments.
- **`package.json#prisma`** is deprecated in favour of `prisma.config.ts` and will
  need migrating before Prisma 7. It emits a warning today but works.
- **No test suite yet** (see [Testing](#testing)).
