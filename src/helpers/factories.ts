import type { User } from "../../modules/users/users.types.ts";
import type { Product } from "../../modules/products/products.types.ts";
import type { Cart, CartItem } from "../../modules/cart/cart.types.ts";
import type { RefreshToken } from "../../modules/auth/auth.types.ts";

// ─── User factory ────────────────────────────────────────────────────────────

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-uuid-1",
    email: "fan@teamflow.com",
    passwordHash: "salt:hashedpassword",
    name: "Torcedor Silva",
    favoriteTeam: "Flamengo",
    role: "CUSTOMER",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Product factory ──────────────────────────────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-uuid-1",
    name: "Camisa Flamengo 2025 Torcedor",
    club: "Flamengo",
    season: "2025/2026",
    type: "FAN",
    sizes: ["P", "M", "G", "GG"],
    basePrice: 29900, // R$ 299,00 in cents
    description: "Camisa oficial do Flamengo",
    imageUrl: "https://cdn.teamflow.com/shirts/fla-2025.jpg",
    supplierMetadata: { ref: "FLA-2025-TORCEDOR" },
    stockBySize: { P: 10, M: 20, G: 15, GG: 5, XGG: 0, "2GG": 0, "3GG": 0, "4GG": 0 },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makePlayerProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({ type: "PLAYER", name: "Camisa Flamengo 2025 Jogador", ...overrides });
}

// ─── Cart factory ─────────────────────────────────────────────────────────────

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "item-uuid-1",
    cartId: "cart-uuid-1",
    productId: "product-uuid-1",
    size: "M",
    quantity: 1,
    personalization: null,
    idempotencyKey: "idem-key-1",
    unitPriceCents: 29900,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart-uuid-1",
    userId: "user-uuid-1",
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── RefreshToken factory ─────────────────────────────────────────────────────

export function makeRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: "token-uuid-1",
    userId: "user-uuid-1",
    tokenHash: "sha256-hash-of-raw-token",
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    ...overrides,
  };
}
