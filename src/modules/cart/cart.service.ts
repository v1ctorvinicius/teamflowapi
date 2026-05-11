import type { CartRepository } from "./cart.repository.ts";
import type { ProductsRepository } from "../products/products.repository.ts";
import type { ProductsService } from "../products/products.service.ts";
import type { Cart, CartItem, AddItemInput } from "./cart.types.ts";
import type { UUID } from "../../shared/types.ts";
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "../../shared/errors.ts";

export class CartService {
  constructor(
    private cartRepo: CartRepository,
    private productsRepo: ProductsRepository,
    private productsService: ProductsService,
  ) {}

  async getCart(userId: UUID): Promise<Cart> {
    const cart = await this.cartRepo.findOrCreateCart(userId);
    return cart;
  }

  async addItem(userId: UUID, input: AddItemInput): Promise<Cart> {
    const cart = await this.cartRepo.findOrCreateCart(userId);

    // Idempotency: if this key was already used, return existing cart
    const existing = await this.cartRepo.findItemByIdempotencyKey(
      cart.id,
      input.idempotencyKey,
    );
    if (existing) {
      return this.cartRepo.findOrCreateCart(userId);
    }

    // Validate product exists and has the requested size
    const product = await this.productsRepo.findById(input.productId);
    if (!product) throw new NotFoundError("Product not found");
    if (!product.isActive) throw new UnprocessableEntityError("Product is not available");
    if (!product.sizes.includes(input.size)) {
      throw new ValidationError(`Size ${input.size} is not available for this product`);
    }

    // RN-01: validate personalization if present
    if (input.personalization) {
      await this.productsService.validatePersonalization(
        input.productId,
        input.personalization,
      );
    }

    // Try to acquire soft lock on stock (15 minutes)
    const locked = await this.cartRepo.acquireSoftLock(
      input.productId,
      input.size,
      input.quantity,
    );
    if (!locked) {
      throw new UnprocessableEntityError(
        `Insufficient stock for size ${input.size}. Please choose a different size or quantity.`,
      );
    }

    await this.cartRepo.addItem(cart.id, input, product.basePrice);

    return this.cartRepo.findOrCreateCart(userId);
  }

  async removeItem(userId: UUID, itemId: UUID): Promise<Cart> {
    const cart = await this.cartRepo.findCart(userId);
    if (!cart) throw new NotFoundError("Cart not found");

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError("Cart item not found");

    // Release soft lock when item is removed
    await this.cartRepo.releaseSoftLock(
      item.productId,
      item.size,
      item.quantity,
    );

    await this.cartRepo.removeItem(cart.id, itemId);
    return this.cartRepo.findOrCreateCart(userId);
  }

  async clearCart(userId: UUID): Promise<void> {
    const cart = await this.cartRepo.findCart(userId);
    if (!cart) return;

    // Release all soft locks
    for (const item of cart.items) {
      await this.cartRepo.releaseSoftLock(
        item.productId,
        item.size,
        item.quantity,
      );
    }

    await this.cartRepo.clearCart(cart.id);
  }
}
