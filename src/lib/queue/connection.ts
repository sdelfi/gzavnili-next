import IORedis from 'ioredis';

// Shared BullMQ Redis connection (docs/decisions/0004-scheduled-jobs.md) — plain `redis:7`,
// no modules, self-hosted (`docker-compose.yml`'s `redis` service). `maxRetriesPerRequest:
// null` is BullMQ's own required setting for any connection it's handed (see BullMQ's docs —
// without it, blocking commands used internally can time out and drop jobs).
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}
