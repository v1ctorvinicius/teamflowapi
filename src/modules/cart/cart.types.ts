import type { UUID, ISODateString, ShirtSize } from "../../shared/types.ts";
import type { Personalization } from "../products/products.types.ts";

export interface CartItem {
  id: UUID;
  cartId: UUID;
  productId: UUID;
  size: ShirtSize;
  quantity: number;
  personalization: Personalization | null;
  idempotencyKey: string;
  unitPriceCents: number;
  createdAt: ISODateString;
}

export interface Cart {
  id: UUID;
  userId: UUID;
  items: CartItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AddItemInput {
  productId: UUID;
  size: ShirtSize;
  quantity: number;
  personalization?: Personalization;
  idempotencyKey: string;
}

export interface RemoveItemInput {
  itemId: UUID;
}

export type SoftLockStatus = "locked" | "released" | "not_found";
