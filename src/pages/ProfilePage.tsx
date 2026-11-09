import { CoachConnectionsSettings } from "@/features/coach/components/CoachConnectionsSettings";
import { useCoachPageContext } from "@/features/coach/context/coachContext";
import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { useAuth } from "@/features/auth/context/useAuth";
import { ProfileEditor } from "@/features/profile/components/ProfileEditor";

export function ProfilePage() {
  const { session } = useAuth();
  useCoachPageContext({surface:"profile",title:"Your training goals"});

  return (
    <AuthenticatedAppShell>
      <ProfileEditor profile={session?.profile} /><CoachConnectionsSettings />
    </AuthenticatedAppShell>
  );
}
