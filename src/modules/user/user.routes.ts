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
            favoriteTeam: { type: "string" },
          },
        },
      },
    },
    controller.register.bind(controller),
  );

  app.get(
    "/me",
    { preHandler: [authenticate] },
    controller.getMe.bind(controller),
  );

  app.patch(
    "/me",
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            favoriteTeam: { type: "string" },
          },
        },
      },
    },
    controller.updateMe.bind(controller),
  );

  // ─── POST /users/me/change-password ──────────────
  // Mudar senha
  app.post(
    "/me/change-password",
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 8 },
            newPassword: { type: "string", minLength: 8 },
            confirmPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    controller.changePassword.bind(controller),
  );

  // wishlist
  app.get(
    "/wishlist",
    { preHandler: [authenticate] },
    controller.getWishlist.bind(controller),
  );

  app.post(
    "/wishlist/:productId",
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: "object",
          required: ["productId"],
          properties: {
            productId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    controller.addToWishlist.bind(controller),
  );

  app.delete(
    "/wishlist/:productId",
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: "object",
          required: ["productId"],
          properties: {
            productId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    controller.removeFromWishlist.bind(controller),
  );

  app.get(
    "/wishlist/:productId/check",
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: "object",
          required: ["productId"],
          properties: {
            productId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    controller.checkWishlist.bind(controller),
  );
}
