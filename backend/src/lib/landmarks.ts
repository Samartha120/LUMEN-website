/**
 * The civic landmarks that raise a complaint's priority.
 *
 * One definition, read by both `priority.ts` (which scores against it) and the
 * GIS map (which draws it). The map previously kept a hand-copied list, so the
 * two could disagree the first time either was edited.
 *
 * These are real places, taken from OpenStreetMap within the area the
 * complaints actually fall in, not invented coordinates. That matters: an
 * earlier attempt used well-known Bengaluru landmarks chosen by name, and 21 of
 * 22 ended up with no complaint inside their radius at all, which would have
 * made the whole location-risk factor inert.
 *
 * Ten was chosen over the full 1,694 amenities in the area deliberately — the
 * point is to explain a priority score on a map a person can read, not to plot
 * every school in the city. These ten are the set that covers the most
 * complaints: half of all open complaints fall within one.
 *
 * A municipal deployment would replace this with the corporation's own facility
 * registry. The scoring contract is just `name`, `risk` and `radiusM`.
 *
 * `risk` is the priority points a complaint inside the radius gains, and
 * reflects how badly civic damage there affects people. Radii differ by kind:
 * a hospital's approach corridor is wider than a school gate's.
 */
export type LandmarkType = "HOSPITAL" | "SCHOOL" | "TRANSPORT" | "MARKET";

export type Landmark = {
  name: string;
  type: LandmarkType;
  lat: number;
  lng: number;
  /** Priority points a complaint within radiusM gains. Capped at 18 in total. */
  risk: number;
  radiusM: number;
};

export const LANDMARKS: Landmark[] = [
  // Hospital +12 — ambulance access, and the people nearby are already unwell.
  { name: "Vydehi Superspeciality Hospital", type: "HOSPITAL", lat: 12.96816, lng: 77.59504, risk: 12, radiusM: 750 },
  { name: "Vasan Eye Care Hospital, Koramangala", type: "HOSPITAL", lat: 12.94024, lng: 77.62534, risk: 12, radiusM: 750 },
  { name: "Ayurvaid Hospital", type: "HOSPITAL", lat: 12.95527, lng: 77.64285, risk: 12, radiusM: 750 },

  // Transport +10 — interchanges concentrate pedestrians at all hours.
  { name: "Banaswadi", type: "TRANSPORT", lat: 13.00584, lng: 77.62813, risk: 10, radiusM: 750 },
  { name: "Sir M. Visvesvaraya Stn., Central College", type: "TRANSPORT", lat: 12.97452, lng: 77.58422, risk: 10, radiusM: 750 },
  { name: "Channasandra", type: "TRANSPORT", lat: 13.01186, lng: 77.66281, risk: 10, radiusM: 750 },

  // School +9 — children, and a predictable twice-daily crowd.
  { name: "St Ann's School", type: "SCHOOL", lat: 12.98001, lng: 77.55661, risk: 9, radiusM: 600 },
  { name: "Indian High School", type: "SCHOOL", lat: 12.99381, lng: 77.54587, risk: 9, radiusM: 600 },
  { name: "GHPS Dairy Colony", type: "SCHOOL", lat: 12.93869, lng: 77.60723, risk: 9, radiusM: 600 },

  // Market +7 — dense foot traffic mixed with delivery vehicles.
  { name: "Homemart", type: "MARKET", lat: 12.93073, lng: 77.5472, risk: 7, radiusM: 600 },
];
