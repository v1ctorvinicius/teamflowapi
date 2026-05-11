// product.types.ts
import type { UUID, ISODateString, ShirtSize, ShirtType } from "../../shared/types.ts";

export type ProductCategory = 'SHIRT' | 'SHOE' | 'COMBO';

export type ShirtSize = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XGG' | '2XGG';
export type ShirtType = "PLAYER" | "FAN";

export type ShoeSize = string;

export interface Product {
  id: UUID;
  name: string;
  club: string;
  season: string;
  category: ProductCategory;
  type: 'PLAYER' | 'FAN';

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
  supplierMetadata: Record<string, unknown>; // JSONB
}

export interface Personalization {
  name?: string;  // max 12 chars
  number?: number; // 0-99
}

export interface CreateProductInput {
  name: string;
  club: string;
  season: string;
  category: ProductCategory;
  type: 'PLAYER' | 'FAN';

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
  club?: string;
  type?: 'PLAYER' | 'FAN';
  category?: ProductCategory;
  season?: string;

  sizeCategorical?: ShirtSize;
  sizeNumeric?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

// RN-01: current squad player+number combos that are restricted for FAN replicas
export interface SquadRestriction {
  playerName: string;
  number: number;
  clubId: string;
}
