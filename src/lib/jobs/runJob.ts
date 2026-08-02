import { db } from '@/lib/db';

// Shared wrapper for every Phase 6 scheduled job (`scripts/cron/*.ts`, BullMQ workers) — see
// docs/decisions/0026-cron-phase6.md and docs/decisions/0004-scheduled-jobs.md's "log every
// run somewhere queryable... the legacy cron jobs currently fail silently in places; don't
// repeat that". Writes a `JobRun` row on start, and updates it to success/failed with a
// `detail` summary on completion — never swallows the job's own error, just records it and
// rethrows so the calling script still exits non-zero (a VDS crontab entry can alert on that).
export async function runJob(jobName: string, fn: () => Promise<string | void>): Promise<void> {
  const run = await db.jobRun.create({ data: { jobName } });
  try {
    const detail = (await fn()) ?? null;
    await db.jobRun.update({ where: { id: run.id }, data: { status: 'Success', finishedAt: new Date(), detail } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await db.jobRun.update({ where: { id: run.id }, data: { status: 'Failed', finishedAt: new Date(), detail } });
    throw err;
  }
}
