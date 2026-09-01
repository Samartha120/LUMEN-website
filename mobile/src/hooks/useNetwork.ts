import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Whether the phone currently has a usable connection.
 *
 * Subscribed rather than polled, so a banner disappears the moment the signal
 * comes back rather than at the next tick. Undecided reachability counts as
 * online: telling someone they are offline when they are not is worse than the
 * request failing.
 */
export function useNetwork(): { online: boolean; type: string | null } {
  const [online, setOnline] = useState(true);
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    const stop = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
      setType(state.type ?? null);
    });
    return () => stop();
  }, []);

  return { online, type };
}
