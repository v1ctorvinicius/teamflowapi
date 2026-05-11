// src/modules/auth/auth.service.ts

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { SignJWT, jwtVerify } from "jose";

import type { AuthRepository } from "./auth.repository.ts";
import type { TokenPair, LoginInput, JwtPayload } from "./auth.types.ts";

import type { UsersRepository } from "../user/user.repository.ts";

import { UnauthorizedError } from "../../shared/errors.ts";
import { config } from "../../config/env.ts";

const scryptAsync = promisify(scrypt);

async function verifyPassword(
  plain: string,
  stored: string,
  ): Promise<boolean> {
  const [salt, hash] = stored.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = (await scryptAsync(
    plain,
    salt,
    64,
    )) as Buffer;

  const storedKey = Buffer.from(hash, "hex");

  return (
    derivedKey.length === storedKey.length &&
    timingSafeEqual(derivedKey, storedKey)
    );
}

function hashToken(token: string): string {
  return createHash("sha256")
  .update(token)
  .digest("hex");
}

const JWT_SECRET = new TextEncoder().encode(
  config.jwt.privateKey,
  );

const ACCESS_TOKEN_TTL = config.jwt.accessExpiresIn;
const REFRESH_TTL_DAYS = 7;

export class AuthService {
  constructor(
    private authRepo: AuthRepository,
    private usersRepo: UsersRepository,
    ) {}

  async login(input: LoginInput): Promise<TokenPair> {
    const user = await this.usersRepo.findByEmail(
      input.email.toLowerCase(),
      );

    if (!user) {
      throw new UnauthorizedError(
        "Invalid email or password",
        );
    }

    const passwordValid = await verifyPassword(
      input.password,
      user.passwordHash,
      );

    if (!passwordValid) {
      throw new UnauthorizedError(
        "Invalid email or password",
        );
    }

    return this.issueTokenPairForUser(
      user.id,
      user.email,
      user.role,
      );
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);

    const stored =
    await this.authRepo.findRefreshToken(tokenHash);

    if (!stored) {
      throw new UnauthorizedError(
        "Invalid or expired refresh token",
        );
    }

    await this.authRepo.revokeRefreshToken(tokenHash);

    const user = await this.usersRepo.findById(
      stored.userId,
      );

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    return this.issueTokenPairForUser(
      user.id,
      user.email,
      user.role,
      );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    await this.authRepo.revokeRefreshToken(tokenHash);
  }

  async verifyAccessToken(
    token: string,
    ): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(
        token,
        JWT_SECRET,
        );

      return payload as JwtPayload;
    } catch {
      throw new UnauthorizedError(
        "Invalid or expired access token",
        );
    }
  }

  async issueTokenPairForUser(
    userId: string,
    email: string,
    role: string,
    ): Promise<TokenPair> {
    const accessToken = await new SignJWT({
      sub: userId,
      email,
      role,
    })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);

    const rawRefresh = randomBytes(64).toString("hex");

    const tokenHash = hashToken(rawRefresh);

    const expiresAt = new Date(
      Date.now() +
      REFRESH_TTL_DAYS *
      24 *
      60 *
      60 *
      1000,
      );

    await this.authRepo.saveRefreshToken(
      userId,
      tokenHash,
      expiresAt,
      );

    return {
      accessToken,
      refreshToken: rawRefresh,
    };
  }
}