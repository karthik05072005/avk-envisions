import { requireUser } from '@/server/auth/guards';
import { createSession } from '@/server/auth/session';
import { parseBody, route } from '@/server/api-handler';
import { changePassword } from '@/server/services/auth-service';
import { changePasswordSchema } from '@/validations/auth';

/**
 * POST /api/auth/change-password
 *
 * When the user opts to sign out other devices, the account's session epoch is
 * bumped — which also invalidates the current device. A fresh session is issued
 * immediately afterwards so the person making the change stays signed in here.
 */
export const POST = route(async ({ request, ip, requestId }) => {
  const user = await requireUser();
  const input = await parseBody(request, changePasswordSchema);
  const userAgent = request.headers.get('user-agent');

  const result = await changePassword({
    userId: user.id,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
    signOutOtherDevices: input.signOutOtherDevices,
    context: { ipAddress: ip, userAgent, requestId },
  });

  if (result.requiresReauthentication) {
    await createSession({ userId: user.id, ipAddress: ip, userAgent });
  }

  return {
    data: { changed: true, otherDevicesSignedOut: input.signOutOtherDevices },
    message: input.signOutOtherDevices
      ? 'Password updated. You have been signed out on all other devices.'
      : 'Your password has been updated.',
  };
});
