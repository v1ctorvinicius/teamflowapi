//src/server.ts
import { createFastifyApp } from "./infra/http/fastify.ts";
import { pgPool, closePgPool } from "./infra/db/postgres.ts";
// import { redisClient, connectRedis, closeRedis } from "./infra/cache/redis.ts";
import { buildApp } from "./app.ts";
import { config } from "./config/env.ts";
import "dotenv/config";

async function bootstrap() {
  const app = await createFastifyApp();

  // await connectRedis();

  // Register all routes
  await buildApp(app, { pgPool, redis: null as any });

  const PORT = config.port;

  // Start HTTP server
  try {
    const address = await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`[API] Server listening on port ${PORT}`);
    app.log.info(`[API] Health - /health`);
    app.log.info(`[API] Liveness - /live`);
    app.log.info(`[API] Readiness - /ready`);
    app.log.info(`[API] CORS enabled for configured origins`);
  } catch (err) {
    app.log.error(err, "[API] Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown
  async function shutdown(signal: string) {
    app.log.info(`[API] ${signal} received — shutting down gracefully`);
    try {
      await app.close();
      // await closeRedis();
      await closePgPool();
      app.log.info("[API] Shutdown complete");
      process.exit(0);
    } catch (err) {
      app.log.error(err, "[API] Error during shutdown");
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();