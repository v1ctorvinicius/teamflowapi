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

  // ── Listar produtos (inclui inativos) ──────────────────────────────────────
  app.get(
    "/products",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { page = 1, limit = 50, club, type } = request.query as any;
      const result = await repo.findAllAdmin({ page: Number(page), limit: Number(limit), club, type });
      return reply.send({ data: result });
    },
  );

  // ── Criar produto ──────────────────────────────────────────────────────────
  app.post(
    "/products",
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: "object",
          required: ["name", "club", "season", "type", "sizes", "basePrice", "stockBySize"],
          properties: {
            name:             { type: "string", minLength: 1 },
            club:             { type: "string", minLength: 1 },
            season:           { type: "string", minLength: 1 },
            type:             { type: "string", enum: ["PLAYER", "FAN"] },
            sizes:            { type: "array", items: { type: "string" } },
            basePrice:        { type: "integer", minimum: 0 },
            description:      { type: "string" },
            imageUrl:         { type: "string" },
            supplierMetadata: { type: "object" },
            stockBySize:      { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const product = await repo.create(request.body as any);
      return reply.status(201).send({ data: product });
    },
  );

  // ── Atualizar produto (parcial) ────────────────────────────────────────────
  app.patch(
    "/products/:id",
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: "object",
          properties: {
            name:             { type: "string", minLength: 1 },
            basePrice:        { type: "integer", minimum: 0 },
            description:      { type: "string" },
            imageUrl:         { type: "string" },
            supplierMetadata: { type: "object" },
            stockBySize:      { type: "object" },
            isActive:         { type: "boolean" },
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

  // ── Soft-delete ────────────────────────────────────────────────────────────
  app.delete(
    "/products/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await repo.update(id, { isActive: false });
      return reply.status(204).send();
    },
  );

  // ── Listar usuários (base para exportar CSV depois) ────────────────────────
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