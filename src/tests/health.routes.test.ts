import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createFastifyApp } from "@/infra/http/fastify.ts";
import { healthRoutes } from "@/modules/health/health.routes.ts";

function makePgPool(healthy: boolean) {
  return {
    query: healthy
      ? vi.fn().mockResolvedValue({
          rows: [{ db_time: new Date(), version: "PostgreSQL 15.0, compiled by..." }],
        })
      : vi.fn().mockRejectedValue(new Error("Connection refused")),
  };
}

function makeRedis(healthy: boolean) {
  return {
    ping: healthy
      ? vi.fn().mockResolvedValue("PONG")
      : vi.fn().mockRejectedValue(new Error("Redis unreachable")),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue("ok"),
  };
}

describe("Health routes — integration", () => {
  // ─── All healthy ──────────────────────────────────────────────────────────

  describe("when all services are healthy", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = createFastifyApp();
      await app.register(healthRoutes, {
        pgPool: makePgPool(true) as any,
        redis: makeRedis(true) as any,
      });
      await app.ready();
    });

    afterAll(() => app.close());

    it("GET /health returns 200 with healthy status", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("healthy");
      expect(body.services.postgres.status).toBe("healthy");
      expect(body.services.redis.status).toBe("healthy");
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(body.memoryMb).toBeGreaterThan(0);
    });

    it("GET /live returns 200 with alive status", async () => {
      const res = await app.inject({ method: "GET", url: "/live" });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("alive");
    });

    it("GET /ready returns 200 when all services are ready", async () => {
      const res = await app.inject({ method: "GET", url: "/ready" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ready).toBe(true);
      expect(body.services.postgres).toBe(true);
      expect(body.services.redis).toBe(true);
    });
  });

  // ─── Postgres down ────────────────────────────────────────────────────────

  describe("when Postgres is down", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = createFastifyApp();
      await app.register(healthRoutes, {
        pgPool: makePgPool(false) as any,
        redis: makeRedis(true) as any,
      });
      await app.ready();
    });

    afterAll(() => app.close());

    it("GET /health returns 503 with degraded status", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe("degraded");
      expect(body.services.postgres.status).toBe("unhealthy");
      expect(body.services.redis.status).toBe("healthy");
    });

    it("GET /ready returns 503", async () => {
      const res = await app.inject({ method: "GET", url: "/ready" });
      expect(res.statusCode).toBe(503);
      expect(res.json().ready).toBe(false);
    });

    it("GET /live still returns 200 (process is alive)", async () => {
      const res = await app.inject({ method: "GET", url: "/live" });
      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Redis down ───────────────────────────────────────────────────────────

  describe("when Redis is down", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = createFastifyApp();
      await app.register(healthRoutes, {
        pgPool: makePgPool(true) as any,
        redis: makeRedis(false) as any,
      });
      await app.ready();
    });

    afterAll(() => app.close());

    it("GET /health returns 503 with degraded status", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe("degraded");
      expect(body.services.postgres.status).toBe("healthy");
      expect(body.services.redis.status).toBe("unhealthy");
    });
  });
});
