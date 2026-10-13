import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { useAuth } from "@/features/auth/context/useAuth";
import { ProfileSetup } from "@/features/profile/components/ProfileSetup";

export function SetupPage() {
  const { session } = useAuth();
  return <AuthenticatedAppShell><ProfileSetup profile={session?.profile} /></AuthenticatedAppShell>;
}
