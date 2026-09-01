import { useEffect, useState } from "react";

/**
 * A value that lags behind, so a search box does not fire on every keystroke.
 *
 * Returned rather than a callback, because the caller usually wants the value
 * in a `useMemo` filter and not a function to call.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return settled;
}
