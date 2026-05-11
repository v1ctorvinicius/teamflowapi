// src/modules/product/product.service.ts
import type { ProductsRepository } from "./products.repository.ts";
import type {
  Product,
  ProductFilters,
  Personalization,
} from "./products.types.ts";
import type { UUID, PaginatedResult } from "../../shared/types.ts";
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "../../shared/errors.ts";

export class ProductsService {
  constructor(private repo: ProductsRepository) {}

  async listProducts(
    filters: ProductFilters,
  ): Promise<PaginatedResult<Product>> {
    const result = await this.repo.findAll(filters);

    console.log("Service received:", {
      isDataArray: Array.isArray(result.data),
      dataLength: result.data?.length,
      dataType: typeof result.data,
      pagination: result.pagination,
    });

    return result;
  }

  async getProduct(id: UUID): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  async validatePersonalization(
    productId: UUID,
    personalization: Personalization,
  ): Promise<void> {
    const { name, number } = personalization;

    if (!name && number === undefined) return;

    if (name && name.length > 12) {
      throw new ValidationError("Name must be 12 characters or fewer");
    }

    if (number !== undefined && (number < 0 || number > 99)) {
      throw new ValidationError("Number must be between 0 and 99");
    }

    const product = await this.repo.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    // Only FAN type replicas are restricted
    if (product.type !== "FAN") return;

    if (!name || number === undefined) return;

    const restrictions = await this.repo.findSquadRestrictions(product.club);
    const isRestricted = restrictions.some(
      (r) =>
        r.playerName.toLowerCase() === name.toLowerCase() &&
        r.number === number,
    );

    if (isRestricted) {
      throw new UnprocessableEntityError(
        `The combination "${name} #${number}" is restricted for FAN replicas due to licensing. ` +
          `Choose a custom name or different number.`,
      );
    }
  }
}
