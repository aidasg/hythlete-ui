import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { useAuth } from "@/features/auth/context/useAuth";
import { ProfileEditor } from "@/features/profile/components/ProfileEditor";

export function ProfilePage() {
  const { session } = useAuth();

  return (
    <AuthenticatedAppShell>
      <ProfileEditor profile={session?.profile} />
    </AuthenticatedAppShell>
  );
}
