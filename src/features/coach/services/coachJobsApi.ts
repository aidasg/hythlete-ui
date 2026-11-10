import { apiClient } from "@/services/api/client";
import { ApiResponseError, throwApiResponseError } from "@/services/api/errors";
import type { components } from "@/services/api/types";
import { publicTurn } from "./aiApi";

export type CoachJob = components["schemas"]["ai.Job"];
export type CoachJobStart = components["schemas"]["ai.JobStartRequest"];
export type CoachProgress = { id: string; stage: string; tool?: string; week?: number; at: string };
export type CoachAnswer = { id: string; text: string; at: string };
export type CoachJobEvent = CoachProgress | CoachAnswer;

function normalizeJob(job: CoachJob, response?: Response): CoachJob {
  return job.turn ? { ...job, turn: publicTurn(job.turn, response) } : job;
}

export async function startCoachJob(body: CoachJobStart, signal: AbortSignal): Promise<CoachJob> {
  const result = await apiClient.POST("/v1/coach/jobs", { body, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
  if (!result.data) throwApiResponseError(result);
  return normalizeJob(result.data, result.response);
}

export async function stopCoachJob(id: string, signal: AbortSignal): Promise<CoachJob> {
  const result = await apiClient.POST("/v1/coach/jobs/{job_id}/stop", {
    params: { path: { job_id: id } }, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!result.data) throwApiResponseError(result);
  return normalizeJob(result.data, result.response);
}

async function getCoachJob(id: string, signal: AbortSignal): Promise<CoachJob> {
  const result = await apiClient.GET("/v1/coach/jobs/{job_id}", { params: { path: { job_id: id } }, signal });
  if (!result.data) throwApiResponseError(result);
  return normalizeJob(result.data, result.response);
}

async function readEvents(id: string, cursor: string, signal: AbortSignal, onEvent: (event: CoachJobEvent) => void): Promise<CoachJob | undefined> {
  const result = await apiClient.GET("/v1/coach/jobs/{job_id}/events", {
    params: { path: { job_id: id }, header: cursor ? { "Last-Event-ID": cursor } : {} },
    headers: { Accept: "text/event-stream" },
    parseAs: "stream",
    signal,
  });
  if (!result.response.ok || !result.data) throwApiResponseError(result);
  if (!result.response.headers.get("Content-Type")?.includes("text/event-stream")) {
    throw new ApiResponseError(result.response.status);
  }
  const reader = result.data.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      pending += decoder.decode(value, { stream: true });
      // The API emits LF frames. Normalize CRLF as well for intervening proxies.
      pending = pending.replace(/\r\n/g, "\n");
      let boundary = pending.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = pending.slice(0, boundary).split("\n");
        pending = pending.slice(boundary + 2);
        boundary = pending.indexOf("\n\n");
        const kind = frame.find(line => line.startsWith("event:"))?.slice(6).trim();
        const eventID = frame.find(line => line.startsWith("id:"))?.slice(3).trim();
        const data = frame.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (kind === "terminal" && data) return normalizeJob(JSON.parse(data) as CoachJob);
        if (eventID && data && (kind === "progress" || kind === "answer")) {
          onEvent({ ...JSON.parse(data) as Omit<CoachProgress, "id"> | Omit<CoachAnswer, "id">, id: eventID });
        }
      }
      if (pending.length > 1_048_576) throw new Error("Coach progress frame exceeded the size limit.");
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function permanent(error: unknown) {
  return error instanceof ApiResponseError && error.status >= 400 && error.status < 500 && error.status !== 429;
}

function isNewEvent(id: string, cursor: string) {
  if (!/^\d+-\d+$/.test(id)) return false;
  if (!cursor) return true;
  const [time, sequence] = id.split("-").map(BigInt);
  const [lastTime, lastSequence] = cursor.split("-").map(BigInt);
  return time! > lastTime! || (time === lastTime && sequence! > lastSequence!);
}

export async function followCoachJob(id: string, cursor: string, signal: AbortSignal, onEvent: (event: CoachJobEvent) => void): Promise<CoachJob> {
  let failures = 0;
  let seenJob = Boolean(cursor);
  const admissionGrace = Date.now() + 5_500;
  function shouldStop(error: unknown) {
    // A reload can race the original POST before its receipt is committed.
    if (!seenJob && error instanceof ApiResponseError && error.status === 404 && Date.now() < admissionGrace) return false;
    return permanent(error);
  }
  while (!signal.aborted) {
    try {
      const job = await readEvents(id, cursor, AbortSignal.any([signal, AbortSignal.timeout(60_000)]), event => {
        if (!isNewEvent(event.id, cursor)) return;
        cursor = event.id;
        seenJob = true;
        failures = 0;
        onEvent(event);
      });
      if (job) return job;
    } catch (error) {
      if (signal.aborted || shouldStop(error)) throw error;
    }
    try {
      const job = await getCoachJob(id, AbortSignal.any([signal, AbortSignal.timeout(5_000)]));
      if (job.status !== "running") return job;
      seenJob = true;
      failures = 0;
    } catch (error) {
      if (signal.aborted || shouldStop(error) || ++failures >= 8) throw error;
    }
    await pause(Math.min(4_000, 400 * (failures + 1)), signal);
  }
  throw signal.reason;
}
