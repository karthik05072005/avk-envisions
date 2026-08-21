import { z } from 'zod';

import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { settingSchema } from '@/validations/admin';

const batchSchema = z.object({ settings: z.array(settingSchema).min(1).max(100) });

/**
 * PUT /api/admin/settings — update platform settings.
 *
 * Only keys that already exist are written. Settings are seeded with their
 * type and grouping, and letting the client invent new keys would produce rows
 * the admin UI cannot render or explain.
 */
export const PUT = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, batchSchema);

  const known = await db.siteSetting.findMany({
    where: { key: { in: input.settings.map((s) => s.key) } },
    select: { key: true, value: true },
  });
  const knownByKey = new Map(known.map((s) => [s.key, s.value]));

  const changed = input.settings.filter(
    (setting) => knownByKey.has(setting.key) && knownByKey.get(setting.key) !== setting.value,
  );

  if (changed.length > 0) {
    await db.$transaction(
      changed.map((setting) =>
        // `updatedAt` is maintained by Prisma; who changed it is recorded in
        // the audit log rather than denormalised onto the row.
        db.siteSetting.update({
          where: { key: setting.key },
          data: { value: setting.value },
        }),
      ),
    );

    await audit({
      actor: { id: admin.id, email: admin.email, role: admin.role },
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'SiteSetting',
      // Keys only — a value may hold a secret, and the audit log is read widely.
      meta: { keys: changed.map((s) => s.key) },
      ipAddress: ip,
    });
  }

  const ignored = input.settings.length - changed.length;

  return {
    data: { updated: changed.length, ignored },
    message:
      changed.length === 0
        ? 'Nothing changed.'
        : `Updated ${changed.length} setting${changed.length === 1 ? '' : 's'}.`,
  };
});
