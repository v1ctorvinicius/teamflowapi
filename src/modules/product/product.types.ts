// src/modules/product/product.types.ts

import type { UUID, ISODateString } from "../../shared/types.ts";

// Categorias fixas legadas (mantidas para compatibilidade)
export type ProductCategory = "SHIRT" | "SHOE" | "COMBO" | "ACCESSORY" | string;
export type ProductGender = "MASCULINE" | "FEMININE" | "UNISEX";
export type ShirtSize = "PP" | "P" | "M" | "G" | "GG" | "GGG" | "GGGG";
export type ShirtType = "PLAYER" | "FAN";
export type ShoeSize = string;

export interface ProductCategoryDef {
  id: UUID;
  slug: string;
  label: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: UUID;
  name: string;

  club?: string | null;

  brand?: string | null;

  season?: string | null;

  category: ProductCategory;
  categorySlug?: string | null;

  type: ShirtType;
  gender: ProductGender;
  allowPersonalization: boolean;
  infiniteStock: boolean;
  isNew: boolean | null;
  isNewDays: number;

  enableCategoricalSizes: boolean;
  categoricalSizesLabel: string;
  stockCategorical: ShirtSize[];
  stockCategoricalBySize: Record<ShirtSize, number>;

  enableNumericSizes: boolean;
  numericSizesLabel: string;
  stockNumeric: Record<string, number>;

  basePrice: number; // in cents
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];

  isActive: boolean;
  isFeatured: boolean;
  slug: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  supplierMetadata: Record<string, unknown>;
}

export interface Personalization {
  name?: string; // max 12 chars
  number?: number; // 0-99
}

export interface CreateProductInput {
  name: string;
  club?: string;
  brand?: string;
  season?: string;
  category: ProductCategory;
  categorySlug?: string;
  type?: ShirtType;
  gender?: ProductGender;
  allowPersonalization?: boolean;
  infiniteStock?: boolean;
  isNew?: boolean | null;
  isNewDays?: number;

  enableCategoricalSizes?: boolean;
  categoricalSizesLabel?: string;
  stockCategorical?: ShirtSize[];
  stockCategoricalBySize?: Record<ShirtSize, number>;

  enableNumericSizes?: boolean;
  numericSizesLabel?: string;
  stockNumeric?: Record<string, number>;

  basePrice: number;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  isFeatured?: boolean;
  supplierMetadata?: Record<string, unknown>;
}

export interface UpdateProductInput {
  name?: string;
  club?: string | null;
  brand?: string | null;
  season?: string | null;
  categorySlug?: string;
  type?: ShirtType;
  gender?: ProductGender;
  allowPersonalization?: boolean;
  infiniteStock?: boolean;
  isNew?: boolean | null;
  isNewDays?: number;
  basePrice?: number;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];

  enableCategoricalSizes?: boolean;
  categoricalSizesLabel?: string;
  stockCategorical?: ShirtSize[];
  stockCategoricalBySize?: Record<ShirtSize, number>;

  enableNumericSizes?: boolean;
  numericSizesLabel?: string;
  stockNumeric?: Record<string, number>;

  isFeatured?: boolean;
  isActive?: boolean;
  supplierMetadata?: Record<string, unknown>;
}

export interface ProductFilters {
  search?: string;

  club?: string;
  brand?: string;
  gender?: ProductGender;
  type?: ShirtType;
  category?: ProductCategory;
  categorySlug?: string;
  season?: string;
  sizeCategorical?: ShirtSize;
  sizeNumeric?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export interface SquadRestriction {
  playerName: string;
  number: number;
  clubId: string;
}
