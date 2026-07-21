import type { LoginCodeDelivery } from "./auth-flow";

export class LoginCodeDeliveryUnavailableError extends Error {
  constructor() {
    super("login code delivery provider is not configured");
    this.name = "LoginCodeDeliveryUnavailableError";
  }
}

export type LoginCodeDeliveryProvider = LoginCodeDelivery & {
  readonly available: boolean;
};

export function createUnavailableLoginCodeDelivery(): LoginCodeDeliveryProvider {
  return {
    available: false,
    async sendLoginCode(): Promise<void> {
      throw new LoginCodeDeliveryUnavailableError();
    },
  };
}

export function isLoginCodeDeliveryUnavailable(
  error: unknown,
): error is LoginCodeDeliveryUnavailableError {
  return error instanceof LoginCodeDeliveryUnavailableError;
}
