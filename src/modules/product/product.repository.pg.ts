import type { Pool } from "pg";
import type { ProductsRepository } from "./products.repository.ts";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  SquadRestriction,
  ProductCategoryDef,
} from "./products.types.ts";
import type {
  UUID,
  PaginatedResult,
  ShirtSize,
  ISODateString,
} from "../../shared/types.ts";

function mapRowToProduct(row: Record<string, unknown>): Product {
  let createdAt: string;
  let updatedAt: string;

  if (row.created_at instanceof Date) {
    createdAt = row.created_at.toISOString();
  } else if (typeof row.created_at === "string") {
    createdAt = row.created_at;
  } else {
    createdAt = new Date().toISOString();
  }

  if (row.updated_at instanceof Date) {
    updatedAt = row.updated_at.toISOString();
  } else if (typeof row.updated_at === "string") {
    updatedAt = row.updated_at;
  } else {
    updatedAt = new Date().toISOString();
  }

  let stockCategorical: ShirtSize[] = [];
  if (row.stock_categorical) {
    if (typeof row.stock_categorical === "string") {
      stockCategorical = row.stock_categorical
        .replace(/[{}]/g, "")
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0) as ShirtSize[];
    } else if (Array.isArray(row.stock_categorical)) {
      stockCategorical = row.stock_categorical as ShirtSize[];
    }
  }

  let stockCategoricalBySize: Record<ShirtSize, number> = {};
  if (row.stock_categorical_by_size) {
    if (typeof row.stock_categorical_by_size === "string") {
      try {
        stockCategoricalBySize = JSON.parse(
          row.stock_categorical_by_size,
        ) as Record<ShirtSize, number>;
      } catch {
        stockCategoricalBySize = {};
      }
    } else if (typeof row.stock_categorical_by_size === "object") {
      stockCategoricalBySize = row.stock_categorical_by_size as Record<
        ShirtSize,
        number
      >;
    }
  }

  let stockNumeric: Record<string, number> = {};
  if (row.stock_numeric) {
    if (typeof row.stock_numeric === "string") {
      try {
        stockNumeric = JSON.parse(row.stock_numeric) as Record<string, number>;
      } catch {
        stockNumeric = {};
      }
    } else if (typeof row.stock_numeric === "object") {
      stockNumeric = row.stock_numeric as Record<string, number>;
    }
  }

  let imageUrls: string[] = [];
  if (row.image_urls) {
    if (typeof row.image_urls === "string") {
      try {
        imageUrls = JSON.parse(row.image_urls) as string[];
      } catch {
        imageUrls = [];
      }
    } else if (Array.isArray(row.image_urls)) {
      imageUrls = row.image_urls as string[];
    }
  }
  if (!imageUrls.length && row.image_url) {
    imageUrls = [row.image_url as string];
  }

  let supplierMetadata: Record<string, unknown> = {};
  if (row.supplier_metadata) {
    if (typeof row.supplier_metadata === "string") {
      try {
        supplierMetadata = JSON.parse(row.supplier_metadata) as Record<
          string,
          unknown
        >;
      } catch {
        supplierMetadata = {};
      }
    } else if (typeof row.supplier_metadata === "object") {
      supplierMetadata = row.supplier_metadata as Record<string, unknown>;
    }
  }

  return {
    id: row.id as UUID,
    name: row.name as string,
    club: (row.club as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    season: (row.season as string | null) ?? null,
    category: (row.category as ProductCategory) || "SHIRT",
    categorySlug: (row.category_slug as string | null) ?? null,
    type: (row.type as ShirtType | null) ?? null,
    gender: (row.gender as ProductGender) || "UNISEX",
    allowPersonalization: (row.allow_personalization as boolean) ?? false,
    infiniteStock: (row.infinite_stock as boolean) ?? false,
    isNew: row.is_new as boolean | null,
    isNewDays: (row.is_new_days as number) ?? 14,

    enableCategoricalSizes: (row.enable_categorical_sizes as boolean) ?? true,
    categoricalSizesLabel: (row.categorical_sizes_label as string) || "Tamanho",
    stockCategorical: stockCategorical,
    stockCategoricalBySize: stockCategoricalBySize,

    enableNumericSizes: (row.enable_numeric_sizes as boolean) ?? false,
    numericSizesLabel: (row.numeric_sizes_label as string) || "Tamanho",
    stockNumeric: stockNumeric,

    basePrice: row.base_price as number,
    description: (row.description as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    imageUrls: imageUrls,

    isActive: (row.is_active as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    slug: row.slug as string,

    supplierMetadata: supplierMetadata,

    createdAt: createdAt as ISODateString,
    updatedAt: updatedAt as ISODateString,
  };
}

export class PostgresProductsRepository implements ProductsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters: ProductFilters): Promise<PaginatedResult<Product>> {
    const conditions: string[] = ["is_active = true"];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.club) {
      conditions.push(`club_search ILIKE $${idx++}`);
      values.push(`%${filters.club.trim().toLowerCase()}%`);
    }

    if (filters.brand) {
      conditions.push(`brand ILIKE $${idx++}`);
      values.push(`%${filters.brand.trim()}%`);
    }

    if (filters.categorySlug) {
      conditions.push(`category_slug = $${idx++}`);
      values.push(filters.categorySlug);
    }

    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      values.push(filters.type);
    }

    if (filters.season) {
      conditions.push(`season = $${idx++}`);
      values.push(filters.season);
    }

    if (filters.gender) {
      conditions.push(`gender = $${idx++}`);
      values.push(filters.gender);
    }

    if (filters.sizeCategorical) {
      conditions.push(`$${idx++} = ANY(stock_categorical)`);
      values.push(filters.sizeCategorical);
    }

    if (filters.sizeNumeric) {
      conditions.push(`stock_numeric ? $${idx++}`);
      values.push(filters.sizeNumeric);
    }

    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      conditions.push(`base_price >= $${idx++}`);
      values.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      conditions.push(`base_price <= $${idx++}`);
      values.push(filters.maxPrice);
    }


    const where = `WHERE ${conditions.join(" AND ")}`;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM products ${where}`,
      values,
    );

    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, limit, offset];

    const result = await this.pool.query(
      `SELECT * FROM products ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataValues,
    );

    return {
      data: result.rows.map(mapRowToProduct),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findFeatured(): Promise<Product[]> {
    const result = await this.pool.query(
      `SELECT * FROM products
       WHERE is_active = true AND is_featured = true
       ORDER BY updated_at DESC
       LIMIT 12`,
    );
    return result.rows.map(mapRowToProduct);
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const result = await this.pool.query(
      `SELECT * FROM products WHERE slug = $1 AND is_active = true`,
      [slug],
    );
    return result.rows[0] ? mapRowToProduct(result.rows[0]) : null;
  }

  async findAllAdmin(filters: {
    page?: number;
    limit?: number;
    club?: string;
    type?: string;
  }): Promise<{
    data: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.club) {
      conditions.push(`club_search ILIKE $${idx++}`);
      values.push(`%${filters.club.trim().toLowerCase()}%`);
    }

    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      values.push(filters.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM products ${where}`,
      values,
    );

    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, limit, offset];

    const result = await this.pool.query(
      `SELECT * FROM products ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataValues,
    );

    return {
      data: result.rows.map(mapRowToProduct),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: UUID): Promise<Product | null> {
    const result = await this.pool.query(
      `SELECT * FROM products WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapRowToProduct(result.rows[0]) : null;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const clubSearch = input.club
      ? input.club
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .trim()
      : null;

    const slug =
      input.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const stockCategorical = Array.isArray(input.stockCategorical)
      ? input.stockCategorical
      : [];

    const result = await this.pool.query(
      `INSERT INTO products
      (name, club, club_search, brand, season, category, category_slug, type,
       enable_categorical_sizes, categorical_sizes_label, stock_categorical, stock_categorical_by_size,
       enable_numeric_sizes, numeric_sizes_label, stock_numeric,
       base_price, description, image_url, image_urls, slug, is_featured, supplier_metadata,
       gender, allow_personalization, infinite_stock, is_new, is_new_days)
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
       $23, $24, $25, $26, $27)
      RETURNING *`,
      [
        input.name,
        input.club ?? null,
        clubSearch,
        input.brand ?? null,
        input.season ?? null,
        input.category || "SHIRT",
        input.categorySlug ?? null,
        input.type,

        input.enableCategoricalSizes ?? true,
        input.categoricalSizesLabel || "Tamanho",
        stockCategorical,
        JSON.stringify(input.stockCategoricalBySize || {}),

        input.enableNumericSizes ?? false,
        input.numericSizesLabel || "Tamanho",
        JSON.stringify(input.stockNumeric || {}),

        input.basePrice,
        input.description ?? null,
        input.imageUrl ?? null,
        JSON.stringify(input.imageUrls || []),
        slug,
        input.isFeatured ?? false,
        JSON.stringify(input.supplierMetadata ?? {}),

        input.gender || "UNISEX",
        input.allowPersonalization ?? false,
        input.infiniteStock ?? false,
        input.isNew ?? null,
        input.isNewDays ?? 14,
      ],
    );

    return mapRowToProduct(result.rows[0]);
  }

  async update(id: UUID, input: UpdateProductInput): Promise<Product> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }

    if (input.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(input.type ?? null);
    }

    if (input.club !== undefined) {
      fields.push(`club = $${idx++}`);
      values.push(input.club ?? null);
      const clubSearch = input.club
        ? input.club
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .trim()
        : null;
      fields.push(`club_search = $${idx++}`);
      values.push(clubSearch);
    }

    if (input.brand !== undefined) {
      fields.push(`brand = $${idx++}`);
      values.push(input.brand ?? null);
    }

    if (input.categorySlug !== undefined) {
      fields.push(`category_slug = $${idx++}`);
      values.push(input.categorySlug ?? null);
    }

    if (input.basePrice !== undefined) {
      fields.push(`base_price = $${idx++}`);
      values.push(input.basePrice);
    }

    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description);
    }

    if (input.imageUrl !== undefined) {
      fields.push(`image_url = $${idx++}`);
      values.push(input.imageUrl);
    }

    if (input.imageUrls !== undefined) {
      fields.push(`image_urls = $${idx++}`);
      values.push(JSON.stringify(input.imageUrls));
    }

    if (input.enableCategoricalSizes !== undefined) {
      fields.push(`enable_categorical_sizes = $${idx++}`);
      values.push(input.enableCategoricalSizes);
    }

    if (input.categoricalSizesLabel !== undefined) {
      fields.push(`categorical_sizes_label = $${idx++}`);
      values.push(input.categoricalSizesLabel);
    }

    if (input.stockCategorical !== undefined) {
      fields.push(`stock_categorical = $${idx++}`);
      values.push(input.stockCategorical);
    }

    if (input.stockCategoricalBySize !== undefined) {
      fields.push(`stock_categorical_by_size = $${idx++}`);
      values.push(JSON.stringify(input.stockCategoricalBySize));
    }

    if (input.enableNumericSizes !== undefined) {
      fields.push(`enable_numeric_sizes = $${idx++}`);
      values.push(input.enableNumericSizes);
    }

    if (input.numericSizesLabel !== undefined) {
      fields.push(`numeric_sizes_label = $${idx++}`);
      values.push(input.numericSizesLabel);
    }

    if (input.stockNumeric !== undefined) {
      fields.push(`stock_numeric = $${idx++}`);
      values.push(JSON.stringify(input.stockNumeric));
    }

    if (input.supplierMetadata !== undefined) {
      fields.push(`supplier_metadata = $${idx++}`);
      values.push(JSON.stringify(input.supplierMetadata));
    }

    if (input.isFeatured !== undefined) {
      fields.push(`is_featured = $${idx++}`);
      values.push(input.isFeatured);
    }

    if (input.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(input.isActive);
    }

    // 🔥 NOVOS CAMPOS
    if (input.gender !== undefined) {
      fields.push(`gender = $${idx++}`);
      values.push(input.gender);
    }

    if (input.allowPersonalization !== undefined) {
      fields.push(`allow_personalization = $${idx++}`);
      values.push(input.allowPersonalization);
    }

    if (input.infiniteStock !== undefined) {
      fields.push(`infinite_stock = $${idx++}`);
      values.push(input.infiniteStock);
    }

    if (input.isNew !== undefined) {
      fields.push(`is_new = $${idx++}`);
      values.push(input.isNew);
    }

    if (input.isNewDays !== undefined) {
      fields.push(`is_new_days = $${idx++}`);
      values.push(input.isNewDays);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${idx++} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`Product with id ${id} not found`);
    }

    return mapRowToProduct(result.rows[0]);
  }

  async findSquadRestrictions(club: string): Promise<SquadRestriction[]> {
    const result = await this.pool.query(
      `SELECT player_name, number, club_id 
       FROM squad_restrictions 
       WHERE unaccent(lower(club_id)) = unaccent(lower($1))`,
      [club],
    );
    return result.rows.map((r) => ({
      playerName: r.player_name,
      number: r.number,
      clubId: r.club_id,
    }));
  }

  async findByCategory(categorySlug: string, limit = 12): Promise<Product[]> {
    const result = await this.pool.query(
      `SELECT * FROM products
       WHERE is_active = true AND category_slug = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [categorySlug, limit],
    );
    return result.rows.map(mapRowToProduct);
  }

  async findCategories(): Promise<ProductCategoryDef[]> {
    const result = await this.pool.query(
      `SELECT * FROM product_categories
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id as UUID,
      slug: row.slug as string,
      label: row.label as string,
      icon: row.icon as string | undefined,
      sortOrder: row.sort_order as number,
      isActive: row.is_active as boolean,
    }));
  }
}
