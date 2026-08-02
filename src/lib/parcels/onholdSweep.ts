// Pure predicates for `scripts/cron/onhold.ts` (legacy `cron/onhold.cfm`) — see
// docs/decisions/0026-cron-phase6.md. Split out from the script so the one genuinely
// non-obvious bit (case handling) has a test.

// Legacy: `trackingnum not like 'p%' and trackingnum not like 'd%' and trackingnum not like
// 'r%'` under SQL Server's default case-insensitive collation. Tracking numbers are always
// stored upper-cased in this schema (every write path does this), so comparing against the
// upper-cased letters directly is the exact equivalent on real data.
export function startsWithPDR(trackingNum: string | null): boolean {
  if (!trackingNum) return false;
  return trackingNum.startsWith('P') || trackingNum.startsWith('D') || trackingNum.startsWith('R');
}
