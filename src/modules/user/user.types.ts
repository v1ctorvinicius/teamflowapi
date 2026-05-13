// src/modules/user/user.types.ts
import type { UUID, ISODateString } from "../../shared/types.ts";

export type UserRole = "CUSTOMER" | "ADMIN" | "AFFILIATE";

export interface User {
  id: UUID;
  email: string;
  passwordHash: string;
  name: string;
  role: "CUSTOMER" | "ADMIN" | "AFFILIATE";
  favoriteTeam?: string;
  emailVerified: boolean;
  phone?: string;

  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PublicUser extends Omit<User, "passwordHash"> {}

// inputs
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  favoriteTeam?: string;
}

export type UpdateUserInput = UpdateProfileInput;

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  favoriteTeam?: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  phone?: string;
  favoriteTeam?: string;

  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
