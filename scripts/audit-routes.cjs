/**
 * Route audit.
 *
 * Walks the app directory to build the set of routes that actually exist, then
 * scans the whole source tree for internal links, redirects and router pushes.
 * Anything referenced but not built is a dead end a user can reach.
 *
 * Run with: node scripts/audit-routes.cjs
 */
const fs = require('fs');
const path = require('path');

const APP = 'src/app';
const SRC = 'src';

// ---------------------------------------------------------------------------
// 1. Routes that exist
// ---------------------------------------------------------------------------

/** Collects every page route, resolving route groups and dynamic segments. */
function collectRoutes(dir, segments = []) {
  const routes = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // (group) folders do not appear in the URL.
      const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
      routes.push(...collectRoutes(full, isGroup ? segments : [...segments, entry.name]));
      continue;
    }

    if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      routes.push('/' + segments.join('/'));
    }
  }

  return routes;
}

const existing = new Set(collectRoutes(APP).map((r) => (r === '/' ? '/' : r.replace(/\/$/, ''))));

/** Matches a concrete path against routes that may contain [dynamic] segments. */
function routeExists(target) {
  if (existing.has(target)) return true;

  const parts = target.split('/').filter(Boolean);

  for (const route of existing) {
    const routeParts = route.split('/').filter(Boolean);
    if (routeParts.length !== parts.length) continue;

    const matches = routeParts.every(
      (segment, i) =>
        segment === parts[i] ||
        (segment.startsWith('[') && segment.endsWith(']')),
    );
    if (matches) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// 2. Internal links referenced anywhere in the source
// ---------------------------------------------------------------------------

const references = new Map(); // path -> Set of files

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;

    const source = fs.readFileSync(full, 'utf8');

    const patterns = [
      /href="(\/[^"#?]*)"/g,
      // Object-literal form, used by the nav and footer link tables.
      /href:\s*'(\/[^']*)'/g,
      /href=\{`(\/[^`$]*)`\}/g,
      /redirect\('(\/[^']*)'\)/g,
      /router\.(?:push|replace)\('(\/[^']*)'\)/g,
      /(?:enforceAuth|enforceStudent|enforceAdminArea)\('(\/[^']*)'\)/g,
      /action:\s*\{\s*label:[^}]*href:\s*'(\/[^']*)'/g,
      /secondaryAction:\s*\{\s*label:[^}]*href:\s*'(\/[^']*)'/g,
      /redirectTo:\s*'(\/[^']*)'/g,
    ];

    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        let target = match[1];
        if (!target || !target.startsWith('/')) continue;

        // Strip query strings and trailing slashes.
        target = target.split('?')[0].split('#')[0];
        if (target.length > 1) target = target.replace(/\/$/, '');
        // Skip template-literal placeholders and API routes.
        if (target.includes('${') || target.startsWith('/api/')) continue;
        if (target === '') target = '/';

        if (!references.has(target)) references.set(target, new Set());
        references.get(target).add(full.replace(/\\/g, '/'));
      }
    }
  }
}

walk(SRC);

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

const broken = [...references.entries()]
  .filter(([target]) => !routeExists(target))
  .sort((a, b) => b[1].size - a[1].size);

console.log(`\nRoutes built:      ${existing.size}`);
console.log(`Internal links:    ${references.size}`);
console.log(`Broken references: ${broken.length}\n`);

if (broken.length === 0) {
  console.log('No dead links. Every internal link points at a route that exists.\n');
} else {
  console.log('DEAD LINKS — referenced but never built:\n');
  for (const [target, files] of broken) {
    console.log(`  ${target}`);
    for (const file of [...files].slice(0, 3)) {
      console.log(`      ${file}`);
    }
    if (files.size > 3) console.log(`      …and ${files.size - 3} more`);
  }
  console.log('');
}

process.exit(broken.length === 0 ? 0 : 1);
