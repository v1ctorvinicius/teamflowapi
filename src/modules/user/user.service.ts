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
  UnauthorizedError,
} from "../../shared/errors.ts";
import { AuthService } from "../auth/auth.service.ts";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function comparePassword(password: string, hashed: string): Promise<boolean> {
  const [salt, key] = hashed.split(":");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
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
    
    if (input.email && input.email !== user.email) {
      const existing = await this.repo.findByEmail(input.email.toLowerCase());
      if (existing) throw new ConflictError("Email already in use");
    }
    
    const updated = await this.repo.update(id, input);
    return toPublicUser(updated);
  }

  // password
  async changePassword(userId: UUID, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    
    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Senha atual incorreta");
    }
    
    if (newPassword.length < 8) {
      throw new ValidationError("Senha deve ter no mínimo 8 caracteres");
    }
    
    const newHash = await hashPassword(newPassword);
    await this.repo.updatePassword(userId, newHash);
  }

  // wishlist
  async getWishlist(userId: UUID): Promise<any[]> {
    return this.repo.getWishlist(userId);
  }

  async addToWishlist(userId: UUID, productId: string): Promise<void> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Product not found");
    await this.repo.addToWishlist(userId, productId);
  }

  async removeFromWishlist(userId: UUID, productId: string): Promise<void> {
    await this.repo.removeFromWishlist(userId, productId);
  }

  async isInWishlist(userId: UUID, productId: string): Promise<boolean> {
    return this.repo.isInWishlist(userId, productId);
  }
}