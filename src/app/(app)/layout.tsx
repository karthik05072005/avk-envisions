import { AppHeader, AppSidebar } from '@/components/app/app-nav';
import { enforceStudent } from '@/server/auth/guards';
import { getUnreadNotificationCount } from '@/server/services/dashboard-service';

/**
 * Authenticated student shell.
 *
 * `enforceStudent` runs on the server before anything renders, so staff and
 * signed-out visitors are redirected rather than briefly seeing student chrome.
 * Every nested page can therefore assume a valid STUDENT session.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await enforceStudent();
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <div className="flex min-h-dvh bg-muted/20">
      <AppSidebar user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
          unreadCount={unreadCount}
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
