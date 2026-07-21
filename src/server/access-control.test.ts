import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  AuthRequiredError,
  assertOwnsReport,
  normalizeEmail,
  requireAuthenticatedUser,
  requireOwnedResource,
  scopedByCurrentUser,
} from "./access-control";

const user = {
  id: "user_1",
  email: "seller@example.com",
};

describe("server access control", () => {
  it("normalizes email before server-side user lookup or write", () => {
    expect(normalizeEmail("  Seller@Example.COM ")).toBe("seller@example.com");
  });

  it("requires an authenticated user", () => {
    expect(() => requireAuthenticatedUser(null)).toThrow(AuthRequiredError);
    expect(() => requireAuthenticatedUser({ id: "" })).toThrow(
      AuthRequiredError,
    );
    expect(requireAuthenticatedUser(user)).toBe(user);
  });

  it("allows access to an owned report", () => {
    expect(() => assertOwnsReport(user, { userId: "user_1" })).not.toThrow();
  });

  it("denies access to another user's report", () => {
    expect(() => assertOwnsReport(user, { userId: "user_2" })).toThrow(
      AccessDeniedError,
    );
  });

  it("denies access when a report is missing", () => {
    expect(() => assertOwnsReport(user, null)).toThrow(AccessDeniedError);
  });

  it("builds user-scoped where clauses instead of trusting caller-provided userId", () => {
    expect(
      scopedByCurrentUser(user, { id: "report_1", userId: "user_2" }),
    ).toEqual({
      id: "report_1",
      userId: "user_1",
    });
  });

  it("loads resources through the authenticated user's scope", async () => {
    await expect(
      requireOwnedResource(user, async (userId) => ({
        id: "report_1",
        userId,
      })),
    ).resolves.toEqual({
      id: "report_1",
      userId: "user_1",
    });
  });

  it("does not reveal whether another user's resource exists", async () => {
    await expect(
      requireOwnedResource(user, async () => ({
        id: "report_1",
        userId: "user_2",
      })),
    ).rejects.toThrow(AccessDeniedError);
  });
});
