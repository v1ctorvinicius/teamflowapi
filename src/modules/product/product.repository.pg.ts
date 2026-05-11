//src/modules/product/product.repository.pg.ts
import type { Pool } from "pg";
import type { ProductsRepository } from "./products.repository.ts";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  SquadRestriction,
} from "./products.types.ts";
import type { UUID, PaginatedResult, ShirtSize } from "../../shared/types.ts";

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
 
  // Normalizar stockCategorical (string → array)
  let stockCategorical: ShirtSize[] = [];
  if (row.stock_categorical) {
    if (typeof row.stock_categorical === 'string') {
      stockCategorical = row.stock_categorical
        .replace(/[{}]/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0) as ShirtSize[];
    } else if (Array.isArray(row.stock_categorical)) {
      stockCategorical = row.stock_categorical as ShirtSize[];
    }
  }
 
  // Normalizar stockCategoricalBySize
  let stockCategoricalBySize: Record<ShirtSize, number> = {};
  if (row.stock_categorical_by_size) {
    if (typeof row.stock_categorical_by_size === 'string') {
      try {
        stockCategoricalBySize = JSON.parse(row.stock_categorical_by_size) as Record<ShirtSize, number>;
      } catch {
        stockCategoricalBySize = {};
      }
    } else if (typeof row.stock_categorical_by_size === 'object') {
      stockCategoricalBySize = row.stock_categorical_by_size as Record<ShirtSize, number>;
    }
  }
 
  // Normalizar stockNumeric
  let stockNumeric: Record<string, number> = {};
  if (row.stock_numeric) {
    if (typeof row.stock_numeric === 'string') {
      try {
        stockNumeric = JSON.parse(row.stock_numeric) as Record<string, number>;
      } catch {
        stockNumeric = {};
      }
    } else if (typeof row.stock_numeric === 'object') {
      stockNumeric = row.stock_numeric as Record<string, number>;
    }
  }
 
  // Normalizar imageUrls (array de imagens)
  let imageUrls: string[] = [];
  if (row.image_urls) {
    if (typeof row.image_urls === 'string') {
      try {
        imageUrls = JSON.parse(row.image_urls) as string[];
      } catch {
        imageUrls = [];
      }
    } else if (Array.isArray(row.image_urls)) {
      imageUrls = row.image_urls as string[];
    }
  }
  // Se só tem imageUrl (compatibilidade), coloca no array
  if (!imageUrls.length && row.image_url) {
    imageUrls = [row.image_url as string];
  }
 
  // Normalizar supplierMetadata
  let supplierMetadata: Record<string, unknown> = {};
  if (row.supplier_metadata) {
    if (typeof row.supplier_metadata === 'string') {
      try {
        supplierMetadata = JSON.parse(row.supplier_metadata) as Record<string, unknown>;
      } catch {
        supplierMetadata = {};
      }
    } else if (typeof row.supplier_metadata === 'object') {
      supplierMetadata = row.supplier_metadata as Record<string, unknown>;
    }
  }
 
  return {
    id: row.id as UUID,
    name: row.name as string,
    club: row.club as string,
    season: row.season as string,
    category: (row.category as ProductCategory) || 'SHIRT',
    type: (row.type as ShirtType) || 'FAN',
    
    enableCategoricalSizes: (row.enable_categorical_sizes as boolean) ?? true,
    categoricalSizesLabel: (row.categorical_sizes_label as string) || 'Tamanho',
    stockCategorical: stockCategorical,
    stockCategoricalBySize: stockCategoricalBySize,
    
    enableNumericSizes: (row.enable_numeric_sizes as boolean) ?? false,
    numericSizesLabel: (row.numeric_sizes_label as string) || 'Tamanho',
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

    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      values.push(filters.type);
    }

    if (filters.season) {
      conditions.push(`season = $${idx++}`);
      values.push(filters.season);
    }

    if (filters.size) {
      conditions.push(`$${idx++} = ANY(stock_categorical)`);
      values.push(filters.size);
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
    const result = await this.pool.query(`SELECT * FROM products WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? mapRowToProduct(result.rows[0]) : null;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const clubSearch = input.club
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
    
    const slug = input.name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    + '-' + crypto.randomUUID().slice(0, 8);
    
    // Garantir que stockCategorical é array
    const stockCategorical = Array.isArray(input.stockCategorical) 
    ? input.stockCategorical 
    : [];
    
    const result = await this.pool.query(
      `INSERT INTO products
      (name, club, club_search, season, category, type,
       enable_categorical_sizes, categorical_sizes_label, stock_categorical, stock_categorical_by_size,
       enable_numeric_sizes, numeric_sizes_label, stock_numeric,
       base_price, description, image_url, image_urls, slug, is_featured, supplier_metadata)
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        input.name,
        input.club,
        clubSearch,
        input.season,
        input.category || 'SHIRT',
        input.type,
        
        input.enableCategoricalSizes ?? true,
        input.categoricalSizesLabel || 'Tamanho',
        stockCategorical,
        JSON.stringify(input.stockCategoricalBySize || {}),
        
        input.enableNumericSizes ?? false,
        input.numericSizesLabel || 'Tamanho',
        JSON.stringify(input.stockNumeric || {}),
        
        input.basePrice,
        input.description ?? null,
        input.imageUrl ?? null,
        JSON.stringify(input.imageUrls || []),
        slug,
        input.isFeatured ?? false,
        JSON.stringify(input.supplierMetadata ?? {}),
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
   
    // Sempre atualiza updated_at
    fields.push(`updated_at = NOW()`);
   
    values.push(id);
   
    const result = await this.pool.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${idx++} RETURNING *`,
      values,
    );
   
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
}
