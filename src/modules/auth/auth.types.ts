import type { UUID, ISODateString } from "../../shared/types.ts";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: UUID;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshToken {
  id: UUID;
  userId: UUID;
  tokenHash: string;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  revokedAt: ISODateString | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}
