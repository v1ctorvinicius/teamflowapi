export type UUID = string;
export type ISODateString = string;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export type UserRole = "CUSTOMER" | "ADMIN" | "AFFILIATE";