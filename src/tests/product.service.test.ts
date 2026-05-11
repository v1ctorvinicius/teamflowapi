import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductsService } from "@/modules/product/product.service.ts";
import { mockProductsRepo } from "../helpers/mocks.ts";
import { makeProduct, makePlayerProduct } from "../helpers/factories.ts";
import {
  NotFoundError,
  ValidationError,
  UnprocessableEntityError,
} from "@/shared/errors.ts";

describe("ProductsService", () => {
  let repo: ReturnType<typeof mockProductsRepo>;
  let service: ProductsService;

  beforeEach(() => {
    repo = mockProductsRepo();
    service = new ProductsService(repo);
  });

  // ─── getProduct ───────────────────────────────────────────────────────────

  describe("getProduct", () => {
    it("returns the product when found", async () => {
      const product = makeProduct();
      repo.findById.mockResolvedValue(product);

      const result = await service.getProduct("product-uuid-1");

      expect(result).toEqual(product);
    });

    it("throws NotFoundError when product does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getProduct("nonexistent")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ─── listProducts ─────────────────────────────────────────────────────────

  describe("listProducts", () => {
    it("delegates to repo and returns paginated result", async () => {
      const paginated = {
        data: [makeProduct()],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      repo.findAll.mockResolvedValue(paginated);

      const result = await service.listProducts({ club: "Flamengo" });

      expect(repo.findAll).toHaveBeenCalledWith({ club: "Flamengo" });
      expect(result.data).toHaveLength(1);
    });
  });

  // ─── validatePersonalization — RN-01 ─────────────────────────────────────

  describe("validatePersonalization (RN-01)", () => {
    it("passes when no personalization is provided", async () => {
      await expect(
        service.validatePersonalization("product-uuid-1", {}),
      ).resolves.toBeUndefined();

      expect(repo.findById).not.toHaveBeenCalled();
    });

    it("throws ValidationError when name exceeds 12 characters", async () => {
      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "NOMEMUTILOONGO",
          number: 10,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when number is out of range (>99)", async () => {
      await expect(
        service.validatePersonalization("product-uuid-1", { number: 100 }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when number is negative", async () => {
      await expect(
        service.validatePersonalization("product-uuid-1", { number: -1 }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when product does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.validatePersonalization("ghost-id", { name: "SILVA", number: 9 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("allows any name+number on a PLAYER type product (no licensing restriction)", async () => {
      repo.findById.mockResolvedValue(makePlayerProduct());
      repo.findSquadRestrictions.mockResolvedValue([]);

      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "GABIGOL",
          number: 99,
        }),
      ).resolves.toBeUndefined();

      // Squad restrictions should NOT be queried for PLAYER type
      expect(repo.findSquadRestrictions).not.toHaveBeenCalled();
    });

    it("allows custom name+number on FAN type when not in restricted list", async () => {
      repo.findById.mockResolvedValue(makeProduct({ type: "FAN" }));
      repo.findSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "SILVA",   // custom name — not a current player
          number: 10,
        }),
      ).resolves.toBeUndefined();
    });

    it("throws UnprocessableEntityError when FAN replica uses current player name+number", async () => {
      repo.findById.mockResolvedValue(makeProduct({ type: "FAN", club: "Flamengo" }));
      repo.findSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "Gabigol",
          number: 99,
        }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it("restriction check is case-insensitive for player names", async () => {
      repo.findById.mockResolvedValue(makeProduct({ type: "FAN", club: "Flamengo" }));
      repo.findSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      // All casing variants should be blocked
      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "GABIGOL",
          number: 99,
        }),
      ).rejects.toThrow(UnprocessableEntityError);

      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "gabigol",
          number: 99,
        }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it("allows the player name with a DIFFERENT number on FAN type", async () => {
      repo.findById.mockResolvedValue(makeProduct({ type: "FAN", club: "Flamengo" }));
      repo.findSquadRestrictions.mockResolvedValue([
        { playerName: "Gabigol", number: 99, clubId: "Flamengo" },
      ]);

      // Same name, different number — should be allowed
      await expect(
        service.validatePersonalization("product-uuid-1", {
          name: "Gabigol",
          number: 10, // 99 is restricted, 10 is not
        }),
      ).resolves.toBeUndefined();
    });

    it("skips restriction check when name is provided but number is omitted", async () => {
      repo.findById.mockResolvedValue(makeProduct({ type: "FAN" }));

      await expect(
        service.validatePersonalization("product-uuid-1", { name: "SILVA" }),
      ).resolves.toBeUndefined();

      expect(repo.findSquadRestrictions).not.toHaveBeenCalled();
    });
  });
});
