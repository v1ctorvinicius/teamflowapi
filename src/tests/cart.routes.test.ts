import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createFastifyApp } from "@/infra/http/fastify.ts";
import { cartRoutes } from "@/modules/cart/cart.routes.ts";
import { signTestToken } from "../helpers/app.ts";
import { makeCart, makeCartItem, makeProduct } from "../helpers/factories.ts";

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockFindOrCreateCart = vi.fn();
const mockFindCart = vi.fn();
const mockAddItem = vi.fn();
const mockRemoveItem = vi.fn();
const mockClearCart = vi.fn();
const mockFindItemByIdempotencyKey = vi.fn();
const mockAcquireSoftLock = vi.fn();
const mockReleaseSoftLock = vi.fn();

const mockFindAll = vi.fn(); // <- estava faltando
const mockFindById = vi.fn();
const mockFindSquadRestrictions = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/modules/cart/cart.repository.pg.ts", () => {
  return {
    PostgresCartRepository: class {
      findOrCreateCart = mockFindOrCreateCart
      findCart = mockFindCart
      addItem = mockAddItem
      removeItem = mockRemoveItem
      clearCart = mockClearCart
      findItemByIdempotencyKey = mockFindItemByIdempotencyKey
      acquireSoftLock = mockAcquireSoftLock
      releaseSoftLock = mockReleaseSoftLock
    }
  }
})

vi.mock("@/modules/product/product.repository.pg.ts", () => {
  return {
    PostgresProductsRepository: class {
      findAll = mockFindAll
      findById = mockFindById
      create = mockCreate
      update = mockUpdate
      findSquadRestrictions = mockFindSquadRestrictions
    }
  }
})
describe("Cart routes — integration", () => {
  let app: FastifyInstance;
  let authHeader: string;

  beforeAll(async () => {
    app = createFastifyApp();
    await app.register(cartRoutes, {
      prefix: "/cart",
      pgPool: {} as any,
      redis: {} as any,
    });
    await app.ready();

    const token = await signTestToken({
      sub: "user-uuid-1",
      email: "fan@teamflow.com",
      role: "CUSTOMER",
    });
    authHeader = `Bearer ${token}`;
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Authentication guard ─────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 on all cart endpoints without a token", async () => {
      const endpoints = [
        { method: "GET" as const, url: "/cart" },
        { method: "POST" as const, url: "/cart/items" },
        { method: "DELETE" as const, url: "/cart/items/some-id" },
        { method: "DELETE" as const, url: "/cart" },
      ];

      for (const { method, url } of endpoints) {
        const res = await app.inject({ method, url });
        expect(res.statusCode, `${method} ${url} should be 401`).toBe(401);
      }
    });
  });

  // ─── GET /cart ────────────────────────────────────────────────────────────

  describe("GET /cart", () => {
    it("returns 200 with the user cart", async () => {
      mockFindOrCreateCart.mockResolvedValue(makeCart());

      const res = await app.inject({
        method: "GET",
        url: "/cart",
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.userId).toBe("user-uuid-1");
    });
  });

  // ─── POST /cart/items ─────────────────────────────────────────────────────

  describe("POST /cart/items", () => {
    const validPayload = {
      productId: "550e8400-e29b-41d4-a716-446655440000",
      size: "M",
      quantity: 1,
      idempotencyKey: "unique-key-abc",
    };

    it("returns 200 with updated cart on success", async () => {
      const cart = makeCart();
      const updatedCart = makeCart({ items: [makeCartItem()] });

      mockFindOrCreateCart
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(updatedCart);
      mockFindItemByIdempotencyKey.mockResolvedValue(null);
      mockFindById.mockResolvedValue(makeProduct());
      mockAcquireSoftLock.mockResolvedValue(true);
      mockAddItem.mockResolvedValue(makeCartItem());

      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.items).toHaveLength(1);
    });

    it("returns 422 when stock is unavailable (soft lock fails)", async () => {
      mockFindOrCreateCart.mockResolvedValue(makeCart());
      mockFindItemByIdempotencyKey.mockResolvedValue(null);
      mockFindById.mockResolvedValue(makeProduct());
      mockAcquireSoftLock.mockResolvedValue(false);

      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(422);
    });

    it("returns 404 when product does not exist", async () => {
      mockFindOrCreateCart.mockResolvedValue(makeCart());
      mockFindItemByIdempotencyKey.mockResolvedValue(null);
      mockFindById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 422 when FAN replica uses restricted player name+number (RN-01)", async () => {
      mockFindOrCreateCart.mockResolvedValue(makeCart());
      mockFindItemByIdempotencyKey.mockResolvedValue(null);
      mockFindById.mockResolvedValue(makeProduct({ type: "FAN", club: "Flamengo" }));
      mockFindSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: {
          ...validPayload,
          personalization: { name: "Gabigol", number: 99 },
        },
      });

      expect(res.statusCode).toBe(422);
      // Soft lock must NOT have been acquired
      expect(mockAcquireSoftLock).not.toHaveBeenCalled();
    });

    it("returns 200 on duplicate idempotencyKey (idempotent add)", async () => {
      const cart = makeCart({ items: [makeCartItem()] });
      mockFindOrCreateCart.mockResolvedValue(cart);
      mockFindItemByIdempotencyKey.mockResolvedValue(makeCartItem());

      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockAddItem).not.toHaveBeenCalled();
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: { size: "M", quantity: 1 }, // missing productId and idempotencyKey
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when size is not a valid enum value", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: { authorization: authHeader },
        payload: { ...validPayload, size: "XXXL" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── DELETE /cart/items/:itemId ───────────────────────────────────────────

  describe("DELETE /cart/items/:itemId", () => {
    it("returns 200 with updated cart after removing an item", async () => {
      const item = makeCartItem({ id: "item-uuid-1" });
      const cartWithItem = makeCart({ items: [item] });
      const emptyCart = makeCart({ items: [] });

      mockFindCart.mockResolvedValue(cartWithItem);
      mockFindOrCreateCart.mockResolvedValue(emptyCart);

      const res = await app.inject({
        method: "DELETE",
        url: "/cart/items/item-uuid-1",
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(200);
      expect(mockReleaseSoftLock).toHaveBeenCalledOnce();
      expect(res.json().data.items).toHaveLength(0);
    });

    it("returns 404 when item does not exist in cart", async () => {
      mockFindCart.mockResolvedValue(makeCart({ items: [] }));

      const res = await app.inject({
        method: "DELETE",
        url: "/cart/items/nonexistent",
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── DELETE /cart ─────────────────────────────────────────────────────────

  describe("DELETE /cart", () => {
    it("returns 204 after clearing the cart", async () => {
      mockFindCart.mockResolvedValue(makeCart({ items: [] }));

      const res = await app.inject({
        method: "DELETE",
        url: "/cart",
        headers: { authorization: authHeader },
      });

      expect(res.statusCode).toBe(204);
    });
  });
});
