/**
 * Removes every price and access restriction across the catalogue.
 *
 * The seeds already produce a free catalogue, but a seed only corrects rows it
 * touches. This clears prices, the early-bird ladder and entitlement
 * expiry on everything that already exists, so nothing is left behind priced
 * or locked.
 *
 * Reversible: the commerce path is intact, so restoring paid access means
 * putting prices back on the series that should carry them.
 *
 * Run with: npm run db:free
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('\nMaking the whole catalogue free and open...\n');

  const series = await db.testSeries.updateMany({
    data: {
      priceInPaise: 0,
      comparePriceInPaise: 0,
      tier1PriceInPaise: null,
      tier1Limit: null,
      tier2PriceInPaise: null,
      tier2Limit: null,
      accessDurationDays: 0,
    },
  });
  console.log(`  ok  ${series.count} test series set to free`);

  const tests = await db.test.updateMany({
    where: { accessType: { not: 'FREE' } },
    data: { accessType: 'FREE' },
  });
  console.log(`  ok  ${tests.count} tests opened`);

  // Existing purchases keep working; nothing is revoked. An entitlement that
  // was going to lapse simply never does now.
  const entitlements = await db.entitlement.updateMany({
    where: { expiresAt: { not: null } },
    data: { expiresAt: null },
  });
  console.log(`  ok  ${entitlements.count} existing entitlements made permanent`);

  // Subscription plans are a second commerce path. Leaving Pro at 1,499 and
  // Premium at 2,499 on the pricing page would contradict a catalogue that is
  // now entirely free, so the paid tiers are deactivated. They are not deleted:
  // reactivating them restores the previous offering unchanged.
  const plans = await db.subscriptionPlan.updateMany({
    where: { priceInPaise: { gt: 0 } },
    data: { isActive: false },
  });
  console.log(`  ok  ${plans.count} paid subscription plans deactivated`);

  const stillPaid = await db.testSeries.count({ where: { priceInPaise: { gt: 0 } } });
  const stillLocked = await db.test.count({ where: { accessType: { not: 'FREE' }, deletedAt: null } });
  const activePaidPlans = await db.subscriptionPlan.count({
    where: { priceInPaise: { gt: 0 }, isActive: true },
  });
  console.log(`\n  remaining priced series: ${stillPaid}`);
  console.log(`  remaining locked tests:  ${stillLocked}\n`);

  if (stillPaid > 0 || stillLocked > 0 || activePaidPlans > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('\nFailed:', e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
