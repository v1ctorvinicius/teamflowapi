import type { FastifyRequest, FastifyReply } from "fastify";
import type { UsersService } from "./user.service.ts";
import type { RegisterUserInput, UpdateUserInput } from "./user.types.ts";

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
}