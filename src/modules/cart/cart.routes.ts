import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { RedisClientType } from "redis";
import { PostgresCartRepository } from "./cart.repository.pg.ts";
import { PostgresProductsRepository } from "../product/product.repository.pg.ts";
import { ProductsService } from "../product/product.service.ts";
import { CartService } from "./cart.service.ts";
import { CartController } from "./cart.controller.ts";
import { authenticate } from "../auth/auth.hooks.ts";

export async function cartRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool; redis: RedisClientType },
) {
  const cartRepo = new PostgresCartRepository(options.pgPool, options.redis);
  const productsRepo = new PostgresProductsRepository(options.pgPool);
  const productsService = new ProductsService(productsRepo);
  const service = new CartService(cartRepo, productsRepo, productsService);
  const controller = new CartController(service);

  // All cart routes require authentication
  app.addHook("preValidation", authenticate);

  // GET /cart
  app.get("/", controller.getCart.bind(controller));

  // POST /cart/items
  app.post(
    "/items",
    {
      schema: {
        body: {
          type: "object",
          required: ["productId", "size", "quantity", "idempotencyKey"],
          properties: {
            productId: { type: "string", format: "uuid" },
            size: {
              type: "string",
              enum: ["P", "M", "G", "GG", "XGG", "2GG", "3GG", "4GG"],
            },
            quantity: { type: "integer", minimum: 1, maximum: 10 },
            idempotencyKey: { type: "string" },
            personalization: {
              type: "object",
              properties: {
                name: { type: "string", maxLength: 12 },
                number: { type: "integer", minimum: 0, maximum: 99 },
              },
            },
          },
        },
      },
    },
    controller.addItem.bind(controller),
  );

  // DELETE /cart/items/:itemId
  app.delete("/items/:itemId", controller.removeItem.bind(controller));

  // DELETE /cart
  app.delete("/", controller.clearCart.bind(controller));
}
