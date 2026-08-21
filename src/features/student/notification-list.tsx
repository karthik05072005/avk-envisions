'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Bell, CheckCheck, CreditCard, FileText, Info, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { cn, formatDate } from '@/lib/utils';

/**
 * Notification list.
 *
 * Reading a notification marks it read, which is what people expect — but only
 * the one they opened. Bulk "mark all" stays an explicit action so a glance at
 * the page does not silently clear a backlog someone meant to work through.
 */
export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  RESULT: Trophy,
  ACHIEVEMENT: Award,
  SUBSCRIPTION: CreditCard,
  TEST: FileText,
  SYSTEM: Info,
};

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const unread = notifications.filter((n) => !n.readAt).length;

  async function markOne(id: string) {
    try {
      await api.patch('/api/notifications', { notificationId: id });
      router.refresh();
    } catch {
      // Silent: failing to mark read must not interrupt following the link.
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await api.patch('/api/notifications', {});
      toast.success('All caught up.');
      router.refresh();
    } catch {
      toast.error('We could not mark those as read.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {unread > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {unread} unread {unread === 1 ? 'notification' : 'notifications'}
          </p>
          <Button variant="outline" size="sm" onClick={markAll} loading={busy}>
            <CheckCheck aria-hidden="true" />
            Mark all read
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const Icon = ICONS[notification.type] ?? Bell;
              const isUnread = !notification.readAt;

              const inner = (
                <div
                  className={cn(
                    'flex items-start gap-3.5 p-4 transition-colors',
                    isUnread && 'bg-primary-muted/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      isUnread ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium leading-tight">
                      {notification.title}
                      {isUnread && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(notification.createdAt, 'full')}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={notification.id}>
                  {notification.linkUrl ? (
                    <Link
                      href={notification.linkUrl}
                      onClick={() => isUnread && void markOne(notification.id)}
                      className="block hover:bg-muted/40"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => isUnread && void markOne(notification.id)}
                      className="block w-full text-left hover:bg-muted/40"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
