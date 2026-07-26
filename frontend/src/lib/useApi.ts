import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Minimal data-fetching hook: loads `path` on mount, exposes reload(). */
export function useApi<T = unknown>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api.get(path)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}
