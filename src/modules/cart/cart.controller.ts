import type { FastifyRequest, FastifyReply } from "fastify";
import type { CartService } from "./cart.service.ts";
import type { AddItemInput } from "./cart.types.ts";

export class CartController {
  constructor(private service: CartService) {}

  async getCart(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.id;
    const cart = await this.service.getCart(userId);
    return reply.status(200).send({ data: cart });
  }

  async addItem(
    request: FastifyRequest<{ Body: AddItemInput }>,
    reply: FastifyReply,
  ) {
    const userId = (request as any).user?.id;
    const cart = await this.service.addItem(userId, request.body);
    return reply.status(200).send({ data: cart });
  }

  async removeItem(
    request: FastifyRequest<{ Params: { itemId: string } }>,
    reply: FastifyReply,
  ) {
    const userId = (request as any).user?.id;
    const cart = await this.service.removeItem(userId, request.params.itemId);
    return reply.status(200).send({ data: cart });
  }

  async clearCart(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.id;
    await this.service.clearCart(userId);
    return reply.status(204).send();
  }
}
