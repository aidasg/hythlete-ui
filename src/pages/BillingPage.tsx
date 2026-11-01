import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { BillingWorkspace } from "@/features/billing/components/BillingWorkspace";
export function BillingPage() { return <AuthenticatedAppShell><BillingWorkspace /></AuthenticatedAppShell>; }
