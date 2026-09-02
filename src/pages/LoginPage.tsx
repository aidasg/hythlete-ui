import { useState } from "react";
import { AuthBrandPanel } from "@/features/auth/components/AuthBrandPanel";
import type { AuthMode } from "@/features/auth/components/AuthForm";
import { LoginPanel } from "@/features/auth/components/LoginPanel";

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <main className="app-shell">
      <section className="login-layout" aria-label="Hythlete login">
        <AuthBrandPanel onStartPlanning={() => setMode("register")} />
        <LoginPanel mode={mode} onModeChange={setMode} />
      </section>
    </main>
  );
}
