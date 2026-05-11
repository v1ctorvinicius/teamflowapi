// src/modules/product/product.routes.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { PostgresProductsRepository } from "./product.repository.pg.ts";
import { ProductsService } from "./product.service.ts";
import { ProductsController } from "./product.controller.ts";

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
  
  // Specific route FIRST
  app.get("/:id", controller.get.bind(controller));

  // Generic route LAST
  app.get("/", controller.list.bind(controller));

  // POST route
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
