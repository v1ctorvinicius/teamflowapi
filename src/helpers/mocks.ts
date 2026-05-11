import { vi } from "vitest";
import type { UsersRepository } from "../../modules/users/users.repository.ts";
import type { AuthRepository } from "../../modules/auth/auth.repository.ts";
import type { ProductsRepository } from "../../modules/products/products.repository.ts";
import type { CartRepository } from "../../modules/cart/cart.repository.ts";

// Each function returns a full mock of the repository interface.
// All methods default to vi.fn() returning undefined — tests override what they need.

export function mockUsersRepo(): jest.Mocked<UsersRepository> {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    update: vi.fn(),
  } as any;
}

export function mockAuthRepo(): jest.Mocked<AuthRepository> {
  return {
    saveRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
  } as any;
}

export function mockProductsRepo(): jest.Mocked<ProductsRepository> {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findSquadRestrictions: vi.fn(),
  } as any;
}

export function mockCartRepo(): jest.Mocked<CartRepository> {
  return {
    findOrCreateCart: vi.fn(),
    findCart: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    findItemByIdempotencyKey: vi.fn(),
    acquireSoftLock: vi.fn(),
    releaseSoftLock: vi.fn(),
  } as any;
}
