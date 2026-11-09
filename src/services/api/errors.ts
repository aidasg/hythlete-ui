export type ApiFailure = {
  error?: unknown;
  code?: string;
  request_id?: string;
};

export function requestIdFrom(response?: Response, body?: ApiFailure): string | undefined {
  const id = response?.headers.get("X-REQUEST-ID") || body?.request_id;
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : undefined;
}

export function formatRequestFailure(requestId?: string, publicMessage?: string): string {
  if (!requestId) return "Request failed. Request ID unavailable.";
  const detail = publicMessage?.trim();
  return ["Request failed.", detail && detail !== "Request failed" ? detail : undefined,
    requestId ? `Request ID: ${requestId}` : "Request ID unavailable."].filter(Boolean).join(" ");
}

export class ApiResponseError extends Error {
  constructor(
    public status: number,
    publicMessage?: string,
    public details?: ApiFailure,
    public requestId?: string,
    public code?: string,
  ) {
    super(formatRequestFailure(requestId, status >= 400 && status < 500 ? publicMessage : undefined));
    this.name = "ApiResponseError";
  }
}

export function apiResponseError(result: { error?: unknown; response: Response }): ApiResponseError {
  const body = result.error && typeof result.error === "object" ? result.error as ApiFailure : undefined;
  const id = requestIdFrom(result.response, body);
  const status = result.response?.status ?? 0;
  const error = new ApiResponseError(status, undefined, body, id, body?.code);
  // The client middleware has already applied the public-message policy.
  if (typeof body?.error === "string" && body.error.startsWith("Request failed.") && body.error.includes("Request ID")) {
    error.message = body.error;
  } else if (status >= 400 && status < 500) {
    error.message = formatRequestFailure(id, typeof body?.error === "string" ? body.error : undefined);
  }
  return error;
}

export function getApiErrorMessage(error: unknown, _fallback?: string): string {
  void _fallback;
  if (error instanceof ApiResponseError) return error.message;
  if (error && typeof error === "object" && "error" in error) {
    const body = error as ApiFailure;
    if (typeof body.error === "string" && body.error.startsWith("Request failed.") && body.error.includes("Request ID")) return body.error;
    return formatRequestFailure(requestIdFrom(undefined, body));
  }
  return formatRequestFailure();
}

export function throwApiResponseError(result: { error?: unknown; response: Response }, _fallback?: string): never {
  void _fallback;
  throw apiResponseError(result);
}
