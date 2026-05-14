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
      const result = await repo.findAllAdmin({
        page: Number(page),
        limit: Number(limit),
        club,
        type,
      });
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
          required: ["name", "season", "basePrice", "categorySlug"],
          properties: {
            name: { type: "string", minLength: 1 },
            club: { type: "string", nullable: true },
            brand: { type: "string", minLength: 1 },
            season: { type: "string", minLength: 1 },
            type: {
              type: ["string", "null"],
              enum: ["PLAYER", "FAN", null],
              nullable: true,
            },
            categorySlug: { type: "string", minLength: 1 },
            basePrice: { type: "integer", minimum: 0 },
            description: { type: "string", nullable: true },
            imageUrl: { type: "string", nullable: true },
            imageUrls: {
              type: "array",
              items: { type: "string" },
              default: [],
            },
            isFeatured: { type: "boolean", default: false },

            enableCategoricalSizes: { type: "boolean", default: true },
            categoricalSizesLabel: { type: "string", default: "Tamanho" },
            stockCategorical: {
              type: "array",
              items: { type: "string" },
              default: [],
            },
            stockCategoricalBySize: {
              type: "object",
              additionalProperties: { type: "number" },
              default: {},
            },

            enableNumericSizes: { type: "boolean", default: false },
            numericSizesLabel: { type: "string", default: "Tamanho" },
            stockNumeric: {
              type: "object",
              additionalProperties: { type: "number" },
              default: {},
            },

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
            name: { type: "string", minLength: 1 },
            club: { type: "string", nullable: true },
            brand: { type: "string", minLength: 1 },
            season: { type: "string", minLength: 1 },
            type: {
              type: ["string", "null"],
              enum: ["PLAYER", "FAN", null],
              nullable: true,
            },
            categorySlug: { type: "string", minLength: 1 },
            basePrice: { type: "integer", minimum: 0 },
            description: { type: "string", nullable: true },
            imageUrl: { type: "string", nullable: true },
            imageUrls: { type: "array", items: { type: "string" } },
            isActive: { type: "boolean" },
            isFeatured: { type: "boolean" },

            enableCategoricalSizes: { type: "boolean" },
            categoricalSizesLabel: { type: "string" },
            stockCategorical: { type: "array", items: { type: "string" } },
            stockCategoricalBySize: {
              type: "object",
              additionalProperties: { type: "number" },
            },

            enableNumericSizes: { type: "boolean" },
            numericSizesLabel: { type: "string" },
            stockNumeric: {
              type: "object",
              additionalProperties: { type: "number" },
            },

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

  app.get("/users", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const result = await options.pgPool.query(
      `SELECT id, email, name, favorite_team, role, created_at
         FROM users
         ORDER BY created_at DESC`,
    );
    return reply.send({ data: result.rows });
  });

  app.get(
    "/categories",
    { onRequest: [requireAdmin] },
    async (_request, reply) => {
      const categories = await repo.findCategories();
      return reply.send({ data: categories });
    },
  );

  app.post(
    "/categories",
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const { label, icon, sortOrder } = request.body as {
        label: string;
        icon?: string;
        sortOrder?: number;
      };

      if (!label?.trim()) {
        return reply.status(400).send({ message: "Label é obrigatório" });
      }

      const slug = label
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

      const result = await options.pgPool.query(
        `INSERT INTO product_categories (slug, label, icon, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING
       RETURNING *`,
        [slug, label.trim(), icon ?? null, sortOrder ?? 99],
      );

      if (!result.rows[0]) {
        return reply
          .status(409)
          .send({ message: "Categoria com esse nome já existe" });
      }

      return reply.status(201).send({ data: result.rows[0] });
    },
  );

  app.patch(
    "/categories/:slug",
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { label, icon, sortOrder, isActive } = request.body as {
        label?: string;
        icon?: string;
        sortOrder?: number;
        isActive?: boolean;
      };

      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (label !== undefined) {
        fields.push(`label = $${idx++}`);
        values.push(label);
      }
      if (icon !== undefined) {
        fields.push(`icon = $${idx++}`);
        values.push(icon);
      }
      if (sortOrder !== undefined) {
        fields.push(`sort_order = $${idx++}`);
        values.push(sortOrder);
      }
      if (isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(isActive);
      }

      if (!fields.length) {
        return reply.status(400).send({ message: "Nada para atualizar" });
      }

      values.push(slug);

      const result = await options.pgPool.query(
        `UPDATE product_categories SET ${fields.join(", ")} WHERE slug = $${idx++} RETURNING *`,
        values,
      );

      return reply.send({ data: result.rows[0] });
    },
  );

  app.delete(
    "/categories/:slug",
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

      await options.pgPool.query(
        `UPDATE product_categories SET is_active = false WHERE slug = $1`,
        [slug],
      );

      return reply.send({ message: "Categoria desativada" });
    },
  );
}
