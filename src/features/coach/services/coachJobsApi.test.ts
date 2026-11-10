import { beforeEach, expect, it, vi } from "vitest";
import { followCoachJob } from "./coachJobsApi";

const client = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock("@/services/api/client", () => ({ apiClient: client }));

beforeEach(() => vi.resetAllMocks());

function stream(chunks: string[]) {
  const encoder = new TextEncoder();
  const data = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { data, response: new Response(null, { headers: { "Content-Type": "text/event-stream" } }) };
}

it("resumes from the last event ID and emits each progress event once", async () => {
  client.GET
    .mockResolvedValueOnce(stream([
      ": heartbeat\r\n\r\nid: 1-0\r\nevent: progress\r\ndata: {\"stage\":\"queued\",",
      "\"at\":\"2026-11-10T10:00:00Z\"}\r\n\r\n",
    ]))
    .mockResolvedValueOnce({ data: { id: "job", status: "running" }, response: new Response() })
    .mockResolvedValueOnce(stream([
      "id: 1-0\nevent: progress\ndata: {\"stage\":\"queued\"}\n\n",
      "id: 2-0\nevent: progress\ndata: {\"stage\":\"model\"}\n\n",
      "id: 3-0\nevent: terminal\ndata: {\"id\":\"job\",\"status\":\"completed\",\"proposal_id\":42}\n\n",
    ]));
  const progress = vi.fn();
  const job = await followCoachJob("job", "", new AbortController().signal, progress);
  expect(job).toMatchObject({ proposal_id: 42 });
  expect(progress.mock.calls.map(([event]) => event.id)).toEqual(["1-0", "2-0"]);
  expect(client.GET.mock.calls[2]?.[1].params.header).toEqual({ "Last-Event-ID": "1-0" });
});

it("recovers a committed result through status when the stream is unavailable", async () => {
  client.GET
    .mockResolvedValueOnce({ response: new Response(null, { status: 503 }) })
    .mockResolvedValueOnce({ data: { id: "job", status: "completed", turn: { content: "Saved answer" } }, response: new Response() });
  expect(await followCoachJob("job", "", new AbortController().signal, vi.fn()))
    .toMatchObject({ turn: { content: "Saved answer" } });
});

it("replays answer snapshots and resets on the shared progress cursor", async () => {
  client.GET
    .mockResolvedValueOnce(stream([
      "id: 1-0\nevent: progress\ndata: {\"stage\":\"model\"}\n\n",
      "id: 2-0\nevent: answer\ndata: {\"text\":\"A provisional answer \"}\n\n",
    ]))
    .mockResolvedValueOnce({ data: { id: "job", status: "running" }, response: new Response() })
    .mockResolvedValueOnce(stream([
      "id: 1-0\nevent: progress\ndata: {\"stage\":\"model\"}\n\n",
      "id: 2-0\nevent: answer\ndata: {\"text\":\"A provisional answer \"}\n\n",
      "id: 3-0\nevent: answer\ndata: {\"text\":\"\"}\n\n",
      "id: 4-0\nevent: progress\ndata: {\"stage\":\"run_tool\"}\n\n",
      "id: 5-0\nevent: answer\ndata: {\"text\":\"New answer \"}\n\n",
      "id: 6-0\nevent: terminal\ndata: {\"id\":\"job\",\"status\":\"completed\",\"turn\":{\"job_id\":\"job\",\"content\":\"Saved answer\"}}\n\n",
    ]));
  const receive = vi.fn();
  const result = await followCoachJob("job", "", new AbortController().signal, receive);
  expect(result.turn).toMatchObject({ job_id: "job", content: "Saved answer" });
  expect(receive.mock.calls.map(([event]) => event.text ?? event.stage))
    .toEqual(["model", "A provisional answer ", "", "run_tool", "New answer "]);
  expect(client.GET.mock.calls[2]?.[1].params.header).toEqual({ "Last-Event-ID": "2-0" });
});
