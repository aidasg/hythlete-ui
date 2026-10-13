import type { AuthResponse } from "@/features/auth/services/authApi";
import { getProfile } from "@/features/profile/services/profileApi";

const PROFILE_CACHE_KEY = "hythlete.offlineProfile.v1";
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
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("hythlete.strategyConstraints.") || key.startsWith("hythlete.execution.")) window.localStorage.removeItem(key);
  }
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(PROFILE_CACHE_KEY);
}

export async function validateAuthSession(): Promise<ValidatedAuthSession | null> {
  const storedSession = getStoredAuthSession();
  let profileResult: Awaited<ReturnType<typeof getProfile>>;
  try { profileResult = await getProfile(); }
  catch {
    // Local execution remains available offline; the server still authorizes every write.
    try {
      const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
      if (!navigator.onLine && storedSession?.user_id && cached?.user_id === storedSession.user_id) return { email: storedSession.email || "Offline", profile: cached, session: storedSession };
    } catch { /* Invalid offline data is never treated as a session. */ }
    return null;
  }

  if (profileResult.error) {
    clearAuthSession();
    return null;
  }

  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileResult.data)); } catch { /* Online session remains usable. */ }
  return {
    email:
      storedSession?.email || `User #${profileResult.data.user_id || "unknown"}`,
    profile: profileResult.data,
    session: storedSession,
  };
}
