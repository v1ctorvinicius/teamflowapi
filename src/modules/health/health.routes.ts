import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { RedisClientType } from "redis";

async function checkPostgres(pool: Pool) {
  const start = Date.now();
  try {
    const result = await pool.query("SELECT NOW() as db_time, version() as version");
    return {
      status: "healthy" as const,
      responseTimeMs: Date.now() - start,
      timestamp: result.rows[0].db_time,
      version: (result.rows[0].version as string).split(",")[0],
    };
  } catch (error: any) {
    return {
      status: "unhealthy" as const,
      responseTimeMs: Date.now() - start,
      error: error.message,
    };
  }
}

async function checkRedis(redis: RedisClientType | null) {
  if (!redis) {
    return {
      status: "disabled" as const,
      responseTimeMs: 0,
    };
  }

  const start = Date.now();
  try {
    const ping = await redis.ping();
    const testKey = `health:${Date.now()}`;
    await redis.set(testKey, "ok", { EX: 10 });
    const value = await redis.get(testKey);
    return {
      status: "healthy" as const,
      responseTimeMs: Date.now() - start,
      ping,
      testWrite: value === "ok",
    };
  } catch (error: any) {
    return {
      status: "unhealthy" as const,
      responseTimeMs: Date.now() - start,
      error: error.message,
    };
  }
}

export async function healthRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool; redis: RedisClientType | null },
) {
  const { pgPool, redis } = options;

  // GET /health — full dependency check
  app.get("/health", { logLevel: "warn" }, async (_req, reply) => {
    const start = Date.now();
    const [postgres, redisResult] = await Promise.all([
      checkPostgres(pgPool),
      checkRedis(redis),
    ]);

    const isHealthy = postgres.status === "healthy";

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - start,
      services: { postgres, redis: redisResult },
      uptime: process.uptime(),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  // GET /live — liveness probe (no external checks)
  app.get("/live", { logLevel: "warn" }, async (_req, reply) => {
    return reply.status(200).send({
      status: "alive",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // GET /ready — readiness probe
  app.get("/ready", { logLevel: "warn" }, async (_req, reply) => {
    const [postgres, redisResult] = await Promise.all([
      checkPostgres(pgPool),
      checkRedis(redis),
    ]);

    const isReady = postgres.status === "healthy";

    return reply.status(isReady ? 200 : 503).send({
      ready: isReady,
      services: {
        postgres: postgres.status === "healthy",
        redis: redisResult.status === "healthy",
      },
    });
  });
}