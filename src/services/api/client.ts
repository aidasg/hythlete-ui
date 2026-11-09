import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@/services/api/generated/schema";
import { getApiBaseUrl } from "@/services/api/config";
import { ApiResponseError, formatRequestFailure, requestIdFrom, type ApiFailure } from "./errors";

export const requestErrorMiddleware: Middleware = {
  onError({ error, request }) {
    if (request.signal.aborted || error instanceof DOMException && error.name === "AbortError") return;
    return new ApiResponseError(0);
  },
  async onResponse({ response, request }) {
    if (response.ok) {
      if (response.status === 204 || response.status === 205 || request.method === "HEAD") return;
      if (response.headers.get("Content-Type")?.includes("application/json")) {
        try { await response.clone().json(); } catch (error) {
          if (request.signal.aborted) throw error;
          throw new ApiResponseError(response.status, undefined, undefined, requestIdFrom(response));
        }
      }
      return;
    }
    let body: ApiFailure | undefined;
    try { body = await response.clone().json() as ApiFailure; } catch { /* Proxies may return HTML or no body. */ }
    const requestId = requestIdFrom(response, body);
    const detail = response.status < 500 && typeof body?.error === "string" ? body.error : undefined;
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    return new Response(JSON.stringify({
      error: formatRequestFailure(requestId, detail),
      code: body?.code,
      request_id: requestId,
    }), { status: response.status, statusText: response.statusText, headers });
  },
};

export const apiClient = createClient<paths>({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
});
apiClient.use(requestErrorMiddleware);
