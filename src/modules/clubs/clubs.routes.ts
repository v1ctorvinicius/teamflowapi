import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
 
export async function clubsRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  app.get("/", async (_request, reply) => {
    const result = await options.pgPool.query(
      `SELECT id, name, slug FROM clubs ORDER BY name ASC`,
    );
    return reply.status(200).send({ data: result.rows });
  });
}