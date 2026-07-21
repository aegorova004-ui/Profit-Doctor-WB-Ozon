export class AuthRequiredError extends Error {
  constructor(message = "Требуется вход в аккаунт") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class AccessDeniedError extends Error {
  constructor(message = "Нет доступа к этим данным") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

export type OwnerScopedResource = {
  userId: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("ru-RU");
}

export function requireAuthenticatedUser(
  user: AuthenticatedUser | null | undefined,
): AuthenticatedUser {
  if (!user?.id) {
    throw new AuthRequiredError();
  }

  return user;
}

export function assertOwnsResource(
  user: AuthenticatedUser | null | undefined,
  resource: OwnerScopedResource | null | undefined,
): asserts resource is OwnerScopedResource {
  const currentUser = requireAuthenticatedUser(user);

  if (!resource || resource.userId !== currentUser.id) {
    throw new AccessDeniedError();
  }
}

export function assertOwnsReport(
  user: AuthenticatedUser | null | undefined,
  report: OwnerScopedResource | null | undefined,
): asserts report is OwnerScopedResource {
  assertOwnsResource(user, report);
}

export function scopedByCurrentUser<TWhere extends object>(
  user: AuthenticatedUser | null | undefined,
  where: TWhere = {} as TWhere,
): TWhere & { userId: string } {
  const currentUser = requireAuthenticatedUser(user);

  return {
    ...where,
    userId: currentUser.id,
  };
}

export async function requireOwnedResource<
  TResource extends OwnerScopedResource,
>(
  user: AuthenticatedUser | null | undefined,
  loadResource: (userId: string) => Promise<TResource | null>,
): Promise<TResource> {
  const currentUser = requireAuthenticatedUser(user);
  const resource = await loadResource(currentUser.id);

  assertOwnsResource(currentUser, resource);

  return resource;
}
