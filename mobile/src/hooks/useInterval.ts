import { useEffect, useRef } from "react";

/**
 * Run something on a timer without restarting the timer on every render.
 *
 * The callback is held in a ref so the interval is created once. Passing the
 * function to useEffect directly would tear down and recreate the timer each
 * time the component renders, which for a one-second tick means it effectively
 * never fires.
 */
export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);

  useEffect(() => { saved.current = callback; }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
