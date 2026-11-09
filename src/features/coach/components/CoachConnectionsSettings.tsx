import { useQuery } from "@tanstack/react-query";
import { billingKeys, getSubscription } from "@/features/billing/services/billingApi";
import { McpConnections } from "./McpConnections";
export function CoachConnectionsSettings() {
  const billing = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription, retry: false });
  return <section className="coach-integration-settings"><McpConnections title="AI integrations" canCreate={billing.data?.ai_access === true} /></section>;
}
