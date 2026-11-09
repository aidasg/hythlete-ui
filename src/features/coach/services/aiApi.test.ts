import { beforeEach, expect, it, vi } from "vitest";
import { getConversation, sendCoachMessage } from "./aiApi";
const client = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock("@/services/api/client", () => ({ apiClient: client }));
beforeEach(() => vi.clearAllMocks());
const response = () => new Response(null, {headers:{"X-REQUEST-ID":"current-123"}});
it("shows the original failed execution ID on a returned or replayed turn", async () => {
  client.POST.mockResolvedValue({data:{outcome:"failed",content:"private diagnostic",failure_request_id:"original-123",request_id:"current-123"},response:response()});
  const result = await sendCoachMessage(1, {content:"Hello",key:"request-123"});
  expect(result.content).toBe("Request failed. Request ID: original-123");
});
it("keeps failed-turn correlation visible after reloading conversation history", async () => {
  client.GET.mockResolvedValue({data:{id:1,messages:[{id:1,role:"user",content:"Hello"},{id:2,role:"assistant",content:"Try again",result:{outcome:"failed",failure_request_id:"original-123"}}]},response:response()});
  const conversation = await getConversation(1);
  expect(conversation.messages![0]!.content).toBe("Hello");
  expect(conversation.messages![1]!.content).toBe("Request failed. Request ID: original-123");
});
it("does not assign the history read's request ID to an older uncorrelated failure", async () => {
  client.GET.mockResolvedValue({data:{id:1,messages:[{role:"assistant",content:"Try again",result:{outcome:"failed"}}]},response:response()});
  expect((await getConversation(1)).messages![0]!.content).toBe("Request failed. Request ID unavailable.");
});
