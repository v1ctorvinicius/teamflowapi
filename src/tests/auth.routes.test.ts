// auth.routes.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createFastifyApp } from "@/infra/http/fastify.ts";
import { authRoutes } from "@/modules/auth/auth.routes.ts";
import { makeUser, makeRefreshToken } from "@/helpers/factories.ts";
import { createHash, scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(plain, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockFindByEmail = vi.fn();
const mockFindById = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockFindRefreshToken = vi.fn();
const mockRevokeRefreshToken = vi.fn();
const mockRevokeAllUserTokens = vi.fn();

vi.mock("@/modules/user/user.repository.pg.ts", () => {
  return {
    PostgresUsersRepository: class {
      findByEmail = mockFindByEmail
      findById = mockFindById
      create = vi.fn()
      update = vi.fn()
    }
  }
})

vi.mock("@/modules/auth/auth.repository.pg.ts", () => {
  return {
    PostgresAuthRepository: class {
      saveRefreshToken = mockSaveRefreshToken
      findRefreshToken = mockFindRefreshToken
      revokeRefreshToken = mockRevokeRefreshToken
      revokeAllUserTokens = mockRevokeAllUserTokens
    }
  }
})

describe("Auth routes — integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createFastifyApp();
    await app.register(authRoutes, { prefix: "/auth", pgPool: {} as any });
    await app.ready();
  });

  afterAll(() => app.close());

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe("POST /auth/login", () => {
    it("returns 200 with token pair on valid credentials", async () => {
      const hash = await hashPassword("senha123");
      mockFindByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      mockSaveRefreshToken.mockResolvedValue(makeRefreshToken());

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "fan@teamflow.com", password: "senha123" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
    });

    it("returns 401 on wrong password", async () => {
      const hash = await hashPassword("correta");
      mockFindByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "fan@teamflow.com", password: "errada" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when user is not found", async () => {
      mockFindByEmail.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "ghost@test.com", password: "senha123" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when email field is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { password: "senha123" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("does not leak whether the email exists (same error for both cases)", async () => {
      mockFindByEmail.mockResolvedValue(null);
      const resNotFound = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "ghost@test.com", password: "qualquer" },
      });

      const hash = await hashPassword("correta");
      mockFindByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      const resWrongPass = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "fan@teamflow.com", password: "errada" },
      });

      expect(resNotFound.json().error.message).toBe(
        resWrongPass.json().error.message,
      );
    });
  });

  // ─── POST /auth/refresh ───────────────────────────────────────────────────

  describe("POST /auth/refresh", () => {
    it("returns 200 with new token pair on valid refresh token", async () => {
      const rawToken = "valid-raw-refresh-token";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockFindRefreshToken.mockResolvedValue(
        makeRefreshToken({ tokenHash }),
      );
      mockFindById.mockResolvedValue(makeUser());
      mockSaveRefreshToken.mockResolvedValue(makeRefreshToken());

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: rawToken },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.accessToken).toBeTruthy();
      // Old token must have been revoked
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith(tokenHash);
    });

    it("returns 401 on invalid refresh token", async () => {
      mockFindRefreshToken.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "invalid-token" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /auth/logout ────────────────────────────────────────────────────

  describe("POST /auth/logout", () => {
    it("returns 204 and revokes the token", async () => {
      const rawToken = "token-to-revoke";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      const res = await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken: rawToken },
      });

      expect(res.statusCode).toBe(204);
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith(tokenHash);
    });
  });
});
