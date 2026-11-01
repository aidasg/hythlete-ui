import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { InvoiceDetail } from "@/features/billing/components/InvoiceDetail";
export function InvoicePage() { return <AuthenticatedAppShell><InvoiceDetail /></AuthenticatedAppShell>; }
