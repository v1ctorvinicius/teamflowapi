import { describe, it, expect, beforeEach, vi } from "vitest";
import { CartService } from "@/modules/cart/cart.service.ts";
import { ProductsService } from "@/modules/product/product.service.ts";
import { mockCartRepo, mockProductsRepo } from "../helpers/mocks.ts";
import { makeCart, makeCartItem, makeProduct } from "../helpers/factories.ts";
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "@/shared/errors.ts";

describe("CartService", () => {
  let cartRepo: ReturnType<typeof mockCartRepo>;
  let productsRepo: ReturnType<typeof mockProductsRepo>;
  let productsService: ProductsService;
  let service: CartService;

  const USER_ID = "user-uuid-1";
  const PRODUCT_ID = "product-uuid-1";

  beforeEach(() => {
    cartRepo = mockCartRepo();
    productsRepo = mockProductsRepo();
    productsService = new ProductsService(productsRepo);
    service = new CartService(cartRepo, productsRepo, productsService);
  });

  // ─── getCart ──────────────────────────────────────────────────────────────

  describe("getCart", () => {
    it("creates a new cart if none exists", async () => {
      const emptyCart = makeCart();
      cartRepo.findOrCreateCart.mockResolvedValue(emptyCart);

      const result = await service.getCart(USER_ID);

      expect(cartRepo.findOrCreateCart).toHaveBeenCalledWith(USER_ID);
      expect(result.items).toHaveLength(0);
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe("addItem", () => {
    const validInput = {
      productId: PRODUCT_ID,
      size: "M" as const,
      quantity: 1,
      idempotencyKey: "idem-key-abc",
    };

    it("adds an item and returns the updated cart", async () => {
      const cart = makeCart();
      const updatedCart = makeCart({ items: [makeCartItem()] });

      cartRepo.findOrCreateCart
        .mockResolvedValueOnce(cart)          // initial fetch
        .mockResolvedValueOnce(updatedCart);  // after add
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      productsRepo.findById.mockResolvedValue(makeProduct());
      cartRepo.acquireSoftLock.mockResolvedValue(true);
      cartRepo.addItem.mockResolvedValue(makeCartItem());

      const result = await service.addItem(USER_ID, validInput);

      expect(cartRepo.acquireSoftLock).toHaveBeenCalledWith(PRODUCT_ID, "M", 1);
      expect(cartRepo.addItem).toHaveBeenCalledOnce();
      expect(result.items).toHaveLength(1);
    });

    it("is idempotent — duplicate idempotencyKey skips insert", async () => {
      const cart = makeCart({ items: [makeCartItem()] });
      cartRepo.findOrCreateCart.mockResolvedValue(cart);
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(makeCartItem());

      const result = await service.addItem(USER_ID, validInput);

      expect(cartRepo.addItem).not.toHaveBeenCalled();
      expect(cartRepo.acquireSoftLock).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it("throws NotFoundError when product does not exist", async () => {
      cartRepo.findOrCreateCart.mockResolvedValue(makeCart());
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      productsRepo.findById.mockResolvedValue(null);

      await expect(service.addItem(USER_ID, validInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws UnprocessableEntityError when product is inactive", async () => {
      cartRepo.findOrCreateCart.mockResolvedValue(makeCart());
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      productsRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));

      await expect(service.addItem(USER_ID, validInput)).rejects.toThrow(
        UnprocessableEntityError,
      );
    });

    it("throws ValidationError when requested size is unavailable", async () => {
      cartRepo.findOrCreateCart.mockResolvedValue(makeCart());
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      // Product only has P and M sizes
      productsRepo.findById.mockResolvedValue(makeProduct({ sizes: ["P", "M"] }));

      await expect(
        service.addItem(USER_ID, { ...validInput, size: "4GG" }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws UnprocessableEntityError when soft lock fails (out of stock)", async () => {
      cartRepo.findOrCreateCart.mockResolvedValue(makeCart());
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      productsRepo.findById.mockResolvedValue(makeProduct());
      cartRepo.acquireSoftLock.mockResolvedValue(false); // stock exhausted

      await expect(service.addItem(USER_ID, validInput)).rejects.toThrow(
        UnprocessableEntityError,
      );

      expect(cartRepo.addItem).not.toHaveBeenCalled();
    });

    it("validates personalization (RN-01) before acquiring the soft lock", async () => {
      cartRepo.findOrCreateCart.mockResolvedValue(makeCart());
      cartRepo.findItemByIdempotencyKey.mockResolvedValue(null);
      productsRepo.findById.mockResolvedValue(
        makeProduct({ type: "FAN", club: "Flamengo" }),
      );
      productsRepo.findSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      await expect(
        service.addItem(USER_ID, {
          ...validInput,
          personalization: { name: "Gabigol", number: 99 },
        }),
      ).rejects.toThrow(UnprocessableEntityError);

      // Soft lock must NOT be acquired if personalization is invalid
      expect(cartRepo.acquireSoftLock).not.toHaveBeenCalled();
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe("removeItem", () => {
    it("removes item and releases the soft lock", async () => {
      const item = makeCartItem({ id: "item-uuid-1", productId: PRODUCT_ID, size: "M", quantity: 1 });
      const cart = makeCart({ items: [item] });
      const updatedCart = makeCart({ items: [] });

      cartRepo.findCart.mockResolvedValue(cart);
      cartRepo.findOrCreateCart.mockResolvedValue(updatedCart);

      const result = await service.removeItem(USER_ID, "item-uuid-1");

      expect(cartRepo.releaseSoftLock).toHaveBeenCalledWith(PRODUCT_ID, "M", 1);
      expect(cartRepo.removeItem).toHaveBeenCalledWith(cart.id, "item-uuid-1");
      expect(result.items).toHaveLength(0);
    });

    it("throws NotFoundError when cart does not exist", async () => {
      cartRepo.findCart.mockResolvedValue(null);

      await expect(
        service.removeItem(USER_ID, "item-uuid-1"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when item does not belong to the cart", async () => {
      cartRepo.findCart.mockResolvedValue(makeCart({ items: [] }));

      await expect(
        service.removeItem(USER_ID, "nonexistent-item"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ─── clearCart ────────────────────────────────────────────────────────────

  describe("clearCart", () => {
    it("releases soft locks for all items before clearing", async () => {
      const items = [
        makeCartItem({ id: "i1", productId: "p1", size: "M", quantity: 2 }),
        makeCartItem({ id: "i2", productId: "p2", size: "G", quantity: 1 }),
      ];
      cartRepo.findCart.mockResolvedValue(makeCart({ items }));

      await service.clearCart(USER_ID);

      expect(cartRepo.releaseSoftLock).toHaveBeenCalledTimes(2);
      expect(cartRepo.releaseSoftLock).toHaveBeenCalledWith("p1", "M", 2);
      expect(cartRepo.releaseSoftLock).toHaveBeenCalledWith("p2", "G", 1);
      expect(cartRepo.clearCart).toHaveBeenCalledOnce();
    });

    it("does nothing when user has no cart", async () => {
      cartRepo.findCart.mockResolvedValue(null);

      await service.clearCart(USER_ID);

      expect(cartRepo.releaseSoftLock).not.toHaveBeenCalled();
      expect(cartRepo.clearCart).not.toHaveBeenCalled();
    });
  });
});
