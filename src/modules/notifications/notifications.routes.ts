// src/modules/notifications/notifications.routes.ts
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate } from "../auth/auth.hooks.ts";

export async function notificationsRoutes(
  app: FastifyInstance,
  options: { pgPool: Pool },
) {
  const { pgPool } = options;

  app.get(
    "/me/notifications",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id;

      const result = await pgPool.query(
        `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
        [userId],
      );

      const unreadCount = result.rows.filter((n: any) => !n.read).length;

      return reply.send({
        data: result.rows,
        unreadCount,
        pagination: { limit: 50, total: result.rows.length },
      });
    },
  );

  app.get(
    "/me/notifications/unread-count",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id;

      const result = await pgPool.query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`,
        [userId],
      );

      return reply.send({ unreadCount: parseInt(result.rows[0].count, 10) });
    },
  );

  app.patch(
    "/me/notifications/:id/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id;
      const { id } = request.params as { id: string };

      await pgPool.query(
        `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );

      return reply.send({ data: { ok: true } });
    },
  );

  app.patch(
    "/me/notifications/read-all",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id;

      await pgPool.query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
        [userId],
      );

      return reply.send({
        data: {
          ok: true,
          message: "Todas as notificações marcadas como lidas",
        },
      });
    },
  );
}
