import { Feather } from "@expo/vector-icons";
import { C } from "./theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

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
  return <Feather name={name} size={size} color={color} />;
}
