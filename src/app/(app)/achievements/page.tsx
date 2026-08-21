import type { Metadata } from 'next';
import {
  Award,
  BookOpenCheck,
  Crown,
  Flame,
  Lock,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { cn, formatDate } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { getAchievements } from '@/server/services/achievement-service';

export const metadata: Metadata = {
  title: 'Achievements',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ICONS: Record<string, LucideIcon> = {
  Trophy,
  Award,
  Medal,
  Crown,
  Star,
  Flame,
  Target,
  Zap,
  Sparkles,
  BookOpenCheck,
};

/** Tier styling, so the same tier reads identically wherever it appears. */
const TIERS: Record<string, { ring: string; chip: string; label: string }> = {
  BRONZE: { ring: 'border-accent/40', chip: 'bg-accent/10 text-accent', label: 'Bronze' },
  SILVER: {
    ring: 'border-muted-foreground/30',
    chip: 'bg-muted-foreground/10 text-muted-foreground',
    label: 'Silver',
  },
  GOLD: { ring: 'border-warning/40', chip: 'bg-warning/10 text-warning', label: 'Gold' },
  PLATINUM: { ring: 'border-primary/40', chip: 'bg-primary/10 text-primary', label: 'Platinum' },
};

const CATEGORY_LABELS: Record<string, string> = {
  TESTS: 'Tests',
  QUESTIONS: 'Questions',
  ACCURACY: 'Accuracy',
  STREAK: 'Consistency',
  RANK: 'Ranking',
  MILESTONE: 'Milestones',
};

export default async function AchievementsPage() {
  const user = await enforceStudent('/achievements');
  const { achievements, totalPoints, unlockedCount } = await getAchievements(user.id);

  // Group by category so the page reads as a set of ladders, not a flat wall.
  const grouped = achievements.reduce<Record<string, typeof achievements>>((acc, achievement) => {
    (acc[achievement.category] ??= []).push(achievement);
    return acc;
  }, {});

  const nextUp = achievements
    .filter((a) => !a.unlocked && a.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Achievements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earned from your actual record — every badge is recalculated from your attempts, not
          awarded on a whim.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unlocked" value={`${unlockedCount} / ${achievements.length}`} icon={Trophy} />
        <StatCard label="Points earned" value={totalPoints} icon={Star} />
        <StatCard
          label="Completion"
          value={`${achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%`}
          icon={Target}
        />
      </div>

      {/* Closest to unlocking ------------------------------------------- */}
      {nextUp.length > 0 && (
        <Card variant="accent">
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-semibold tracking-tight">Closest to unlocking</h2>
            <ul className="mt-4 space-y-4">
              {nextUp.map((achievement) => (
                <li key={achievement.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{achievement.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {achievement.progressLabel}
                    </span>
                  </div>
                  <Progress value={achievement.progress} className="mt-1.5" size="sm" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Ladders --------------------------------------------------------- */}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2
            id={`cat-${category}`}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {CATEGORY_LABELS[category] ?? category}
          </h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((achievement) => {
              const Icon = ICONS[achievement.iconName] ?? Trophy;
              const tier = TIERS[achievement.tier] ?? TIERS.BRONZE!;

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    'flex flex-col rounded-xl border bg-card p-5 transition-all',
                    achievement.unlocked ? tier.ring : 'border-border',
                    !achievement.unlocked && 'opacity-75',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl',
                        achievement.unlocked ? tier.chip : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {achievement.unlocked ? (
                        <Icon className="size-5" aria-hidden="true" />
                      ) : (
                        <Lock className="size-4" aria-hidden="true" />
                      )}
                    </span>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={achievement.unlocked ? 'success' : 'muted'} size="sm">
                        {tier.label}
                      </Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {achievement.points} pts
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-3.5 font-semibold leading-tight tracking-tight">
                    {achievement.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {achievement.description}
                  </p>

                  {achievement.unlocked ? (
                    <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-success">
                      <Trophy className="size-3.5" aria-hidden="true" />
                      Unlocked
                      {achievement.unlockedAt && ` · ${formatDate(achievement.unlockedAt, 'short')}`}
                    </p>
                  ) : (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                        <span>{achievement.progressLabel}</span>
                        <span className="tabular-nums">{achievement.progress}%</span>
                      </div>
                      <Progress value={achievement.progress} className="mt-1.5" size="sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
