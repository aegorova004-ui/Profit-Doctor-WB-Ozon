import { describe, expect, it } from "vitest";

import { type AuthHttpErrorCode, authError, authSuccess } from "./auth-http";

describe("authSuccess", () => {
  it("returns a stable success response", () => {
    expect(authSuccess("Код отправлен.")).toEqual({
      status: 200,
      body: {
        ok: true,
        message: "Код отправлен.",
      },
    });
  });
});

describe("authError", () => {
  it.each<{
    error: AuthHttpErrorCode;
    status: number;
    message: string;
  }>([
    {
      error: "email_required",
      status: 400,
      message: "Введите email.",
    },
    {
      error: "email_invalid",
      status: 400,
      message: "Проверьте email: похоже, в адресе ошибка.",
    },
    {
      error: "code_required",
      status: 400,
      message: "Введите код из письма.",
    },
    {
      error: "code_invalid",
      status: 400,
      message: "Код должен состоять из 6 цифр.",
    },
    {
      error: "invalid_code",
      status: 401,
      message: "Код не подошёл. Проверьте письмо или запросите новый код.",
    },
  ])(
    "maps $error to a stable public response",
    ({ error, status, message }) => {
      expect(authError(error)).toEqual({
        status,
        body: {
          ok: false,
          error,
          message,
        },
      });
    },
  );
});
