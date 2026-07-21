import type { AuthRateLimitDecision } from "./auth-rate-limit";
import type { AuthValidationErrorCode } from "./auth-validation";

export type AuthHttpErrorCode =
  | AuthValidationErrorCode
  | "invalid_code"
  | "rate_limited"
  | "delivery_unavailable";

export type AuthHttpResponseBody =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: AuthHttpErrorCode;
      message: string;
      retryAfterSeconds?: number;
    };

export type AuthHttpResponse = {
  status: number;
  body: AuthHttpResponseBody;
};

const ERROR_RESPONSES: Record<AuthHttpErrorCode, AuthHttpResponse> = {
  email_required: {
    status: 400,
    body: {
      ok: false,
      error: "email_required",
      message: "Введите email.",
    },
  },
  email_invalid: {
    status: 400,
    body: {
      ok: false,
      error: "email_invalid",
      message: "Проверьте email: похоже, в адресе ошибка.",
    },
  },
  code_required: {
    status: 400,
    body: {
      ok: false,
      error: "code_required",
      message: "Введите код из письма.",
    },
  },
  code_invalid: {
    status: 400,
    body: {
      ok: false,
      error: "code_invalid",
      message: "Код должен состоять из 6 цифр.",
    },
  },
  invalid_code: {
    status: 401,
    body: {
      ok: false,
      error: "invalid_code",
      message: "Код не подошёл. Проверьте письмо или запросите новый код.",
    },
  },
  rate_limited: {
    status: 429,
    body: {
      ok: false,
      error: "rate_limited",
      message: "Слишком много попыток. Попробуйте позже.",
    },
  },
  delivery_unavailable: {
    status: 503,
    body: {
      ok: false,
      error: "delivery_unavailable",
      message: "Отправка кода пока не подключена. Попробуйте позже.",
    },
  },
};

export function authSuccess(message: string): AuthHttpResponse {
  return {
    status: 200,
    body: {
      ok: true,
      message,
    },
  };
}

export function authError(error: AuthHttpErrorCode): AuthHttpResponse {
  return ERROR_RESPONSES[error];
}

export function authRateLimitError(
  decision: Extract<AuthRateLimitDecision, { allowed: false }>,
): AuthHttpResponse {
  return {
    status: 429,
    body: {
      ok: false,
      error: "rate_limited",
      message: "Слишком много попыток. Попробуйте позже.",
      retryAfterSeconds: decision.retryAfterSeconds,
    },
  };
}
