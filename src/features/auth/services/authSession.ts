import type { AuthResponse } from "@/features/auth/services/authApi";
import { getProfile } from "@/features/profile/services/profileApi";

const AUTH_SESSION_STORAGE_KEY = "hythlete.authSession";

export type StoredAuthSession = Pick<
  AuthResponse,
  "email" | "user_id" | "username"
>;

export type ValidatedAuthSession = {
  email: string;
  profile: Awaited<ReturnType<typeof getProfile>>["data"];
  session: StoredAuthSession | null;
};

export function saveAuthSession(session: StoredAuthSession) {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredAuthSession(): StoredAuthSession | null {
  const rawSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredAuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export async function validateAuthSession(): Promise<ValidatedAuthSession | null> {
  const storedSession = getStoredAuthSession();
  const profileResult = await getProfile();

  if (profileResult.error) {
    clearAuthSession();
    return null;
  }

  return {
    email:
      storedSession?.email || `User #${profileResult.data.user_id || "unknown"}`,
    profile: profileResult.data,
    session: storedSession,
  };
}
