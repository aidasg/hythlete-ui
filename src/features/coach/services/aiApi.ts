import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";
export type Conversation = components["schemas"]["ai.Conversation"];
export type TurnRequest = components["schemas"]["ai.TurnRequest"];
export type TurnResult = components["schemas"]["ai.TurnResult"];
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    const error = result.error as { error?: string } | undefined;
    throw new Error(error?.error || "The coaching request could not be completed.");
  }
  return result.data;
}
export const listConversations = async () => unwrap(await apiClient.GET("/v1/coach/conversations"));
export const createConversation = async (title: string) => unwrap(await apiClient.POST("/v1/coach/conversations", { body: { title } }));
export const getConversation = async (id: number) => unwrap(await apiClient.GET("/v1/coach/conversations/{id}", { params: { path: { id } } }));
export async function deleteConversation(id: number) {
  const result = await apiClient.DELETE("/v1/coach/conversations/{id}", { params: { path: { id } } });
  if (!result.response.ok) throw new Error("Conversation could not be deleted. Wait for any active turn to finish.");
}
export const sendCoachMessage = async (id: number, body: TurnRequest) => unwrap(await apiClient.POST("/v1/coach/conversations/{id}/messages", { params: { path: { id } }, body }));
export const getCoachProposal = async (id: number) => unwrap(await apiClient.GET("/v1/coach/proposals/{id}", { params: { path: { id } } }));
export const listMcpTokens = async () => unwrap(await apiClient.GET("/v1/coach/mcp-tokens"));
export const createMcpToken = async (name: string, propose: boolean) => unwrap(await apiClient.POST("/v1/coach/mcp-tokens", { body: { name, scopes: propose ? ["training:read", "coach:propose"] : ["training:read"] } }));
export async function revokeMcpToken(id: number) {
  const result = await apiClient.DELETE("/v1/coach/mcp-tokens/{id}", { params: { path: { id } } });
  if (!result.response.ok) throw new Error("Token could not be revoked.");
}

export const reviewWorkout = async (id: number, request: TurnRequest) => unwrap(await apiClient.POST("/v1/coach/insights", { body: { conversation_id: id, key: request.key || "", workout_id: request.workout_id, content: request.content } }));
