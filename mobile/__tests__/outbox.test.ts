/**
 * The offline queue.
 *
 * This is the part of the app where a bug loses somebody's report, so it is
 * tested against a real (in-memory) store rather than by asserting that
 * mocked functions were called. The submit call and the network check are the
 * only things faked, because they are the boundary.
 */

const mockStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  },
}));

const mockNet = { isConnected: true, isInternetReachable: true as boolean | null };
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => mockNet) },
}));

const mockSubmit = jest.fn();
jest.mock("../src/api", () => ({ submitReport: (...a: unknown[]) => mockSubmit(...a) }));

import { readOutbox, enqueue, removeQueued, flushOutbox, isOnline } from "../src/outbox";

const report = (title: string) => ({
  title, photoUris: ["file:///tmp/a.jpg"], lat: 12.97, lng: 77.59,
});

beforeEach(() => {
  mockStore.clear();
  mockSubmit.mockReset();
  mockNet.isConnected = true;
  mockNet.isInternetReachable = true;
});

describe("queueing", () => {
  it("starts empty", async () => {
    expect(await readOutbox()).toEqual([]);
  });

  it("keeps what was queued, in order", async () => {
    await enqueue(report("first"));
    await enqueue(report("second"));
    const out = await readOutbox();
    expect(out.map((q) => q.title)).toEqual(["first", "second"]);
  });

  it("gives every queued report its own id", async () => {
    await enqueue(report("a"));
    await enqueue(report("a"));
    const [x, y] = await readOutbox();
    expect(x.id).not.toBe(y.id);
  });

  it("records when it was queued", async () => {
    await enqueue(report("a"));
    const [q] = await readOutbox();
    expect(Date.parse(q.queuedAt)).not.toBeNaN();
  });

  it("removes only the one asked for", async () => {
    await enqueue(report("keep"));
    await enqueue(report("drop"));
    const [, drop] = await readOutbox();
    await removeQueued(drop.id);
    expect((await readOutbox()).map((q) => q.title)).toEqual(["keep"]);
  });

  it("survives a corrupted store rather than throwing", async () => {
    mockStore.set("lumen_outbox", "{not json");
    expect(await readOutbox()).toEqual([]);
  });
});

describe("connectivity", () => {
  it("is offline when the phone says it is disconnected", async () => {
    mockNet.isConnected = false;
    expect(await isOnline()).toBe(false);
  });

  it("treats an undecided reachability check as online", async () => {
    // isInternetReachable is null while NetInfo is still deciding. Queueing a
    // report that would have gone through is the worse mistake.
    mockNet.isInternetReachable = null;
    expect(await isOnline()).toBe(true);
  });
});

describe("flushing", () => {
  it("sends nothing while offline, and keeps the queue", async () => {
    await enqueue(report("a"));
    mockNet.isConnected = false;
    const r = await flushOutbox();
    expect(r.sent).toEqual([]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(await readOutbox()).toHaveLength(1);
  });

  it("sends what is queued and empties it", async () => {
    mockSubmit.mockResolvedValue({ ref: "CMP-1", duplicate: null });
    await enqueue(report("a"));
    const r = await flushOutbox();
    expect(r.sent).toEqual(["CMP-1"]);
    expect(await readOutbox()).toEqual([]);
  });

  it("passes the photos and the location through unchanged", async () => {
    mockSubmit.mockResolvedValue({ ref: "CMP-2", duplicate: null });
    await enqueue(report("a"));
    await flushOutbox();
    expect(mockSubmit).toHaveBeenCalledWith({
      title: "a", photoUris: ["file:///tmp/a.jpg"], lat: 12.97, lng: 77.59,
    });
  });

  it("keeps a report the server could not take right now, and records why", async () => {
    mockSubmit.mockRejectedValue({ status: 503, message: "AI service unavailable" });
    await enqueue(report("a"));
    const r = await flushOutbox();
    expect(r.failed).toBe(1);
    const [q] = await readOutbox();
    expect(q.lastError).toBe("AI service unavailable");
  });

  it("drops a report the server will never accept", async () => {
    // A 422 means the photograph is not of a civic scene. Retrying it every
    // time the app opens would keep it in the queue forever.
    mockSubmit.mockRejectedValue({ status: 422, message: "Not a road" });
    await enqueue(report("a"));
    await flushOutbox();
    expect(await readOutbox()).toEqual([]);
  });

  it("keeps a report rejected for an expired session", async () => {
    // 401 is a 4xx but it is the one that comes back after signing in again.
    mockSubmit.mockRejectedValue({ status: 401, message: "Not authenticated." });
    await enqueue(report("a"));
    await flushOutbox();
    expect(await readOutbox()).toHaveLength(1);
  });

  it("sends the rest when one of them fails", async () => {
    mockSubmit
      .mockRejectedValueOnce({ status: 503, message: "down" })
      .mockResolvedValueOnce({ ref: "CMP-3", duplicate: null });
    await enqueue(report("bad"));
    await enqueue(report("good"));
    const r = await flushOutbox();
    expect(r.sent).toEqual(["CMP-3"]);
    expect(r.failed).toBe(1);
    expect((await readOutbox()).map((q) => q.title)).toEqual(["bad"]);
  });
});
