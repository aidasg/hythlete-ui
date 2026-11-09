import { describe, expect, it, vi } from "vitest";
import createClient from "openapi-fetch";
import type { paths } from "./generated/schema";
import { requestErrorMiddleware } from "./client";
import { apiResponseError, ApiResponseError, formatRequestFailure, getApiErrorMessage } from "./errors";

function clientFor(fetch: typeof globalThis.fetch) {
  const client = createClient<paths>({ baseUrl: "https://api.example", fetch });
  client.use(requestErrorMiddleware);
  return client;
}
function response(status: number, id?: string, body: unknown = {error:"private database detail"}) {
  return new Response(JSON.stringify(body), { status, headers: {"Content-Type":"application/json", ...(id ? {"X-REQUEST-ID":id} : {})} });
}
describe("request failure reporting", () => {
  it("hides unexpected server details and retains correlation metadata", async () => {
    const result = await clientFor(vi.fn().mockResolvedValue(response(500,"server-123"))).GET("/v1/profile");
    const error = apiResponseError(result);
    expect(error).toMatchObject({status:500,requestId:"server-123",message:"Request failed. Request ID: server-123"});
    expect(JSON.stringify(result.error)).not.toContain("private");
  });
  it("shows public client errors, with the header taking precedence over the body", async () => {
    const result = await clientFor(vi.fn().mockResolvedValue(response(403,"header-123",{error:"Choose Pro to continue.",code:"plan_required",request_id:"body-123"}))).GET("/v1/profile");
    expect(apiResponseError(result)).toMatchObject({status:403,code:"plan_required",requestId:"header-123",message:"Request failed. Choose Pro to continue. Request ID: header-123"});
    expect(getApiErrorMessage(result.error)).toBe(apiResponseError(result).message);
  });
  it("uses body IDs when response headers are unavailable", async () => {
    const result = await clientFor(vi.fn().mockResolvedValue(response(409,undefined,{error:"Refresh and retry.",request_id:"body-123"}))).GET("/v1/profile");
    expect(apiResponseError(result).requestId).toBe("body-123");
  });
  it("handles network failures, missing IDs, and non-JSON proxy responses safely", async () => {
    await expect(clientFor(vi.fn().mockRejectedValue(new Error("secret internal URL"))).GET("/v1/profile")).rejects.toMatchObject({status:0,message:"Request failed. Request ID unavailable."});
    const result = await clientFor(vi.fn().mockResolvedValue(new Response("<html>private proxy diagnostics</html>",{status:502}))).GET("/v1/profile");
    expect(getApiErrorMessage(result.error)).toBe("Request failed. Request ID unavailable.");
    expect(formatRequestFailure(undefined,"raw detail")).toBe("Request failed. Request ID unavailable.");
  });
  it("preserves successful empty responses", async () => {
    const result = await clientFor(vi.fn().mockResolvedValue(new Response(null,{status:204,headers:{"Content-Type":"application/json"}}))).POST("/v1/auth/logout");
    expect(result.response.status).toBe(204);
    expect(result.error).toBeUndefined();
  });
  it("does not turn intentional cancellation into a request error", async () => {
    const abort = new DOMException("aborted", "AbortError");
    await expect(clientFor(vi.fn().mockRejectedValue(abort)).GET("/v1/profile")).rejects.toBe(abort);
  });
  it("keeps independent IDs for concurrent attempts and retries", async () => {
    let finishFirst!: (r: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirst=resolve; }))
      .mockResolvedValueOnce(response(500,"second-123")).mockResolvedValueOnce(response(500,"retry-123"));
    const client = clientFor(fetch);
    const first = client.GET("/v1/profile");
    const second = await client.GET("/v1/profile");
    finishFirst(response(500,"first-123"));
    expect(apiResponseError(await first).requestId).toBe("first-123");
    expect(apiResponseError(second).requestId).toBe("second-123");
    expect(apiResponseError(await client.GET("/v1/profile")).requestId).toBe("retry-123");
  });
  it("masks invalid JSON in a successful response and retains its ID", async () => {
    await expect(clientFor(vi.fn().mockResolvedValue(new Response("invalid JSON",{headers:{"Content-Type":"application/json","X-REQUEST-ID":"parse-123"}}))).GET("/v1/profile"))
      .rejects.toMatchObject({message:"Request failed. Request ID: parse-123"});
  });
  it("never renders an arbitrary caught exception or unknown error payload", () => {
    expect(getApiErrorMessage(new Error("secret"))).not.toContain("secret");
    expect(getApiErrorMessage({error:"secret"})).not.toContain("secret");
    expect(getApiErrorMessage(new ApiResponseError(500,"secret",undefined,"abc"))).toBe("Request failed. Request ID: abc");
  });
});
