const DEFAULT_API_BASE_URL = "/api";

export function getApiBaseUrl() {
  return import.meta.env.VITE_HYTHLETE_API_BASE_URL || DEFAULT_API_BASE_URL;
}
