// src/modules/auth/auth.hooks.ts

import type { FastifyRequest, FastifyReply } from "fastify";
import { jwtVerify } from "jose";
import { UnauthorizedError } from "../../shared/errors.ts";
import { config } from "../../config/env.ts";

const JWT_SECRET = new TextEncoder().encode(
  config.jwt.privateKey, // era config.jwtPrivateKey — corrigido para refletir env.ts
);

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    (request as any).user = {
      id: payload.sub,
      email: payload["username"],
      role: payload["role"],
    };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply);
  const user = (request as any).user;
  if (user?.role !== "ADMIN") {
    throw new UnauthorizedError("Admin access required");
  }
}
