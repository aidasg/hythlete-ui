import {
  ReactNode,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "@/features/auth/context/authContextValue";
import { queryClient } from "@/services/query/queryClient";
import { logout } from "@/features/auth/services/authApi";
import {
  clearAuthSession,
  validateAuthSession,
  type ValidatedAuthSession,
} from "@/features/auth/services/authSession";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const previousUser = useRef<number | undefined>();
  const [session, setSession] = useState<ValidatedAuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");

  const refreshSession = useCallback(async () => {
    setStatus("checking");

    const validatedSession = await validateAuthSession();

    if (previousUser.current !== validatedSession?.profile?.user_id) { await queryClient.cancelQueries(); queryClient.clear(); }
    previousUser.current = validatedSession?.profile?.user_id;
    setSession(validatedSession);
    setStatus(validatedSession ? "authenticated" : "anonymous");

    return validatedSession;
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logout();
    } finally {
      await queryClient.cancelQueries();
      queryClient.clear();
      previousUser.current = undefined;
      clearAuthSession();
      setSession(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      isAuthenticated: status === "authenticated",
      refreshSession,
      logoutUser,
    }),
    [logoutUser, refreshSession, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
