import createClient from "openapi-fetch";
import type { paths } from "@/services/api/generated/schema";
import { getApiBaseUrl } from "@/services/api/config";

export const apiClient = createClient<paths>({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
});
