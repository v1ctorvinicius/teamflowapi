// src/modules/product/product.routes.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { PostgresProductsRepository } from "./product.repository.pg.ts";
import { ProductsService } from "./product.service.ts";
import { ProductsController } from "./product.controller.ts";
import { requireAdmin } from "../auth/auth.hooks.ts";

export async function productsRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  const repo = new PostgresProductsRepository(options.pgPool);
  const service = new ProductsService(repo);
  const controller = new ProductsController(service);

  app.get('/featured', async (_request, reply) => {
    const featured = await repo.findFeatured();
    return reply.send({ data: featured });
  });
 
  app.get('/slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const product = await repo.findBySlug(slug);
    if (!product) {
      return reply.status(404).send({ message: 'Product not found' });
    }
    return reply.send({ data: product });
  });

  app.get('/categories', async (_request, reply) => {
    const categories = await repo.findCategories();
    return reply.send({ data: categories });
  });
   
  app.get('/by-category/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { limit } = request.query as { limit?: string };
    const products = await repo.findByCategory(slug, limit ? Number(limit) : 12);
    return reply.send({ data: products });
  });
  
  app.get("/:id", controller.get.bind(controller));


  app.get("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          club: { type: "string" },
          brand: { type: "string" },
          categorySlug: { type: "string" },
          type: { type: "string", enum: ["PLAYER", "FAN"] },
          gender: { type: "string", enum: ["MASCULINE", "FEMININE", "UNISEX"] },
          sizeCategorical: { type: "string" },
          sizeNumeric: { type: "string" },
          season: { type: "string" },
          minPrice: { type: "number", minimum: 0 },
          maxPrice: { type: "number", minimum: 0 },
        },
      },
    },
    handler: controller.list.bind(controller),
  });

  app.post(
    "/:id/validate-personalization",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 12 },
            number: { type: "integer", minimum: 0, maximum: 99 },
          },
        },
      },
    },
    controller.validatePersonalization.bind(controller),
  );
}
