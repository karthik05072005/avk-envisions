import type { Metadata } from 'next';
import { Bell } from 'lucide-react';

import { EmptyState } from '@/components/ui/states';
import { NotificationList } from '@/features/student/notification-list';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await enforceStudent('/notifications');

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Results, achievements and anything else that needs your attention.
        </p>
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet"
          description="When a result is ready, a new test is published or you unlock an achievement, it appears here."
          action={{ label: 'Find a test', href: '/my-tests' }}
        />
      ) : (
        <NotificationList
          notifications={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            linkUrl: n.linkUrl,
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
