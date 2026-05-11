// src/app.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { RedisClientType } from "redis";

import { healthRoutes } from "./modules/health/health.routes.ts";
import { usersRoutes } from "./modules/user/user.routes.ts";
import { authRoutes } from "./modules/auth/auth.routes.ts";
import { productsRoutes } from "./modules/product/product.routes.ts";
import { cartRoutes } from "./modules/cart/cart.routes.ts";
import { clubsRoutes } from "./modules/clubs/clubs.routes.ts";
import { adminRoutes } from "./modules/admin/admin.routes.ts";

interface AppOptions {
  pgPool: Pool;
  redis: RedisClientType | null;
}

export async function buildApp(
  app: FastifyInstance,
  options: AppOptions,
): Promise<void> {
  const { pgPool, redis } = options;

  await app.register(healthRoutes, { pgPool, redis });

  await app.register(
    async (api) => {
      await api.register(usersRoutes, { prefix: "/users", pgPool });
      await api.register(authRoutes, { prefix: "/auth", pgPool });
      await api.register(productsRoutes, { prefix: "/products", pgPool });
      await api.register(cartRoutes, { prefix: "/cart", pgPool, redis });
      await api.register(clubsRoutes, { prefix: "/clubs", pgPool });
      await app.register(adminRoutes, { prefix: "/admin", pgPool });
    },
    { prefix: "/api/v1" },
  );
}
