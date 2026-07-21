import { describe, expect, it } from "vitest";
import {
  getExpiredSessionCookieOptions,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth-cookie";

describe("auth cookie policy", () => {
  it("uses a product-scoped session cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("profit_doctor_session");
  });

  it("sets safe defaults for local development", () => {
    expect(getSessionCookieOptions("development")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it("requires secure cookies in production", () => {
    expect(getSessionCookieOptions("production")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });

  it("expires the session cookie without weakening its policy", () => {
    expect(getExpiredSessionCookieOptions("production")).toEqual({
      ...getSessionCookieOptions("production"),
      maxAge: 0,
    });
  });
});
