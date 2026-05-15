import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type AuthResponse = components["schemas"]["auth.AuthResponse"];
export type LoginRequest = components["schemas"]["auth.LoginRequest"];
export type RegisterRequest = components["schemas"]["auth.RegisterRequest"];

export function login(credentials: LoginRequest) {
  return apiClient.POST("/v1/auth/login", {
    body: credentials,
  });
}

export function logout() {
  return apiClient.POST("/v1/auth/logout");
}

export function register(payload: RegisterRequest) {
  return apiClient.POST("/v1/auth/register", {
    body: payload,
  });
}
