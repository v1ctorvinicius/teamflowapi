import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
 
export async function clubsRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  
  app.get("/", async (request, reply) => {
    const { search } = request.query as { search?: string };
 
    let query = `SELECT id, name, slug, country, type FROM clubs`;
    const values: unknown[] = [];
 
    if (search?.trim()) {
      query += ` WHERE name_search ILIKE $1`;
      values.push(`%${search.trim().toLowerCase()}%`);
    }
 
    query += ` ORDER BY name ASC`;
 
    const result = await options.pgPool.query(query, values);
    return reply.status(200).send({ data: result.rows });
  });
}