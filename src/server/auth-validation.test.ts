import { describe, expect, it } from "vitest";

import {
  validateEmailInput,
  validateLoginCodeInput,
  validateLoginCodeRequestPayload,
  validateLoginCodeVerifyPayload,
} from "./auth-validation";

describe("validateEmailInput", () => {
  it("normalizes valid email", () => {
    expect(validateEmailInput(" Seller@Example.COM ")).toEqual({
      ok: true,
      value: "seller@example.com",
    });
  });

  it.each([undefined, null, "", "   "])("rejects missing email %#", (value) => {
    expect(validateEmailInput(value)).toEqual({
      ok: false,
      error: "email_required",
    });
  });

  it.each(["seller", "@example.com", "seller@", "seller @example.com"])(
    "rejects invalid email %s",
    (value) => {
      expect(validateEmailInput(value)).toEqual({
        ok: false,
        error: "email_invalid",
      });
    },
  );

  it("rejects overlong email", () => {
    const value = `${"a".repeat(245)}@example.com`;

    expect(validateEmailInput(value)).toEqual({
      ok: false,
      error: "email_invalid",
    });
  });
});

describe("validateLoginCodeInput", () => {
  it("accepts a six digit code", () => {
    expect(validateLoginCodeInput(" 123456 ")).toEqual({
      ok: true,
      value: "123456",
    });
  });

  it.each([undefined, null, "", "   "])("rejects missing code %#", (value) => {
    expect(validateLoginCodeInput(value)).toEqual({
      ok: false,
      error: "code_required",
    });
  });

  it.each(["12345", "1234567", "abcdef", "123 456"])(
    "rejects invalid code %s",
    (value) => {
      expect(validateLoginCodeInput(value)).toEqual({
        ok: false,
        error: "code_invalid",
      });
    },
  );
});

describe("validateLoginCodeRequestPayload", () => {
  it("returns normalized request payload", () => {
    expect(
      validateLoginCodeRequestPayload({ email: " Seller@Example.COM " }),
    ).toEqual({
      ok: true,
      value: { email: "seller@example.com" },
    });
  });

  it("rejects non-object payload", () => {
    expect(validateLoginCodeRequestPayload("seller@example.com")).toEqual({
      ok: false,
      error: "email_required",
    });
  });
});

describe("validateLoginCodeVerifyPayload", () => {
  it("returns normalized verify payload", () => {
    expect(
      validateLoginCodeVerifyPayload({
        email: " Seller@Example.COM ",
        code: " 123456 ",
      }),
    ).toEqual({
      ok: true,
      value: { email: "seller@example.com", code: "123456" },
    });
  });

  it("returns code error after valid email", () => {
    expect(
      validateLoginCodeVerifyPayload({
        email: "seller@example.com",
        code: "abc",
      }),
    ).toEqual({
      ok: false,
      error: "code_invalid",
    });
  });
});
