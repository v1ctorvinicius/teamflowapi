// user.routes.test.ts
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { createFastifyApp } from "@/infra/http/fastify.ts";
import { usersRoutes } from "@/modules/user/user.routes.ts";
import { signTestToken } from "../helpers/app.ts";
import { makeUser } from "../helpers/factories.ts";

// ─── Mocks dos Repositórios ────────────────────────────────────────────────
const mockCreate = vi.fn();
const mockFindByEmail = vi.fn();
const mockFindById = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/modules/user/user.repository.pg.ts", () => ({
  PostgresUsersRepository: class {
    findByEmail = mockFindByEmail;
    findById = mockFindById;
    create = mockCreate;
    update = mockUpdate;
  },
}));

// ─── Mock do AuthService (CRÍTICO) ─────────────────────────────────────────
vi.mock("@/modules/auth/auth.service.ts", () => ({
  AuthService: class {
    issueTokenPairForUser = vi.fn().mockResolvedValue({
      accessToken: "mock-access-token-123",
      refreshToken: "mock-refresh-token-456",
    });
    hashPassword = vi.fn().mockResolvedValue("hashed-password-mock");
    verifyPassword = vi.fn();
    validateRefreshToken = vi.fn();
    revokeRefreshToken = vi.fn();
  },
}));

describe("Users routes — integration", () => {
  let app: FastifyInstance;
  let mockPool: any;

  beforeAll(async () => {
    // Cria um pool mockado
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
    };

    // Cria a app sem as configurações de produção
    app = createFastifyApp();

    // Registra as rotas com um pool mockado
    await app.register(usersRoutes, {
      prefix: "/users",
      pgPool: mockPool,
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Limpa os mocks entre os testes
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /users/register ──────────────────────────────────────────────────
  describe("POST /users/register", () => {
    it("returns 201 with public user (no passwordHash)", async () => {
      const mockUser = makeUser({ email: "fan@teamflow.com" });
      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockUser);

      // Mock para o INSERT no banco
      mockPool.query = vi.fn().mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
      });

      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          email: "fan@teamflow.com",
          password: "senha123",
          name: "Torcedor Silva",
          favoriteTeam: "Flamengo",
        },
      });

      console.log("Response body:", res.body); // Debug: veja o erro real

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.email).toBe("fan@teamflow.com");
      expect(body.data.passwordHash).toBeUndefined();
    });

    it("returns 201 with accessToken and refreshToken on valid payload", async () => {
      const mockUser = makeUser({ email: "fan@teamflow.com" });
      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockUser);

      mockPool.query = vi.fn().mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
      });

      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          email: "fan@teamflow.com",
          password: "senha123",
          name: "Torcedor Silva",
          favoriteTeam: "Flamengo",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();

      // Verifica a estrutura esperada
      expect(body.data).toHaveProperty("accessToken");
      expect(body.data).toHaveProperty("refreshToken");
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
    });

    it("returns 409 when email is already registered", async () => {
      mockFindByEmail.mockResolvedValue(
        makeUser({ email: "existing@test.com" }),
      );
      mockCreate.mockResolvedValue(null);

      mockPool.query = vi.fn().mockResolvedValue({
        rows: [{ email: "existing@test.com" }],
        rowCount: 1,
      });

      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          email: "existing@test.com",
          password: "senha123",
          name: "Torcedor",
          favoriteTeam: "Flamengo",
        },
      });

      expect(res.statusCode).toBe(409);
      // Pode ser que seu error code seja diferente
      expect(res.json().error?.code || res.json().code).toBe("CONFLICT");
    });

    it("returns 400 when email is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          password: "senha123",
          name: "Torcedor",
          favoriteTeam: "Flamengo",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when password is too short (< 8 chars)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          email: "fan@test.com",
          password: "curta",
          name: "Test",
          favoriteTeam: "Flamengo",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when favoriteTeam is an empty string", async () => {
      mockFindByEmail.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/users/register",
        payload: {
          email: "fan@teamflow.com",
          password: "senha123",
          name: "Torcedor Silva",
          favoriteTeam: "",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── GET /users/me ─────────────────────────────────────────────────────────
  describe("GET /users/me", () => {
    it("returns 200 and public user when authenticated", async () => {
      const mockUser = makeUser({
        id: "user-uuid-1",
        email: "fan@teamflow.com",
      });
      mockFindById.mockResolvedValue(mockUser);

      mockPool.query = vi.fn().mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
      });

      const token = await signTestToken({
        sub: "user-uuid-1",
        email: "fan@teamflow.com",
        role: "CUSTOMER",
      });

      const res = await app.inject({
        method: "GET",
        url: "/users/me",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe("user-uuid-1");
      expect(body.data).not.toHaveProperty("passwordHash");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await app.inject({ method: "GET", url: "/users/me" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when token is malformed", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/users/me",
        headers: { authorization: "Bearer not.a.real.token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── PATCH /users/me ───────────────────────────────────────────────────────
  describe("PATCH /users/me", () => {
    it("updates and returns user when authenticated", async () => {
      const originalUser = makeUser({
        id: "user-uuid-1",
        name: "Nome Original",
        favoriteTeam: "Flamengo",
      });

      const updatedUser = makeUser({
        id: "user-uuid-1",
        name: "Novo Nome",
        favoriteTeam: "Palmeiras",
        email: "fan@teamflow.com",
      });

      mockFindById.mockResolvedValue(originalUser);
      mockUpdate.mockResolvedValue(updatedUser);

      mockPool.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [originalUser], rowCount: 1 }) // SELECT
        .mockResolvedValueOnce({ rows: [updatedUser], rowCount: 1 }); // UPDATE

      const token = await signTestToken({
        sub: "user-uuid-1",
        email: "fan@teamflow.com",
        role: "CUSTOMER",
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/users/me",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Novo Nome", favoriteTeam: "Palmeiras" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.name).toBe("Novo Nome");
      expect(body.data.favoriteTeam).toBe("Palmeiras");
    });

    it("returns 401 when updating without token", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/users/me",
        payload: { name: "Novo Nome" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
