import { db } from '@/lib/db';
import type { ServiceType } from '@/generated/prisma/client';

// Legacy's `MSSQLCustomerPricingRuleDAO.getOverlappingRules` — a customer can't have two
// *active* rules for the same service type with intersecting valid-date ranges. Enforced in
// legacy both at save time (`PricingService.createPricingRule`'s `validateRuleForConflicts`)
// and again by a DB trigger on every INSERT/UPDATE (`database/
// migration_add_overlap_trigger.sql`), so restoring a deactivated rule re-triggers the same
// check. This app has no direct-DB write path (every write goes through this API layer), so
// both call sites — create and restore — call this one check instead of a Postgres trigger.
export async function findOverlappingActiveRule({
  userId,
  serviceType,
  validFrom,
  validTo,
  excludeRuleId,
}: {
  userId: string;
  serviceType: ServiceType;
  validFrom: Date;
  validTo: Date | null;
  excludeRuleId?: string;
}) {
  return db.customerPricingRule.findFirst({
    where: {
      userId,
      serviceType,
      isActive: true,
      ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
      // newStart <= (other.validTo ?? infinity) && (new.validTo ?? infinity) >= other.validFrom
      validFrom: validTo ? { lte: validTo } : undefined,
      OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
    },
  });
}

export const OVERLAP_MESSAGE = 'Cannot create overlapping pricing rules for the same customer and service type.';
