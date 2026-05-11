import { createFastifyApp } from "@/infra/http/fastify.ts";
import { buildApp } from "@/app.ts";
import type { FastifyInstance } from "fastify";

// Minimal in-memory doubles for integration tests.
// No real Postgres or Redis needed — repositories are swapped in each test.

export async function buildTestApp(
  pgPool: any = {},
  redis: any = {},
): Promise<FastifyInstance> {
  const app = createFastifyApp();
  await buildApp(app, { pgPool, redis });
  await app.ready();
  return app;
}

/**
 * Generate a real JWT for use in integration test Authorization headers.
 * Mirrors the secret used by auth.service and auth.hooks.
 */
export async function signTestToken(
  payload: { sub: string; email: string; role: string },
): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(
    "dev-secret-change-in-production-min-32-chars!!",
  );
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .sign(secret);
}
