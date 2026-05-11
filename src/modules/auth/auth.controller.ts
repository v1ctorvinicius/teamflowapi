import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthService } from "./auth.service.ts";
import type { LoginInput, RefreshInput } from "./auth.types.ts";

export class AuthController {
  constructor(private service: AuthService) {}

  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply,
  ) {
    const tokens = await this.service.login(request.body);
    return reply.status(200).send({ data: tokens });
  }

  async refresh(
    request: FastifyRequest<{ Body: RefreshInput }>,
    reply: FastifyReply,
  ) {
    const tokens = await this.service.refresh(request.body.refreshToken);
    return reply.status(200).send({ data: tokens });
  }

  async logout(
    request: FastifyRequest<{ Body: RefreshInput }>,
    reply: FastifyReply,
  ) {
    await this.service.logout(request.body.refreshToken);
    return reply.status(204).send();
  }
}
