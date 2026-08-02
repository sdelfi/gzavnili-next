import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { runJob } from '@/lib/jobs/runJob';
import { runNotificationEngine } from '@/lib/notifications/notificationEngine';

// BullMQ queue/worker for `cron/sendMessages.cfm`'s port (docs/decisions/0027-cron-
// notifications.md). Legacy's own commented-out `cfschedule` ran this every 600 seconds;
// reproduced as a BullMQ repeatable job on the same interval, alongside the SMS-queue drain
// worker — both make outbound gateway calls per run, the same "queue-worthy" rationale
// `docs/decisions/0004-scheduled-jobs.md` already applied to `smsQueueWorker.ts`.
export const NOTIFICATION_ENGINE_QUEUE_NAME = 'notification-engine';
const RUN_INTERVAL_MS = 600_000;

export function createNotificationEngineQueue(): Queue {
  return new Queue(NOTIFICATION_ENGINE_QUEUE_NAME, { connection: getRedisConnection() });
}

export async function scheduleNotificationEngine(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(NOTIFICATION_ENGINE_QUEUE_NAME, { every: RUN_INTERVAL_MS }, { name: 'run' });
}

export function createNotificationEngineWorker(): Worker {
  return new Worker(
    NOTIFICATION_ENGINE_QUEUE_NAME,
    async () => {
      let detail = '';
      await runJob('notification-engine', async () => {
        const result = await runNotificationEngine();
        detail = `processed ${result.processedCount} operations, flushed ${result.geBatchFlushed} GE SMS batches`;
        return detail;
      });
      return detail;
    },
    { connection: getRedisConnection() },
  );
}
