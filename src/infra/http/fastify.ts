// src/infra/http/fastify.ts
import fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import { AppError } from "../../shared/errors.ts";
import { config } from "../../config/env.ts";

export async function createFastifyApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
      transport:
        config.nodeEnv !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    disableRequestLogging: false,
  });

  // 🔥 SOLUÇÃO DEFINITIVA: Rota para o health check do Render NA RAÍZ
  app.get("/", (request, reply) => {
    reply.status(200).send();
  });

  // 🔥 Suporte para o método HEAD na raiz (também necessário)
  app.head("/", (request, reply) => {
    reply.status(200).send();
  });

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : ["http://localhost:5173", "http://localhost:3000"];

  await app.register(fastifyCors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.validation,
        },
      });
    }

    // Unexpected errors
    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return app;
}
