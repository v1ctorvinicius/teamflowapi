import type { Cart, CartItem, AddItemInput } from "./cart.types.ts";
import type { UUID, ShirtSize } from "../../shared/types.ts";

export interface CartRepository {
  findOrCreateCart(userId: UUID): Promise<Cart>;
  findCart(userId: UUID): Promise<Cart | null>;
  addItem(cartId: UUID, input: AddItemInput, unitPriceCents: number): Promise<CartItem>;
  removeItem(cartId: UUID, itemId: UUID): Promise<void>;
  clearCart(cartId: UUID): Promise<void>;
  findItemByIdempotencyKey(cartId: UUID, key: string): Promise<CartItem | null>;

  // Soft lock: reserves stock in Redis for 15 minutes
  acquireSoftLock(productId: UUID, size: ShirtSize, quantity: number): Promise<boolean>;
  releaseSoftLock(productId: UUID, size: ShirtSize, quantity: number): Promise<void>;
}
