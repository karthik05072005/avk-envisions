import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { db } from '@/server/db';

/**
 * Invitation to the WhatsApp channel, shown to people who have bought
 * something.
 *
 * A note on why this is a link rather than an automatic enrolment. WhatsApp
 * channels can only be followed by the person themselves — there is no API to
 * add someone, in the Business Platform or anywhere else, and the same is true
 * of groups. The nearest honest thing is to put the invitation in front of a
 * buyer at the moment they are most likely to take it, and keep it on their
 * account page afterwards.
 *
 * The URL lives in site settings so it can be changed from the admin panel
 * without a deploy; channel links get rotated.
 */
export async function CommunityInvite({ variant = 'panel' }: { variant?: 'panel' | 'inline' }) {
  const setting = await db.siteSetting.findUnique({
    where: { key: 'community.whatsappChannelUrl' },
    select: { value: true },
  });

  const url = setting?.value?.trim();
  if (!url) return null;

  if (variant === 'inline') {
    return (
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          Join the WhatsApp channel
        </a>
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-success/40 bg-success/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Join the AVK Envisions WhatsApp channel</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Test reminders, schedule changes and answer-key updates are posted there first. It is
              a broadcast channel, so your number stays private from other members.
            </p>
          </div>
        </div>

        <Button asChild size="lg" className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Join channel
          </a>
        </Button>
      </div>
    </div>
  );
}
