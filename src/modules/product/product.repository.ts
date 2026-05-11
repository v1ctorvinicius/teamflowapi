import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  SquadRestriction,
} from "./products.types.ts";
import type { UUID } from "../../shared/types.ts";
import type { PaginatedResult } from "../../shared/types.ts";

export interface ProductsRepository {
  findAll(filters: ProductFilters): Promise<PaginatedResult<Product>>;
  findById(id: UUID): Promise<Product | null>;
  create(input: CreateProductInput): Promise<Product>;
  update(id: UUID, input: UpdateProductInput): Promise<Product>;

  findSquadRestrictions(club: string): Promise<SquadRestriction[]>;

  findAllAdmin(filters: {
    page?: number;
    limit?: number;
    club?: string;
    type?: string;
  }): Promise<{ data: Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>;
}
