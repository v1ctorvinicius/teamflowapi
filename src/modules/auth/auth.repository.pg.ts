import type { Pool } from "pg";
import type { AuthRepository } from "./auth.repository.ts";
import type { RefreshToken } from "./auth.types.ts";
import type { UUID } from "../../shared/types.ts";

function mapRowToToken(row: Record<string, unknown>): RefreshToken {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    expiresAt: (row.expires_at as Date).toISOString(),
    createdAt: (row.created_at as Date).toISOString(),
    revokedAt: row.revoked_at
      ? (row.revoked_at as Date).toISOString()
      : null,
  };
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private pool: Pool) {}

  async saveRefreshToken(
    userId: UUID,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    const result = await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, tokenHash, expiresAt],
    );
    return mapRowToToken(result.rows[0]);
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );
    return result.rows[0] ? mapRowToToken(result.rows[0]) : null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllUserTokens(userId: UUID): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}
