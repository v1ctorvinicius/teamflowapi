// auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "@/modules/auth/auth.service.ts";
import { mockAuthRepo, mockUsersRepo } from "../helpers/mocks.ts";
import { makeUser, makeRefreshToken } from "../helpers/factories.ts";
import { UnauthorizedError } from "@/shared/errors.ts";
import { createHash, scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// Build a real password hash that auth.service can verify
async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(plain, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

function sha256(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

describe("AuthService", () => {
  let authRepo: ReturnType<typeof mockAuthRepo>;
  let usersRepo: ReturnType<typeof mockUsersRepo>;
  let service: AuthService;

  beforeEach(() => {
    authRepo = mockAuthRepo();
    usersRepo = mockUsersRepo();
    service = new AuthService(authRepo, usersRepo);
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns an access token and refresh token on valid credentials", async () => {
      const hash = await hashPassword("senha123");
      usersRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      authRepo.saveRefreshToken.mockResolvedValue(makeRefreshToken());

      const tokens = await service.login({
        email: "fan@teamflow.com",
        password: "senha123",
      });

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(authRepo.saveRefreshToken).toHaveBeenCalledOnce();
    });

    it("lowercases email before querying", async () => {
      usersRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "FAN@TEAMFLOW.COM", password: "abc" }),
      ).rejects.toThrow(UnauthorizedError);

      expect(usersRepo.findByEmail).toHaveBeenCalledWith("fan@teamflow.com");
    });

    it("throws UnauthorizedError when user is not found", async () => {
      usersRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "ghost@test.com", password: "senha123" }),
      ).rejects.toThrow(UnauthorizedError);

      expect(authRepo.saveRefreshToken).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError on wrong password", async () => {
      const hash = await hashPassword("correta");
      usersRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(
        service.login({ email: "fan@teamflow.com", password: "errada" }),
      ).rejects.toThrow(UnauthorizedError);

      expect(authRepo.saveRefreshToken).not.toHaveBeenCalled();
    });

    it("uses a generic error message to prevent user enumeration", async () => {
      usersRepo.findByEmail.mockResolvedValue(null);

      const error = await service
        .login({ email: "ghost@test.com", password: "any" })
        .catch((e) => e);

      expect(error.message).toBe("Invalid email or password");
    });

    it("saves the hash of the refresh token, not the raw token", async () => {
      const hash = await hashPassword("senha123");
      usersRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      authRepo.saveRefreshToken.mockResolvedValue(makeRefreshToken());

      const { refreshToken } = await service.login({
        email: "fan@teamflow.com",
        password: "senha123",
      });

      const [, savedHash] = authRepo.saveRefreshToken.mock.calls[0];
      expect(savedHash).toBe(sha256(refreshToken));
      expect(savedHash).not.toBe(refreshToken);
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("issues a new token pair and revokes the old refresh token", async () => {
      const rawToken = "raw-refresh-token-value";
      authRepo.findRefreshToken.mockResolvedValue(
        makeRefreshToken({ tokenHash: sha256(rawToken) }),
      );
      usersRepo.findById.mockResolvedValue(makeUser());
      authRepo.saveRefreshToken.mockResolvedValue(makeRefreshToken());

      const tokens = await service.refresh(rawToken);

      expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith(sha256(rawToken));
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      // New refresh token must differ from the old one
      expect(tokens.refreshToken).not.toBe(rawToken);
    });

    it("throws UnauthorizedError when token is not found or expired", async () => {
      authRepo.findRefreshToken.mockResolvedValue(null);

      await expect(service.refresh("invalid-token")).rejects.toThrow(
        UnauthorizedError,
      );

      expect(authRepo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError when associated user no longer exists", async () => {
      authRepo.findRefreshToken.mockResolvedValue(makeRefreshToken());
      usersRepo.findById.mockResolvedValue(null);

      await expect(service.refresh("some-token")).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("revokes the refresh token by its hash", async () => {
      const rawToken = "raw-refresh-token";

      await service.logout(rawToken);

      expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith(sha256(rawToken));
    });
  });

  // ─── verifyAccessToken ────────────────────────────────────────────────────

  describe("verifyAccessToken", () => {
    it("returns the payload for a valid token", async () => {
      const hash = await hashPassword("senha123");
      usersRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      authRepo.saveRefreshToken.mockResolvedValue(makeRefreshToken());

      const { accessToken } = await service.login({
        email: "fan@teamflow.com",
        password: "senha123",
      });

      const payload = await service.verifyAccessToken(accessToken);
      expect(payload.sub).toBe("user-uuid-1");
      expect(payload.email).toBe("fan@teamflow.com");
    });

    it("throws UnauthorizedError for a tampered token", async () => {
      await expect(
        service.verifyAccessToken("not.a.real.jwt"),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
