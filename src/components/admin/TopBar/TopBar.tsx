'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTodayCollectedTotal } from '@/lib/api/bema/moneyCollect';
import { formatAmount } from '@/lib/parcels/format';
import s from './TopBar.module.css';

// Legacy bema layout (`lytBema.cfm`) always shows "You today collect: $X" in the top-right:
// the logged-in staff member's running total from money-collect rows whose manager date is today.
export function TopBar() {
  const [total, setTotal] = useState<number | null>(null);

  const load = useCallback(() => {
    getTodayCollectedTotal()
      .then((data) => setTotal(data.total))
      .catch(() => setTotal(null));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('bema:money-collected', load);
    return () => window.removeEventListener('bema:money-collected', load);
  }, [load]);

  return (
    <div className={s.bar}>
      <span className={s.label}>You today collect:</span>
      <span className={s.value}>{total == null ? '—' : `$${formatAmount(total)}`}</span>
    </div>
  );
}
