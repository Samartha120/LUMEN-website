import { Feather } from "@expo/vector-icons";
import { C } from "./theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

/**
 * Names from other icon sets, mapped onto the one we actually ship.
 *
 * Screens were written against Ionicons naming ("checkmark-circle",
 * "chatbubble-outline", "close") while the app draws Feather. Rather than
 * rewrite every call site — and risk missing one, which renders a blank box at
 * runtime rather than failing the build — the aliases are resolved here.
 *
 * Feather has no filled variants, so the `-outline` suffix is dropped: the
 * distinction does not exist in this set and pretending otherwise would need a
 * second icon font for no visible gain.
 */
const ALIASES: Record<string, FeatherName> = {
  // actions
  "add": "plus",
  "add-circle": "plus-circle",
  "close": "x",
  "close-circle": "x-circle",
  "checkmark": "check",
  "checkmark-circle": "check-circle",
  "checkmark-done": "check-square",
  "reload": "refresh-cw",
  "sync": "refresh-cw",
  "open": "external-link",
  "options": "sliders",
  "share-social": "share-2",
  "stop": "square",
  "scan": "maximize",
  "qr-code": "grid",

  // people and places
  "person": "user",
  "people": "users",
  "location": "map-pin",
  "pin": "map-pin",
  "navigate": "navigation",
  "business": "home",
  "podium": "bar-chart-2",

  // communication
  "call": "phone",
  "chatbubble": "message-circle",
  "chatbubbles": "message-square",
  "mail-open": "mail",
  "document-text": "file-text",

  // status and weather
  "warning": "alert-triangle",
  "alert-circle": "alert-circle",
  "flame": "thermometer",
  "sparkles": "star",
  "shield-checkmark": "shield",
  "construct": "tool",
  "cube": "box",
  "time": "clock",
  "calendar": "calendar",
  "star": "star",
  "sunny": "sun",
  "rainy": "cloud-rain",
  "water": "droplet",

  // arrows
  "arrow-forward": "arrow-right",
  "arrow-back": "arrow-left",
  "arrow-up-circle": "arrow-up-circle",
};

/** Anything a screen might pass: a Feather name, or an alias for one. */
export type IconName = FeatherName | keyof typeof ALIASES | (string & {});

/** Feather has no filled/outline split, so "-outline" is dropped before lookup. */
function resolve(name: string): FeatherName {
  const bare = name.replace(/-outline$/, "");
  return (ALIASES[bare] ?? (bare as FeatherName));
}

/**
 * Every icon in the app comes through here.
 *
 * Emoji were doing this job and they are the fastest way to make an interface
 * look unfinished: they render differently on every platform, they carry their
 * own colour, and they cannot be sized against the type scale. Feather is a
 * single-weight line set, which reads as deliberate next to the typography.
 */
export function Icon({ name, size = 20, color = C.body }: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={resolve(String(name))} size={size} color={color} />;
}
