// src/tests/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UsersService } from "../modules/user/user.service";
import { AuthService } from "../modules/auth/auth.service";

describe("UsersService", () => {
  let usersService: UsersService;
  let mockUserRepository: any;
  let mockAuthService: any;

  beforeEach(() => {
    // Mock do UserRepository
    mockUserRepository = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    // Mock do AuthService com todos os métodos necessários
    mockAuthService = {
      issueTokenPairForUser: vi.fn().mockResolvedValue({
        accessToken: "mock-access-token-123",
        refreshToken: "mock-refresh-token-456",
      }),
      hashPassword: vi.fn().mockResolvedValue("hashed-password-mock"),
      verifyPassword: vi.fn(),
      validateRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
    };

    // Instancia o UsersService com os mocks
    usersService = new UsersService(mockUserRepository, mockAuthService);
  });

  it("creates a user and returns public profile (no passwordHash)", async () => {
    const mockUser = {
      id: "user-id-1",
      email: "fan@teamflow.com",
      name: "Torcedor Silva",
      passwordHash: "hashed-password-123",
      role: "CUSTOMER",
      favoriteTeam: "Flamengo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(mockUser);

    const result = await usersService.register({
      email: "fan@teamflow.com",
      password: "SecurePass123",
      name: "Torcedor Silva",
      favoriteTeam: "Flamengo",
    });

    expect(result.user).toBeDefined();
    expect(result.user.id).toBe("user-id-1");
    expect(result.user.email).toBe("fan@teamflow.com");
    expect(result.user.name).toBe("Torcedor Silva");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.tokens).toBeDefined();
    expect(result.tokens.accessToken).toBe("mock-access-token-123");
    expect(result.tokens.refreshToken).toBe("mock-refresh-token-456");

    // Verifica se o authService foi chamado corretamente
    expect(mockAuthService.issueTokenPairForUser).toHaveBeenCalledWith(
      mockUser.id,
      mockUser.email,
      mockUser.role,
    );
  });

  it("lowercases the email before storing", async () => {
    const mockUser = {
      id: "user-id-1",
      email: "fan@teamflow.com",
      name: "Torcedor Silva",
      passwordHash: "hashed-password-123",
      role: "CUSTOMER",
      favoriteTeam: "Flamengo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(mockUser);

    await usersService.register({
      email: "FAN@TEAMFLOW.COM",
      password: "SecurePass123",
      name: "Torcedor Silva",
      favoriteTeam: "Flamengo",
    });

    // Verifica se o email foi convertido para lowercase antes de criar
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fan@teamflow.com", // Deve estar em lowercase
      }),
    );
  });

  it("stores a hashed password, never plaintext", async () => {
    const plainPassword = "MySecret123";

    const mockUser = {
      id: "user-id-1",
      email: "user@example.com",
      name: "Test User",
      passwordHash: "hashed-password-xyz", // Será o hash retornado
      role: "CUSTOMER",
      favoriteTeam: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockImplementation(async (input) => ({
      ...mockUser,
      passwordHash: input.passwordHash, // Usa o hash passado
    }));

    const result = await usersService.register({
      email: "user@example.com",
      password: plainPassword,
      name: "Test User",
    });

    // Verifica se o passwordHash foi salvo (não a senha plaintext)
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+$/), // Formato salt:hash
      }),
    );

    const createCallArg = mockUserRepository.create.mock.calls[0][0];
    expect(createCallArg.passwordHash).not.toBe(plainPassword);
    expect(createCallArg.passwordHash).toMatch(/:/); // Tem salt:hash

    // Verifica que o usuário retornado não tem a senha
    expect(result.user).not.toHaveProperty("password");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("throws ValidationError when email is missing", async () => {
    await expect(
      usersService.register({
        email: "",
        password: "SecurePass123",
        name: "Test User",
      }),
    ).rejects.toThrow("email, password, and name are required");
  });

  it("throws ValidationError when password is missing", async () => {
    await expect(
      usersService.register({
        email: "test@test.com",
        password: "",
        name: "Test User",
      }),
    ).rejects.toThrow("email, password, and name are required");
  });

  it("throws ValidationError when name is missing", async () => {
    await expect(
      usersService.register({
        email: "test@test.com",
        password: "SecurePass123",
        name: "",
      }),
    ).rejects.toThrow("email, password, and name are required");
  });

  it("throws ValidationError when password is too short", async () => {
    await expect(
      usersService.register({
        email: "test@test.com",
        password: "short",
        name: "Test User",
      }),
    ).rejects.toThrow("password must be at least 8 characters");
  });

  it("throws ValidationError when favoriteTeam is empty string", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await expect(
      usersService.register({
        email: "test@test.com",
        password: "SecurePass123",
        name: "Test User",
        favoriteTeam: "",
      }),
    ).rejects.toThrow("favoriteTeam cannot be empty");
  });

  it("throws ConflictError when email already exists", async () => {
    const existingUser = {
      id: "existing-id",
      email: "existing@test.com",
      name: "Existing User",
      passwordHash: "hash",
      role: "CUSTOMER",
      favoriteTeam: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUserRepository.findByEmail.mockResolvedValue(existingUser);

    await expect(
      usersService.register({
        email: "existing@test.com",
        password: "SecurePass123",
        name: "New User",
      }),
    ).rejects.toThrow("email already registered");
  });
});
