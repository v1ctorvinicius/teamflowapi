import type { Pool } from "pg";
import type { UsersRepository } from "./user.repository.ts";
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
} from "./user.types.ts";
import type { UUID } from "../../shared/types.ts";

function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    name: row.name as string,
    favoriteTeam: row.favorite_team as string | null,
    role: row.role as User["role"],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export class PostgresUsersRepository implements UsersRepository {
  constructor(private pool: Pool) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, favorite_team)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email, input.passwordHash, input.name, input.favoriteTeam ?? null],
    );
    return mapRowToUser(result.rows[0]);
  }

  async findById(id: UUID): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async update(id: UUID, input: UpdateUserInput): Promise<User> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.favoriteTeam !== undefined) {
      fields.push(`favorite_team = $${idx++}`);
      values.push(input.favoriteTeam);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return mapRowToUser(result.rows[0]);
  }
}
