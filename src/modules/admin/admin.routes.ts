//admin.routes.ts
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

  // ── Produtos ──────────────────────────────────────────────────────────────
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

  // ── Usuários (com estatísticas) ──────────────────────────────────────────
  app.get("/users", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const result = await options.pgPool.query(
      `SELECT
         u.id,
         u.email,
         u.name,
         u.role,
         u.favorite_team,
         u.email_verified,
         u.phone,
         u.created_at,
         COUNT(w.product_id) AS wishlist_count
       FROM users u
       LEFT JOIN wishlist w ON w.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
    );
    return reply.send({ data: result.rows });
  });

  // ── Clubes (CRUD completo) ──────────────────────────────────────────────
  app.get("/clubs", { preHandler: [requireAdmin] }, async (request, reply) => {
    const { search } = request.query as { search?: string };

    let query = `SELECT * FROM clubs`;
    const values: unknown[] = [];

    if (search?.trim()) {
      query += ` WHERE name_search ILIKE $1`;
      values.push(`%${search.trim().toLowerCase()}%`);
    }

    query += ` ORDER BY name ASC`;

    const result = await options.pgPool.query(query, values);
    return reply.send({ data: result.rows });
  });

  app.post("/clubs", { preHandler: [requireAdmin] }, async (request, reply) => {
    const {
      name,
      country = "Brasil",
      type = "CLUB",
    } = request.body as {
      name: string;
      country?: string;
      type?: string;
    };

    if (!name?.trim()) {
      return reply.status(400).send({ message: "Nome é obrigatório" });
    }

    const slug = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    const nameSearch = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

    const result = await options.pgPool.query(
      `INSERT INTO clubs (name, slug, name_search, country, type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING
       RETURNING *`,
      [name.trim(), slug, nameSearch, country, type],
    );

    if (!result.rows[0]) {
      return reply
        .status(409)
        .send({ message: "Clube com esse nome já existe" });
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  app.patch(
    "/clubs/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, country, type } = request.body as {
        name?: string;
        country?: string;
        type?: string;
      };

      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (name !== undefined) {
        const slug = name
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        const nameSearch = name
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .trim();

        fields.push(
          `name = $${idx++}`,
          `slug = $${idx++}`,
          `name_search = $${idx++}`,
        );
        values.push(name.trim(), slug, nameSearch);
      }

      if (country !== undefined) {
        fields.push(`country = $${idx++}`);
        values.push(country);
      }
      if (type !== undefined) {
        fields.push(`type = $${idx++}`);
        values.push(type);
      }

      if (!fields.length) {
        return reply.status(400).send({ message: "Nada para atualizar" });
      }

      values.push(id);
      const result = await options.pgPool.query(
        `UPDATE clubs SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        values,
      );

      if (!result.rows[0]) {
        return reply.status(404).send({ message: "Clube não encontrado" });
      }

      return reply.send({ data: result.rows[0] });
    },
  );

  app.delete(
    "/clubs/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Verificar se algum produto usa este clube
      const clubResult = await options.pgPool.query(
        `SELECT name FROM clubs WHERE id = $1`,
        [id],
      );

      if (!clubResult.rows[0]) {
        return reply.status(404).send({ message: "Clube não encontrado" });
      }

      const clubName = clubResult.rows[0].name;
      const inUse = await options.pgPool.query(
        `SELECT COUNT(*) FROM products WHERE club = $1 AND is_active = true`,
        [clubName],
      );

      if (parseInt(inUse.rows[0].count) > 0) {
        return reply.status(409).send({
          message: `Clube está em uso em ${inUse.rows[0].count} produto(s). Remova os produtos primeiro.`,
        });
      }

      await options.pgPool.query(`DELETE FROM clubs WHERE id = $1`, [id]);
      return reply.send({ message: "Clube removido com sucesso" });
    },
  );

  // ── Notifications ──────────────────────────────────────────────────────────
  app.post(
    "/notifications/campaign",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { type, title, body, target } = request.body as {
        type: string;
        title: string;
        body: string;
        target: {
          club?: string;
          role?: string;
          userIds?: string[];
        };
      };

      let userIds: string[] = [];

      if (target.userIds && target.userIds.length > 0) {
        userIds = target.userIds;
      } else {
        let query = `SELECT id FROM users WHERE 1=1`;
        const values: unknown[] = [];
        let idx = 1;

        if (target.club) {
          query += ` AND favorite_team = $${idx++}`;
          values.push(target.club);
        }
        if (target.role) {
          query += ` AND role = $${idx++}`;
          values.push(target.role);
        }

        const result = await options.pgPool.query(query, values);
        userIds = result.rows.map((r: any) => r.id);
      }

      if (userIds.length === 0) {
        return reply.status(400).send({
          message: "Nenhum usuário encontrado para o filtro selecionado",
        });
      }

      for (const userId of userIds) {
        await options.pgPool.query(
          `INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)`,
          [userId, type, title, body],
        );
      }

      return reply.status(201).send({
        data: {
          count: userIds.length,
          message: `${userIds.length} notificação(ões) enviada(s)`,
        },
      });
    },
  );

  app.get(
    "/notifications/target-options",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      // Times que têm produtos
      const clubsResult = await options.pgPool.query(
        `SELECT DISTINCT favorite_team as name FROM users WHERE favorite_team IS NOT NULL ORDER BY favorite_team`,
      );

      return reply.send({
        data: {
          clubs: clubsResult.rows.map((r) => r.name),
          roles: ["CUSTOMER", "ADMIN", "AFFILIATE"],
        },
      });
    },
  );

  app.get(
    "/notifications/stats",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const totalResult = await options.pgPool.query(
        `SELECT COUNT(*) FROM notifications`,
      );
      const total = parseInt(totalResult.rows[0].count, 10);

      const readResult = await options.pgPool.query(
        `SELECT 
         COUNT(CASE WHEN read = true THEN 1 END) as read_count,
         COUNT(CASE WHEN read = false THEN 1 END) as unread_count
       FROM notifications`,
      );

      const byTypeResult = await options.pgPool.query(
        `SELECT type, COUNT(*) as count 
       FROM notifications 
       GROUP BY type 
       ORDER BY count DESC`,
      );

      return reply.send({
        data: {
          total,
          read: parseInt(readResult.rows[0].read_count, 10),
          unread: parseInt(readResult.rows[0].unread_count, 10),
          byType: byTypeResult.rows,
        },
      });
    },
  );

  app.get(
    "/notifications/history",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const result = await options.pgPool.query(
        `SELECT n.*, u.name as user_name, u.username, u.email
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.type = 'admin_message'
       ORDER BY n.created_at DESC
       LIMIT 100`,
      );

      return reply.send({ data: result.rows });
    },
  );

  // ── Categorias ──────────────────────────────────────────────────────────
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
