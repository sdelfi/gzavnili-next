import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { runJob } from '@/lib/jobs/runJob';
import { drainSmsQueue } from '@/lib/services/smsQueueDrain';

// BullMQ queue/worker for the `sms_queue` drain (`cron/processSMSQueue.cfm` — see
// docs/decisions/0026-cron-phase6.md). Legacy's own commented-out `cfschedule` setup ran this
// every 180 seconds; reproduced as a BullMQ repeatable job on the same interval.
export const SMS_QUEUE_DRAIN_QUEUE_NAME = 'sms-queue-drain';
const DRAIN_INTERVAL_MS = 180_000;
const DRAIN_LIMIT = 50;

export function createSmsQueueDrainQueue(): Queue {
  return new Queue(SMS_QUEUE_DRAIN_QUEUE_NAME, { connection: getRedisConnection() });
}

export async function scheduleSmsQueueDrain(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(SMS_QUEUE_DRAIN_QUEUE_NAME, { every: DRAIN_INTERVAL_MS }, { name: 'drain' });
}

export function createSmsQueueDrainWorker(): Worker {
  return new Worker(
    SMS_QUEUE_DRAIN_QUEUE_NAME,
    async () => {
      let detail = '';
      await runJob('sms-queue-drain', async () => {
        const result = await drainSmsQueue(DRAIN_LIMIT);
        detail = `processed ${result.processed} of ${result.queueCountAtStart} queued`;
        return detail;
      });
      return detail;
    },
    { connection: getRedisConnection() },
  );
}
