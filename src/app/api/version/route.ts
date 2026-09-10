import { NextResponse } from 'next/server';

/**
 * Which commit is actually serving.
 *
 * Deploys happen on their own now — a timer notices origin/main has moved and
 * builds it — so the question "is my change live yet?" has no obvious answer
 * without opening a terminal on the VM, which is the thing being avoided.
 *
 * The commit is read at build time from the environment, so it describes the
 * running build rather than whatever the working tree says now.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'unknown',
    builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? 'unknown',
    now: new Date().toISOString(),
  });
}
