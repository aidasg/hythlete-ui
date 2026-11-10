import { throwApiResponseError, formatRequestFailure, requestIdFrom } from "@/services/api/errors";
import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";
export type Conversation = components["schemas"]["ai.Conversation"];
export type TurnRequest = components["schemas"]["ai.TurnRequest"];
export type TurnResult = components["schemas"]["ai.TurnResult"] & { request_id?: string };
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throwApiResponseError(result);
  }
  return result.data;
}
export const listConversations = async () => unwrap(await apiClient.GET("/v1/coach/conversations"));
export const createConversation = async (title: string) => unwrap(await apiClient.POST("/v1/coach/conversations", { body: { title } }));
export const getConversation = async (id: number) => {
  const conversation = unwrap(await apiClient.GET("/v1/coach/conversations/{id}", { params: { path: { id } } }));
  return { ...conversation, messages: conversation.messages?.map(message => {
    if (!message.result) return message;
    const result = publicTurn(message.result);
    return { ...message, result, content: result.content };
  }) };
};
export async function deleteConversation(id: number) {
  const result = await apiClient.DELETE("/v1/coach/conversations/{id}", { params: { path: { id } } });
  if (!result.response.ok) throwApiResponseError(result);
}
export const sendCoachMessage = async (id: number, body: TurnRequest) => unwrapTurn(await apiClient.POST("/v1/coach/conversations/{id}/messages", { params: { path: { id } }, body }));
export const getCoachProposal = async (id: number) => unwrap(await apiClient.GET("/v1/coach/proposals/{id}", { params: { path: { id } } }));
export const listMcpTokens = async () => unwrap(await apiClient.GET("/v1/coach/mcp-tokens"));
export const createMcpToken = async (name: string, propose: boolean) => unwrap(await apiClient.POST("/v1/coach/mcp-tokens", { body: { name, scopes: propose ? ["training:read", "coach:propose"] : ["training:read"] } }));
export async function revokeMcpToken(id: number) {
  const result = await apiClient.DELETE("/v1/coach/mcp-tokens/{id}", { params: { path: { id } } });
  if (!result.response.ok) throwApiResponseError(result);
}

export const reviewWorkout = async (id: number, request: TurnRequest) => unwrapTurn(await apiClient.POST("/v1/coach/insights", { body: { conversation_id: id, key: request.key || "", workout_id: request.workout_id, content: request.content, context:request.context, refresh_evidence: request.refresh_evidence } }));

export function publicTurn(turn: TurnResult, response?: Response): TurnResult {
  if (turn.outcome !== "failed" && turn.outcome !== "explanation_unavailable") return turn;
  const id = requestIdFrom(undefined, {request_id:turn.failure_request_id}) || requestIdFrom(response, turn);
  return { ...turn, content: formatRequestFailure(id, turn.outcome === "explanation_unavailable" ? "Your workout draft is ready to review, but its explanation is unavailable." : undefined) };
}
function unwrapTurn(result: { data?: TurnResult; error?: unknown; response: Response }): TurnResult {
  return publicTurn(unwrap(result), result.response);
}
