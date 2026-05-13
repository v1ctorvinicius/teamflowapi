// src/modules/user/user.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { UsersService } from "./user.service.ts";
import type { RegisterUserInput, UpdateUserInput, ChangePasswordInput } from "./user.types.ts";

export class UsersController {
  constructor(private service: UsersService) {}

  async register(
    request: FastifyRequest<{ Body: RegisterUserInput }>,
    reply: FastifyReply,
  ) {
    const { user, tokens } = await this.service.register(request.body);
    return reply.status(201).send({ data: { ...user, ...tokens } });
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const { id } = (request as any).user;
    const user = await this.service.findById(id);
    return reply.status(200).send({ data: user });
  }

  async updateMe(
    request: FastifyRequest<{ Body: UpdateUserInput }>,
    reply: FastifyReply,
  ) {
    const { id } = (request as any).user;
    const user = await this.service.updateProfile(id, request.body);
    return reply.status(200).send({ data: user });
  }

  // password
  async changePassword(
    request: FastifyRequest<{ Body: ChangePasswordInput }>,
    reply: FastifyReply,
  ) {
    const { id } = (request as any).user;
    const { currentPassword, newPassword, confirmPassword } = request.body;
    
    if (newPassword !== confirmPassword) {
      return reply.status(400).send({
        error: { code: "PASSWORD_MISMATCH", message: "Senhas não coincidem" }
      });
    }
    
    await this.service.changePassword(id, currentPassword, newPassword);
    return reply.status(200).send({ data: { message: "Senha alterada com sucesso" } });
  }

  // wishlist
  async getWishlist(request: FastifyRequest, reply: FastifyReply) {
    const { id } = (request as any).user;
    const products = await this.service.getWishlist(id);
    return reply.status(200).send({ data: products });
  }

  async addToWishlist(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = (request as any).user;
    const { productId } = request.params;
    await this.service.addToWishlist(id, productId);
    return reply.status(201).send({ data: { message: "Produto adicionado aos favoritos" } });
  }

  async removeFromWishlist(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = (request as any).user;
    const { productId } = request.params;
    await this.service.removeFromWishlist(id, productId);
    return reply.status(200).send({ data: { message: "Produto removido dos favoritos" } });
  }

  async checkWishlist(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = (request as any).user;
    const { productId } = request.params;
    const isInWishlist = await this.service.isInWishlist(id, productId);
    return reply.status(200).send({ data: { isInWishlist } });
  }
}