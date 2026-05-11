// src/tests/product.routes.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { productsRoutes } from "../modules/product/product.routes";

describe("Products routes integration", () => {
  let app: any;
  let mockPool: any;

  beforeEach(async () => {
    app = Fastify();

    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };

    await app.register(productsRoutes, {
      prefix: "/api/v1/products",
      pgPool: mockPool,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/products returns array of products", async () => {
    const now = new Date();

    const mockRows = [
      {
        id: "1",
        name: "Jersey 1",
        club: "Flamengo",
        season: "2024",
        type: "PLAYER",
        sizes: ["P", "M", "G"],
        base_price: 100,
        description: "Beautiful jersey",
        image_url: "http://example.com/image1.jpg",
        supplier_metadata: {},
        stock_by_size: { P: 10, M: 20, G: 30 },
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "2",
        name: "Jersey 2",
        club: "Flamengo",
        season: "2024",
        type: "PLAYER",
        sizes: ["M", "G"],
        base_price: 120,
        description: "Another jersey",
        image_url: "http://example.com/image2.jpg",
        supplier_metadata: {},
        stock_by_size: { M: 15, G: 25 },
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    mockPool.query.mockReset();

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ count: "2" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

    const res = await app.inject({ method: "GET", url: "/api/v1/products" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(2);
  });

  it("GET /api/v1/products/:id returns single product", async () => {
    const now = new Date();

    const mockProduct = {
      id: "product-uuid-1",
      name: "Test Product",
      club: "Flamengo",
      season: "2024",
      type: "PLAYER",
      sizes: ["P", "M"],
      base_price: 100,
      description: "Test description",
      image_url: "http://example.com/image.jpg",
      supplier_metadata: {},
      stock_by_size: { P: 5, M: 10 },
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    mockPool.query.mockReset();
    mockPool.query.mockResolvedValueOnce({ rows: [mockProduct], rowCount: 1 });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products/product-uuid-1",
    });

    console.log("Detail status:", res.statusCode);
    if (res.statusCode === 500) {
      console.log("Detail error:", res.body);
    } else {
      const body = res.json();
      console.log("Product id:", body.data?.id);
    }

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe("product-uuid-1");
  });

  it("GET /api/v1/products with query params", async () => {
    mockPool.query.mockReset();

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ count: "0" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?page=2&limit=10",
    });

    console.log("Query params test status:", res.statusCode);
    if (res.statusCode === 500) {
      console.log("Error body:", res.body);
    }

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.total).toBe(0);
  });

  it("GET /api/v1/products/:id returns 404 when product does not exist", async () => {
    mockPool.query.mockReset();
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products/non-existent-id",
    });

    expect(res.statusCode).toBe(404);
  });
});
