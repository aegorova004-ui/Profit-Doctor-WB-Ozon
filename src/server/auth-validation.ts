import { normalizeEmail } from "./access-control";

const MAX_EMAIL_LENGTH = 254;
const LOGIN_CODE_PATTERN = /^\d{6}$/;

export type AuthValidationErrorCode =
  "email_required" | "email_invalid" | "code_required" | "code_invalid";

export type AuthValidationResult<T> =
  { ok: true; value: T } | { ok: false; error: AuthValidationErrorCode };

export type LoginCodeRequestInput = {
  email: string;
};

export type LoginCodeVerifyInput = {
  email: string;
  code: string;
};

export function validateEmailInput(
  value: unknown,
): AuthValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "email_required" };
  }

  const email = normalizeEmail(value);

  if (!email) {
    return { ok: false, error: "email_required" };
  }

  if (
    email.length > MAX_EMAIL_LENGTH ||
    !email.includes("@") ||
    email.startsWith("@") ||
    email.endsWith("@") ||
    email.includes(" ")
  ) {
    return { ok: false, error: "email_invalid" };
  }

  return { ok: true, value: email };
}

export function validateLoginCodeInput(
  value: unknown,
): AuthValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "code_required" };
  }

  const code = value.trim();

  if (!code) {
    return { ok: false, error: "code_required" };
  }

  if (!LOGIN_CODE_PATTERN.test(code)) {
    return { ok: false, error: "code_invalid" };
  }

  return { ok: true, value: code };
}

export function validateLoginCodeRequestPayload(
  payload: unknown,
): AuthValidationResult<LoginCodeRequestInput> {
  const record = toRecord(payload);

  if (!record) {
    return { ok: false, error: "email_required" };
  }

  const email = validateEmailInput(record.email);

  if (!email.ok) {
    return email;
  }

  return { ok: true, value: { email: email.value } };
}

export function validateLoginCodeVerifyPayload(
  payload: unknown,
): AuthValidationResult<LoginCodeVerifyInput> {
  const record = toRecord(payload);

  if (!record) {
    return { ok: false, error: "email_required" };
  }

  const email = validateEmailInput(record.email);

  if (!email.ok) {
    return email;
  }

  const code = validateLoginCodeInput(record.code);

  if (!code.ok) {
    return code;
  }

  return { ok: true, value: { email: email.value, code: code.value } };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
