import type { Pool } from "pg";
import type { RedisClientType } from "redis";
import type { CartRepository } from "./cart.repository.ts";
import type { Cart, CartItem, AddItemInput } from "./cart.types.ts";
import type { UUID, ShirtSize } from "../../shared/types.ts";
import type { Personalization } from "../products/products.types.ts";

const SOFT_LOCK_TTL_SECONDS = 15 * 60; // 15 minutes

function mapRowToCartItem(row: Record<string, unknown>): CartItem {
  return {
    id: row.id as string,
    cartId: row.cart_id as string,
    productId: row.product_id as string,
    size: row.size as ShirtSize,
    quantity: row.quantity as number,
    personalization: row.personalization as Personalization | null,
    idempotencyKey: row.idempotency_key as string,
    unitPriceCents: row.unit_price_cents as number,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

function mapRowToCart(
  row: Record<string, unknown>,
  items: CartItem[],
): Cart {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    items,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export class PostgresCartRepository implements CartRepository {
  constructor(
    private pool: Pool,
    private redis: RedisClientType,
  ) {}

  async findOrCreateCart(userId: UUID): Promise<Cart> {
    const existing = await this.findCart(userId);
    if (existing) return existing;

    const result = await this.pool.query(
      `INSERT INTO carts (user_id) VALUES ($1) RETURNING *`,
      [userId],
    );
    return mapRowToCart(result.rows[0], []);
  }

  async findCart(userId: UUID): Promise<Cart | null> {
    const cartResult = await this.pool.query(
      `SELECT * FROM carts WHERE user_id = $1`,
      [userId],
    );
    if (!cartResult.rows[0]) return null;

    const cartRow = cartResult.rows[0];
    const itemsResult = await this.pool.query(
      `SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC`,
      [cartRow.id],
    );

    return mapRowToCart(cartRow, itemsResult.rows.map(mapRowToCartItem));
  }

  async addItem(
    cartId: UUID,
    input: AddItemInput,
    unitPriceCents: number,
  ): Promise<CartItem> {
    const result = await this.pool.query(
      `INSERT INTO cart_items
         (cart_id, product_id, size, quantity, personalization, idempotency_key, unit_price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        cartId,
        input.productId,
        input.size,
        input.quantity,
        input.personalization ? JSON.stringify(input.personalization) : null,
        input.idempotencyKey,
        unitPriceCents,
      ],
    );

    // Update cart updated_at
    await this.pool.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = $1`,
      [cartId],
    );

    return mapRowToCartItem(result.rows[0]);
  }

  async removeItem(cartId: UUID, itemId: UUID): Promise<void> {
    await this.pool.query(
      `DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`,
      [itemId, cartId],
    );
    await this.pool.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = $1`,
      [cartId],
    );
  }

  async clearCart(cartId: UUID): Promise<void> {
    await this.pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [
      cartId,
    ]);
    await this.pool.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = $1`,
      [cartId],
    );
  }

  async findItemByIdempotencyKey(
    cartId: UUID,
    key: string,
  ): Promise<CartItem | null> {
    const result = await this.pool.query(
      `SELECT * FROM cart_items WHERE cart_id = $1 AND idempotency_key = $2`,
      [cartId, key],
    );
    return result.rows[0] ? mapRowToCartItem(result.rows[0]) : null;
  }

  /**
   * Soft lock: atomically decrements available stock in Redis.
   * Returns false if insufficient stock.
   */
  async acquireSoftLock(
    productId: UUID,
    size: ShirtSize,
    quantity: number,
  ): Promise<boolean> {
    const key = `softlock:${productId}:${size}`;

    // Lua script for atomic check-and-decrement
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current == false then
        return -1
      end
      local available = tonumber(current)
      if available < tonumber(ARGV[1]) then
        return 0
      end
      redis.call('DECRBY', KEYS[1], ARGV[1])
      redis.call('EXPIRE', KEYS[1], ARGV[2])
      return 1
    `;

    const result = await this.redis.eval(luaScript, {
      keys: [key],
      arguments: [String(quantity), String(SOFT_LOCK_TTL_SECONDS)],
    }) as number;

    // -1 means key not initialized yet (first lock for this product/size)
    // Initialize from DB stock and retry
    if (result === -1) {
      const dbResult = await this.pool.query(
        `SELECT stock_by_size->$2 AS stock FROM shirts WHERE id = $1`,
        [productId, size],
      );
      const dbStock = parseInt(dbResult.rows[0]?.stock ?? "0", 10);
      await this.redis.set(key, String(dbStock), { EX: SOFT_LOCK_TTL_SECONDS });

      if (dbStock < quantity) return false;
      await this.redis.decrBy(key, quantity);
      return true;
    }

    return result === 1;
  }

  async releaseSoftLock(
    productId: UUID,
    size: ShirtSize,
    quantity: number,
  ): Promise<void> {
    const key = `softlock:${productId}:${size}`;
    await this.redis.incrBy(key, quantity);
  }
}
