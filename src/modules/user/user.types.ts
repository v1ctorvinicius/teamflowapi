// src/modules/user/user.types.ts
import type { UUID, ISODateString, UserRole } from "../../shared/types.ts";

export interface User {
  id: UUID;
  email: string;
  passwordHash: string;
  name: string;
  favoriteTeam: string | null;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  favoriteTeam?: string;
}

export interface UpdateUserInput {
  name?: string;
  favoriteTeam?: string;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  favoriteTeam?: string;
}
