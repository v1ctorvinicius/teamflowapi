import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { PostgresAuthRepository } from "./auth.repository.pg.ts";
import { PostgresUsersRepository } from "../user/user.repository.pg.ts";
import { AuthService } from "./auth.service.ts";
import { AuthController } from "./auth.controller.ts";

export async function authRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  const authRepo = new PostgresAuthRepository(options.pgPool);
  const usersRepo = new PostgresUsersRepository(options.pgPool);
  const service = new AuthService(authRepo, usersRepo);
  const controller = new AuthController(service);

  // POST /auth/login
  app.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    controller.login.bind(controller),
  );

  // POST /auth/refresh
  app.post(
    "/refresh",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    controller.refresh.bind(controller),
  );

  // POST /auth/logout
  app.post(
    "/logout",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    controller.logout.bind(controller),
  );
}
