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
}
