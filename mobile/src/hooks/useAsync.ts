import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** True only for the first load, so a refresh does not blank the screen. */
  initial: boolean;
  reload: () => Promise<void>;
}

/**
 * Load something, keep what it returned, and say whether it failed.
 *
 * Every screen was writing the same four pieces of state and the same
 * try/catch. The one detail worth having in one place is the guard against
 * setting state after the screen has gone: a slow request that lands on an
 * unmounted screen is a warning in development and a leak in production.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fn();
      if (!alive.current) return;
      setData(out);
      setError(null);
    } catch (e: unknown) {
      if (!alive.current) return;
      const message = (e as { message?: string })?.message ?? "Something went wrong.";
      setError(message);
    } finally {
      if (alive.current) { setLoading(false); setInitial(false); }
    }
    // fn is recreated on every render by design; deps is what the caller means.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, error, loading, initial, reload: run };
}
