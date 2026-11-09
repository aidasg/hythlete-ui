import { ApiResponseError, apiResponseError, type ApiFailure } from "@/services/api/errors";
import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";
export type BillingState = components["schemas"]["billing.State"];
export type Selection = components["schemas"]["billing.Selection"];
export class BillingError extends ApiResponseError {
  constructor(message: string, status: number, details?: ApiFailure, requestId?: string, code?: string) { super(status, message, details, requestId, code); }
}
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    const failure = apiResponseError(result);
    const error = new BillingError("", failure.status, failure.details, failure.requestId, failure.code);
    error.message = failure.message;
    throw error;
  }
  return result.data;
}
export const getPlans = async () => unwrap(await apiClient.GET("/v1/billing/plans"));
export const getSubscription = async () => unwrap(await apiClient.GET("/v1/billing/subscription"));
export const selectPlan = async (body: Selection) => unwrap(await apiClient.PUT("/v1/billing/subscription", { body }));
export const getPayments = async (cursor?: string) => unwrap(await apiClient.GET("/v1/billing/payments", { params: { query: { limit: 20, cursor } } }));
export const getInvoice = async (id: number) => unwrap(await apiClient.GET("/v1/billing/invoices/{id}", { params: { path: { id } } }));
export const getLatestInvoice = async () => {
  const result = await apiClient.GET("/v1/billing/invoices/latest");
  if (result.response.status === 404) return null;
  return unwrap(result);
};
export function money(amount = 0, currency = "EUR") {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 10 ** digits);
}
export function billingDate(value?: string) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""; }
export const billingKeys = { subscription: ["billing", "subscription"] as const };
