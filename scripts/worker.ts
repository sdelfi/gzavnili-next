#!/usr/bin/env bun
// Long-running worker process for the "queue-worthy" Phase 6 jobs (docs/decisions/
// 0004-scheduled-jobs.md, docs/decisions/0026-cron-phase6.md) — currently just the
// `sms_queue` drain. Meant to run under `systemd`/`pm2` alongside the Next.js server, not a
// crontab entry (those are `scripts/cron/*.ts`, one process per invocation).
import 'dotenv/config';
import {
  createSmsQueueDrainQueue,
  createSmsQueueDrainWorker,
  scheduleSmsQueueDrain,
} from '../src/lib/queue/smsQueueWorker';
import {
  createNotificationEngineQueue,
  createNotificationEngineWorker,
  scheduleNotificationEngine,
} from '../src/lib/queue/notificationEngineWorker';

async function main() {
  const drainQueue = createSmsQueueDrainQueue();
  await scheduleSmsQueueDrain(drainQueue);

  const drainWorker = createSmsQueueDrainWorker();
  drainWorker.on('failed', (job, err) => {
    console.error(`[worker] ${job?.name ?? 'sms-queue-drain'} failed:`, err);
  });

  const notificationQueue = createNotificationEngineQueue();
  await scheduleNotificationEngine(notificationQueue);

  const notificationWorker = createNotificationEngineWorker();
  notificationWorker.on('failed', (job, err) => {
    console.error(`[worker] ${job?.name ?? 'notification-engine'} failed:`, err);
  });

  console.log('[worker] sms-queue-drain scheduled every 180s, notification-engine every 600s, worker listening');

  const shutdown = async () => {
    console.log('[worker] shutting down');
    await drainWorker.close();
    await drainQueue.close();
    await notificationWorker.close();
    await notificationQueue.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
