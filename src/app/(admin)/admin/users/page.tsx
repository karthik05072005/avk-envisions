import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { UserTable } from '@/features/admin/user-table';
import { enforceAdminArea } from '@/server/auth/guards';
import { listUsers } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Users',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await enforceAdminArea('/admin/users');
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const result = await listUsers({ search: params.q, role: params.role, page });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.total} {result.total === 1 ? 'account' : 'accounts'}
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Name or email"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="role" className="text-xs font-medium text-muted-foreground">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={params.role ?? ''}
                className="mt-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="ADMIN">Admin</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
            {(params.q || params.role) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/users">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users match"
          description="Try a different search, or clear the filters."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <UserTable
              currentUserId={admin.id}
              rows={result.rows.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                emailVerified: Boolean(user.emailVerified),
                lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
                createdAt: user.createdAt.toISOString(),
                attempts: user._count.attempts,
                orders: user._count.orders,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {result.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={`/admin/users?page=${page - 1}`}>Previous</Link>
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= result.totalPages}>
            <Link href={`/admin/users?page=${page + 1}`}>Next</Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
