import type {
  User,
  CreateUserInput,
  UpdateUserInput,
} from "./user.types.ts";
import type { UUID } from "../../shared/types.ts";

export interface UsersRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: UUID): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: UUID, input: UpdateUserInput): Promise<User>;
  updatePassword(userId: UUID, newPasswordHash: string): Promise<User>;
  updateProfile(userId: UUID, input: UpdateProfileInput): Promise<PublicUser>;
  addToWishlist(userId: UUID, productId: UUID): Promise<void>;
  removeFromWishlist(userId: UUID, productId: UUID): Promise<void>;
  getWishlist(userId: UUID): Promise<Product[]>;
  isInWishlist(userId: UUID, productId: UUID): Promise<boolean>;
  findProductById(productId: string): Promise<any>;
}