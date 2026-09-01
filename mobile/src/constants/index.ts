/** Limits and names shared across screens, so none of them guesses. */

/** The server accepts five photographs per complaint. */
export const MAX_PHOTOS = 5;

/** Multer's limit, in bytes. A larger file is refused before it is analysed. */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** What the detector can find. Anything else arrives as Unclassified. */
export const DAMAGE_CLASSES = [
  "Pothole",
  "Garbage Pile",
  "Open Manhole",
  "Closed Manhole",
] as const;

export type DamageClass = (typeof DAMAGE_CLASSES)[number];

/** Departments a complaint can be routed to. */
export const CIVIC_CATEGORIES = ["ROADS", "WASTE", "WATER"] as const;

/** Statuses that mean nothing further will happen. */
export const TERMINAL_STATUSES = ["CLOSED", "REJECTED"] as const;

/** How long a search box waits before filtering. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Photograph quality asked of the picker: small enough to upload on 3G. */
export const PHOTO_QUALITY = 0.7;
