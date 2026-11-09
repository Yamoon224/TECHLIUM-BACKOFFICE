/**
 * Client-side access to the Identity module (backend/app/Modules/Identity).
 * Plain `fetch` rather than the typed api-client: the backend's OpenAPI spec
 * doesn't declare response bodies yet (descriptions only), so these types are
 * hand-kept against the actual API Resources until that's closed.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const TOKEN_STORAGE_KEY = "TechLium_backoffice_token";

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  locale: string;
  roles: string[];
  /** Features this account may use, and the ones switched off for it (absent on an older API). */
  abilities?: string[];
  disabled_features?: string[];
  created_at: string | null;
}

export class AuthError extends Error {}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Erreur inattendue (${response.status}).`;
  } catch {
    return `Erreur inattendue (${response.status}).`;
  }
}

export async function login(email: string, password: string, deviceName: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, device_name: deviceName }),
  });

  if (!response.ok) {
    throw new AuthError(await parseErrorMessage(response));
  }

  return response.json() as Promise<{ user: User; token: string }>;
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new AuthError(await parseErrorMessage(response));
  }

  return response.json() as Promise<User>;
}

export async function logout(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Asks for a reset link. The answer is the same whether or not the address has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) throw new AuthError(await parseErrorMessage(response));
}

export interface PasswordResetInput {
  token: string;
  email: string;
  password: string;
}

/** Sets the new password with the token from the e-mail (single use, limited time). */
export async function resetPassword({ token, email, password }: PasswordResetInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token, email, password, password_confirmation: password }),
  });

  if (!response.ok) throw new AuthError(await parseErrorMessage(response));
}
