// src/modules/user/user.service.ts

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { UsersRepository } from "./user.repository.ts";
import type { AuthRepository } from "../auth/auth.repository.ts";
import type {
  User,
  PublicUser,
  RegisterUserInput,
  UpdateUserInput,
} from "./user.types.ts";
import type { TokenPair } from "../auth/auth.types.ts";
import type { UUID } from "../../shared/types.ts";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors.ts";
import { AuthService } from "../auth/auth.service.ts";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}

export interface RegisterResult {
  user: PublicUser;
  tokens: TokenPair;
}

export class UsersService {
  constructor(
    private repo: UsersRepository,
    private authService: AuthService,
  ) {}

  async register(input: RegisterUserInput): Promise<RegisterResult> {
    if (!input.email || !input.password || !input.name) {
      throw new ValidationError("email, password, and name are required");
    }

    if (input.password.length < 8) {
      throw new ValidationError("password must be at least 8 characters");
    }

    // favoriteTeam vazio deve ser rejeitado
    if (input.favoriteTeam !== undefined && input.favoriteTeam.trim() === "") {
      throw new ValidationError("favoriteTeam cannot be empty");
    }

    const existing = await this.repo.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new ConflictError("email already registered");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.repo.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      favoriteTeam: input.favoriteTeam,
    });

    // Emite o par de tokens imediatamente após o registro
    const tokens = await this.authService.issueTokenPairForUser(
      user.id,
      user.email,
      user.role,
    );

    return { user: toPublicUser(user), tokens };
  }

  async findById(id: UUID): Promise<PublicUser> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return toPublicUser(user);
  }

  async findByEmailForAuth(email: string) {
    return this.repo.findByEmail(email.toLowerCase());
  }

  async updateProfile(id: UUID, input: UpdateUserInput): Promise<PublicUser> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError("User not found");
    const updated = await this.repo.update(id, input);
    return toPublicUser(updated);
  }
}
