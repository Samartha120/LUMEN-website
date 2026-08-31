import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { submitReport } from "./api";

/**
 * Reports written down while offline, sent when the network comes back.
 *
 * Civic damage is often in exactly the places with no signal — an underpass, a
 * basement car park, the far end of a ward. Losing a report because the phone
 * could not reach the server at that moment is the worst possible failure for
 * this app: the person is standing in front of the hazard, and they will not
 * walk back.
 *
 * The queue holds the local photo URIs rather than the image bytes. That keeps
 * AsyncStorage small, and the files stay in the app's cache directory until
 * the report goes out. It also means a queued report will not survive the OS
 * clearing that cache, which is the honest trade for not writing megabytes of
 * base64 into a key-value store.
 */

const KEY = "lumen_outbox";

export type Queued = {
  id: string;
  title: string;
  photoUris: string[];
  lat: number | null;
  lng: number | null;
  queuedAt: string;
  lastError?: string | null;
};

export async function readOutbox(): Promise<Queued[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queued[]) : [];
  } catch {
    return [];
  }
}

async function writeOutbox(items: Queued[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: Omit<Queued, "id" | "queuedAt">) {
  const items = await readOutbox();
  items.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  });
  await writeOutbox(items);
  return items.length;
}

export async function removeQueued(id: string) {
  await writeOutbox((await readOutbox()).filter((q) => q.id !== id));
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    // isInternetReachable is null while it is still deciding; treat that as
    // online and let the request itself fail, rather than queueing a report
    // that would have gone through.
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/**
 * Try to send everything queued. Returns what happened, so the caller can tell
 * the user rather than silently succeeding.
 *
 * A report that fails is kept and its error recorded — except when the server
 * rejects it outright (4xx), which will not improve on a retry and would
 * otherwise sit in the queue forever.
 */
export async function flushOutbox(): Promise<{ sent: string[]; failed: number }> {
  if (!(await isOnline())) return { sent: [], failed: 0 };
  const items = await readOutbox();
  const sent: string[] = [];
  let failed = 0;

  for (const item of items) {
    try {
      const out = await submitReport({
        title: item.title,
        photoUris: item.photoUris,
        lat: item.lat,
        lng: item.lng,
      });
      await removeQueued(item.id);
      sent.push(out.ref);
    } catch (e: any) {
      const status = e?.status ?? 0;
      if (status >= 400 && status < 500 && status !== 401) {
        // The server will say the same thing next time — a photo it will not
        // accept, or a missing title. Dropping it beats retrying forever.
        await removeQueued(item.id);
      } else {
        const rest = await readOutbox();
        await writeOutbox(
          rest.map((q) => (q.id === item.id ? { ...q, lastError: e?.message ?? "Send failed" } : q)),
        );
      }
      failed += 1;
    }
  }
  return { sent, failed };
}
