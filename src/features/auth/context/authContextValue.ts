import { createContext } from "react";
import type { ValidatedAuthSession } from "@/features/auth/services/authSession";

export type AuthStatus = "checking" | "authenticated" | "anonymous";

export type AuthContextValue = {
  session: ValidatedAuthSession | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  refreshSession: () => Promise<ValidatedAuthSession | null>;
  logoutUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
