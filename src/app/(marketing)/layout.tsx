import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { currentUser } from '@/server/auth/guards';
import { defaultRouteForRole } from '@/server/auth/permissions';

/**
 * Public marketing shell.
 *
 * The session is resolved on the server so a signed-in visitor sees a
 * "Dashboard" call to action immediately, with no post-hydration flip from
 * "Sign in" to "Dashboard".
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        session={user ? { name: user.name, dashboardHref: defaultRouteForRole(user.role) } : null}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
