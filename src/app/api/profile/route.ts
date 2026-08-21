import { z } from 'zod';

import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { cuidSchema, nameSchema, optionalText } from '@/validations/common';
import { Language } from '@/lib/enums';

/**
 * Profile, onboarding and notification preferences.
 *
 * One endpoint because they are the same write from the user's point of view —
 * "these are my details" — and splitting them would mean three round trips from
 * the settings page for what is conceptually one save.
 */
const profileSchema = z.object({
  name: nameSchema.optional(),
  displayName: optionalText(40),
  city: optionalText(80),
  state: optionalText(80),
  targetExamId: cuidSchema.nullish(),
  targetYear: z.coerce.number().int().min(2000).max(2100).nullish(),
  preferredLanguage: Language.schema.optional(),
  /** Controls whether this student appears on public leaderboards. */
  leaderboardVisible: z.boolean().optional(),

  notifications: z
    .object({
      emailEnabled: z.boolean().optional(),
      newTestAlerts: z.boolean().optional(),
      testReminders: z.boolean().optional(),
      resultAlerts: z.boolean().optional(),
      studyReminders: z.boolean().optional(),
      achievementAlerts: z.boolean().optional(),
      subscriptionAlerts: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
    })
    .optional(),

  /** Set when the post-registration onboarding step is completed or skipped. */
  completeOnboarding: z.boolean().optional(),
});

export const PATCH = route(async ({ request, ip }) => {
  const user = await requireUser();
  const input = await parseBody(request, profileSchema);

  await db.$transaction(async (tx) => {
    if (input.name) {
      await tx.user.update({ where: { id: user.id }, data: { name: input.name } });
    }

    const profileFields = {
      ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.state !== undefined ? { state: input.state || null } : {}),
      ...(input.targetExamId !== undefined ? { targetExamId: input.targetExamId || null } : {}),
      ...(input.targetYear !== undefined ? { targetYear: input.targetYear ?? null } : {}),
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.leaderboardVisible !== undefined
        ? { leaderboardVisible: input.leaderboardVisible }
        : {}),
      // Stamped once. Re-running onboarding should not reset the original date.
      ...(input.completeOnboarding ? { onboardedAt: new Date() } : {}),
    };

    if (Object.keys(profileFields).length > 0) {
      // Upsert, not update: a profile row may not exist for an account created
      // before the profile table, or by an admin.
      await tx.studentProfile.upsert({
        where: { userId: user.id },
        update: profileFields,
        create: { userId: user.id, displayName: user.name, ...profileFields },
      });
    }

    if (input.notifications) {
      await tx.notificationPreference.upsert({
        where: { userId: user.id },
        update: input.notifications,
        create: { userId: user.id, ...input.notifications },
      });
    }
  });

  await audit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.PROFILE_UPDATED,
    entityType: 'User',
    entityId: user.id,
    // Field names only — the values are the user's own personal details.
    meta: { fields: Object.keys(input) },
    ipAddress: ip,
  });

  return { data: { saved: true }, message: 'Saved.' };
});
