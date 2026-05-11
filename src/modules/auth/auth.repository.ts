import type { RefreshToken } from "./auth.types.ts";
import type { UUID } from "../../shared/types.ts";

export interface AuthRepository {
  saveRefreshToken(
    userId: UUID,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: UUID): Promise<void>;
}
