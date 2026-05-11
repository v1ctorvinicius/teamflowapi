//user.route.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { PostgresUsersRepository } from "./user.repository.pg.ts";
import { PostgresAuthRepository } from "../auth/auth.repository.pg.ts";
import { UsersService } from "./user.service.ts";
import { AuthService } from "../auth/auth.service.ts";
import { UsersController } from "./user.controller.ts";
import { authenticate } from "../auth/auth.hooks.ts";

export async function usersRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  const usersRepo = new PostgresUsersRepository(options.pgPool);
  const authRepo = new PostgresAuthRepository(options.pgPool);
  const authService = new AuthService(authRepo, usersRepo);
  const service = new UsersService(usersRepo, authService);
  const controller = new UsersController(service);

  // POST /users/register
  app.post(
    "/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1 },
            // minLength: 1 garante que string vazia "" seja rejeitada pelo schema
            favoriteTeam: { type: "string", minLength: 1 },
          },
        },
      },
    },
    controller.register.bind(controller),
  );

  // GET /users/me  (authenticated)
  app.get(
    "/me",
    { preHandler: [authenticate] },
    controller.getMe.bind(controller),
  );

  // PATCH /users/me  (authenticated)
  app.patch(
    "/me",
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            favoriteTeam: { type: "string", minLength: 1 },
          },
        },
      },
    },
    controller.updateMe.bind(controller),
  );
}