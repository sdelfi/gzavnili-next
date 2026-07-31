'use client';

import { Suspense } from 'react';
import { PricingRulesAdminPage } from '@/components/admin/pricingRules/PricingRulesAdminPage';

export default function PricingRulesPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <PricingRulesAdminPage />
    </Suspense>
  );
}
