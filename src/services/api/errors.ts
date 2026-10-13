export type ApiFailure = {
  error?: unknown;
};

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again."
) {
  if (error && typeof error === "object" && "error" in error) {
    const message = (error as ApiFailure).error;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export class ApiResponseError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.details = details;
  }
}

export function throwApiResponseError(
  result: { error?: unknown; response: Response },
  fallback: string
): never {
  throw new ApiResponseError(
    result.response.status,
    getApiErrorMessage(result.error, fallback),
    result.error
  );
}
