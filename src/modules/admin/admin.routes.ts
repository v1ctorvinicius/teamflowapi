import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAdmin } from "../auth/auth.hooks.ts";
import { PostgresProductsRepository } from "../product/product.repository.pg.ts";
import { ProductsService } from "../product/product.service.ts";

export async function adminRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  const repo = new PostgresProductsRepository(options.pgPool);
  const service = new ProductsService(repo);

  app.get(
    "/products",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { page = 1, limit = 50, club, type } = request.query as any;
      const result = await repo.findAllAdmin({ page: Number(page), limit: Number(limit), club, type });
      return reply.send({ data: result });
    },
  );

  app.post(
    "/products",
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: "object",
          required: ["name", "club", "season", "type", "basePrice"],
          properties: {
            name:        { type: "string", minLength: 1 },
            club:        { type: "string", minLength: 1 },
            season:      { type: "string", minLength: 1 },
            type:        { type: "string", enum: ["PLAYER", "FAN"] },
            category:    { type: "string", enum: ["SHIRT", "SHOE", "COMBO"], default: "SHIRT" },
            basePrice:   { type: "integer", minimum: 0 },
            description: { type: "string", nullable: true },
            imageUrl:    { type: "string", nullable: true },
            imageUrls:   { type: "array", items: { type: "string" }, default: [] },
            isFeatured:  { type: "boolean", default: false },
            
            enableCategoricalSizes: { type: "boolean", default: true },
            categoricalSizesLabel:  { type: "string", default: "Tamanho" },
            stockCategorical:       { type: "array", items: { type: "string" }, default: [] },
            stockCategoricalBySize: { type: "object", additionalProperties: { type: "number" }, default: {} },
            
            enableNumericSizes: { type: "boolean", default: false },
            numericSizesLabel:  { type: "string", default: "Tamanho" },
            stockNumeric:       { type: "object", additionalProperties: { type: "number" }, default: {} },
            
            supplierMetadata: { type: "object", default: {} },
            slug: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const product = await repo.create(request.body as any);
      return reply.status(201).send({ data: product });
    },
  );

  app.patch(
    "/products/:id",
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            name:        { type: "string", minLength: 1 },
            club:        { type: "string", minLength: 1 },
            season:      { type: "string", minLength: 1 },
            type:        { type: "string", enum: ["PLAYER", "FAN"] },
            category:    { type: "string", enum: ["SHIRT", "SHOE", "COMBO"] },
            basePrice:   { type: "integer", minimum: 0 },
            description: { type: "string", nullable: true },
            imageUrl:    { type: "string", nullable: true },
            imageUrls:   { type: "array", items: { type: "string" } },
            isActive:    { type: "boolean" },
            isFeatured:  { type: "boolean" },
            
            enableCategoricalSizes: { type: "boolean" },
            categoricalSizesLabel:  { type: "string" },
            stockCategorical:       { type: "array", items: { type: "string" } },
            stockCategoricalBySize: { type: "object", additionalProperties: { type: "number" } },
            
            enableNumericSizes: { type: "boolean" },
            numericSizesLabel:  { type: "string" },
            stockNumeric:       { type: "object", additionalProperties: { type: "number" } },
            
            supplierMetadata: { type: "object" },
            slug: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await repo.update(id, request.body as any);
      return reply.send({ data: product });
    },
  );

  app.delete(
    "/products/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await repo.update(id, { isActive: false });
      return reply.status(204).send();
    },
  );

  app.get(
    "/users",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const result = await options.pgPool.query(
        `SELECT id, email, name, favorite_team, role, created_at
         FROM users
         ORDER BY created_at DESC`,
      );
      return reply.send({ data: result.rows });
    },
  );
}