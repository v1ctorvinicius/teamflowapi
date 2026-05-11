// src/infra/db/postgres.ts
import pg from "pg";
import { config } from "../../config/env.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    pool.on("error", (err) => {
      console.error("[Postgres] Unexpected pool error:", err);
    });
  }

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[Postgres] Pool closed");
  }
}

export const pgPool = getPgPool();