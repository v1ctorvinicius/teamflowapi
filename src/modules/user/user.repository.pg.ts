import type { Pool } from "pg";
import type { UsersRepository } from "./user.repository.ts";
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
} from "./user.types.ts";
import type { Product } from "../product/product.types.ts";
import type { UUID } from "../../shared/types.ts";

function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as UUID,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    name: row.name as string,
    role: (row.role as User['role']) || 'CUSTOMER',
    favoriteTeam: row.favorite_team as string | undefined,
    emailVerified: (row.email_verified as boolean) ?? false,
    phone: row.phone as string | undefined,
    
    addressStreet: row.address_street as string | undefined,
    addressNumber: row.address_number as string | undefined,
    addressComplement: row.address_complement as string | undefined,
    addressCity: row.address_city as string | undefined,
    addressState: row.address_state as string | undefined,
    addressZip: row.address_zip as string | undefined,
    addressCountry: (row.address_country as string) || 'Brasil',
    
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapRowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    club: row.club as string,
    season: row.season as string,
    type: row.type as 'PLAYER' | 'FAN',
    category: (row.category as string) || 'SHIRT',
    enableCategoricalSizes: (row.enable_categorical_sizes as boolean) ?? false,
    categoricalSizesLabel: (row.categorical_sizes_label as string) || 'Tamanho',
    stockCategorical: row.stock_categorical as string[] || [],
    stockCategoricalBySize: row.stock_categorical_by_size as Record<string, number> || {},
    enableNumericSizes: (row.enable_numeric_sizes as boolean) ?? false,
    numericSizesLabel: (row.numeric_sizes_label as string) || 'Tamanho',
    stockNumeric: row.stock_numeric as Record<string, number> || {},
    basePrice: row.base_price as number,
    description: row.description as string | null,
    imageUrl: row.image_url as string | null,
    imageUrls: row.image_urls as string[] || [],
    isActive: (row.is_active as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    slug: row.slug as string,
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

  async updateProfile(userId: UUID, input: UpdateProfileInput): Promise<PublicUser> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
   
    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
   
    if (input.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(input.email);
    }
   
    if (input.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(input.phone);
    }
   
    if (input.favoriteTeam !== undefined) {
      fields.push(`favorite_team = $${idx++}`);
      values.push(input.favoriteTeam || null);
    }
   
    if (input.addressStreet !== undefined) {
      fields.push(`address_street = $${idx++}`);
      values.push(input.addressStreet || null);
    }
   
    if (input.addressNumber !== undefined) {
      fields.push(`address_number = $${idx++}`);
      values.push(input.addressNumber || null);
    }
   
    if (input.addressComplement !== undefined) {
      fields.push(`address_complement = $${idx++}`);
      values.push(input.addressComplement || null);
    }
   
    if (input.addressCity !== undefined) {
      fields.push(`address_city = $${idx++}`);
      values.push(input.addressCity || null);
    }
   
    if (input.addressState !== undefined) {
      fields.push(`address_state = $${idx++}`);
      values.push(input.addressState || null);
    }
   
    if (input.addressZip !== undefined) {
      fields.push(`address_zip = $${idx++}`);
      values.push(input.addressZip || null);
    }
   
    if (fields.length === 0) {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [userId],
      );
      const user = mapRowToUser(result.rows[0]);
      return this.excludePasswordHash(user);
    }
   
    fields.push(`updated_at = NOW()`);
    values.push(userId);
   
    const result = await this.pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx++} RETURNING *`,
      values,
    );
   
    const user = mapRowToUser(result.rows[0]);
    return this.excludePasswordHash(user);
  }

  async addToWishlist(userId: UUID, productId: UUID): Promise<void> {
    await this.pool.query(
      `INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, productId],
    );
  }
   
  async removeFromWishlist(userId: UUID, productId: UUID): Promise<void> {
    await this.pool.query(
      `DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2`,
      [userId, productId],
    );
  }
   
  async getWishlist(userId: UUID): Promise<Product[]> {
    const result = await this.pool.query(
      `SELECT p.* FROM products p
       INNER JOIN wishlist w ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId],
    );
   
    return result.rows.map(mapRowToProduct);
  }
   
  async isInWishlist(userId: UUID, productId: UUID): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2`,
      [userId, productId],
    );
   
    return result.rows.length > 0;
  }

  async updatePassword(userId: UUID, newPasswordHash: string): Promise<User> {
    const result = await this.pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newPasswordHash, userId],
    );
    return mapRowToUser(result.rows[0]);
  }

  async findProductById(productId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT id, name, club FROM products WHERE id = $1 AND is_active = true`,
      [productId],
    );
    return result.rows[0] || null;
  }
   
  private excludePasswordHash(user: User): PublicUser {
    const { passwordHash: _, ...publicUser } = user;
    return publicUser as PublicUser;
  }
}
