import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  UnprocessableEntityError,
} from "@/shared/errors.ts";

describe("AppError hierarchy", () => {
  it("NotFoundError has statusCode 404 and code NOT_FOUND", () => {
    const err = new NotFoundError("thing not found");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("thing not found");
  });

  it("ConflictError has statusCode 409", () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("UnauthorizedError has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError has statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("ValidationError has statusCode 400", () => {
    const err = new ValidationError("invalid field");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("UnprocessableEntityError has statusCode 422", () => {
    const err = new UnprocessableEntityError("cannot process");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("UNPROCESSABLE_ENTITY");
  });

  it("all errors are instances of Error", () => {
    const errors = [
      new NotFoundError(),
      new ConflictError(),
      new UnauthorizedError(),
      new ForbiddenError(),
      new ValidationError("x"),
      new UnprocessableEntityError("x"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
