import { AuthBrandPanel } from "@/features/auth/components/AuthBrandPanel";
import { LoginPanel } from "@/features/auth/components/LoginPanel";

export function LoginPage() {
  return (
    <main className="app-shell">
      <section className="login-layout" aria-label="Hythlete login">
        <AuthBrandPanel />
        <LoginPanel />
      </section>
    </main>
  );
}
