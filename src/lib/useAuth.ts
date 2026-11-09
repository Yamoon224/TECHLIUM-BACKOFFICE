"use client";

import { useEffect, useState } from "react";
import { AuthError, TOKEN_STORAGE_KEY, fetchCurrentUser, login as loginRequest, logout as logoutRequest, type User } from "./auth";

type SessionStatus = "checking" | "ready";

/** Tells the application shell (its own session reader) that the user logged in or out. */
export const AUTH_CHANGED_EVENT = "TechLium:auth-changed";

function announceAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function useAuth() {
  const [hasStoredToken] = useState(
    () => typeof window !== "undefined" && Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
  );
  const [status, setStatus] = useState<SessionStatus>(hasStoredToken ? "checking" : "ready");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!hasStoredToken) {
      return;
    }

    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      return;
    }

    fetchCurrentUser(stored)
      .then((fetchedUser) => {
        setToken(stored);
        setUser(fetchedUser);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setStatus("ready"));
  }, [hasStoredToken]);

  async function login(email: string, password: string): Promise<void> {
    const result = await loginRequest(email, password, "TechLium-backoffice-web");
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    announceAuthChange();
  }

  async function logout(): Promise<void> {
    if (token) {
      await logoutRequest(token).catch(() => undefined);
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    announceAuthChange();
  }

  return { status, token, user, login, logout };
}

export { AuthError };
export type { User };
