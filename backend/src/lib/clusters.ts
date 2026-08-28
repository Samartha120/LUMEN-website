import { haversineMeters } from "./geo.js";

/**
 * Group nearby complaints of the same kind into single work orders.
 *
 * Twelve potholes along one 200 m stretch are twelve dispatches today: twelve
 * journeys, twelve setups, twelve closures, for one afternoon of actual work.
 * A crew sent to that street should fix all of them in one visit.
 *
 * The grouping is single-linkage — a complaint joins a cluster if it is within
 * RADIUS_M of ANY member, not of the cluster's centre. That matters because
 * road damage follows the road: a chain of potholes down a street is one job
 * even when its ends are 400 m apart, whereas a centre-based rule would split
 * it arbitrarily in the middle.
 *
 * Clusters never cross departments. Potholes and a burst pipe on the same
 * corner are two crews with different equipment, and merging them would send
 * one of them to a job it cannot do.
 */

export const RADIUS_M = Number(process.env.CLUSTER_RADIUS_M ?? 150);
const MIN_MEMBERS = 2;

export type Clusterable = {
  id: string;
  ref: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  civicCategory: string | null;
  status: string;
  severityScore: number | null;
  priorityScore: number | null;
  slaHours: number;
  createdAt: Date;
  zone: string;
  address: string;
};

export type Cluster = {
  key: string;
  category: string;
  civicCategory: string | null;
  zone: string;
  members: Clusterable[];
  /** Centre of the group, for placing one marker on the map. */
  lat: number;
  lng: number;
  /** Longest distance between any two members — how far the crew must walk. */
  spreadM: number;
  /** The cluster inherits the worst of what it contains: a group is as urgent
   *  as its most urgent member, not the average, because averaging would let a
   *  critical pothole hide among minor ones. */
  worstPriorityScore: number;
  worstSeverity: number;
  /** The tightest deadline in the group. */
  dueHours: number;
  /** Visits saved by sending one crew instead of one per complaint. */
  visitsSaved: number;
};

/** Single-linkage grouping within one category. */
function link(items: Clusterable[]): Clusterable[][] {
  const groups: Clusterable[][] = [];
  const unassigned = [...items];

  while (unassigned.length) {
    const seed = unassigned.shift()!;
    const group = [seed];
    // Keep sweeping: adding a member extends the group's reach, so a chain
    // along a street is followed to its end rather than cut at the first pass.
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = unassigned.length - 1; i >= 0; i--) {
        const cand = unassigned[i];
        const near = group.some(
          (m) => haversineMeters(m.lat, m.lng, cand.lat, cand.lng) <= RADIUS_M,
        );
        if (near) {
          group.push(cand);
          unassigned.splice(i, 1);
          grew = true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export function buildClusters(items: Clusterable[]): Cluster[] {
  // Split by what a single crew can actually do in one visit.
  const byKind = new Map<string, Clusterable[]>();
  for (const c of items) {
    const k = `${c.civicCategory ?? "NONE"}::${c.category}`;
    (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(c);
  }

  const out: Cluster[] = [];
  for (const [kind, group] of byKind) {
    for (const members of link(group)) {
      if (members.length < MIN_MEMBERS) continue;

      let spread = 0;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          spread = Math.max(spread, haversineMeters(members[i].lat, members[i].lng, members[j].lat, members[j].lng));

      const now = Date.now();
      const dueHours = Math.min(
        ...members.map((m) => m.slaHours - (now - new Date(m.createdAt).getTime()) / 3_600_000),
      );

      out.push({
        key: `${kind}::${members[0].id}`,
        category: members[0].category,
        civicCategory: members[0].civicCategory,
        zone: members[0].zone,
        members: [...members].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)),
        lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
        lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
        spreadM: Math.round(spread),
        worstPriorityScore: Math.max(...members.map((m) => m.priorityScore ?? 0)),
        worstSeverity: Math.max(...members.map((m) => m.severityScore ?? 0)),
        dueHours: Math.round(dueHours),
        visitsSaved: members.length - 1,
      });
    }
  }

  // Most urgent first, then largest — a supervisor reads this top-down.
  return out.sort(
    (a, b) => b.worstPriorityScore - a.worstPriorityScore || b.members.length - a.members.length,
  );
}
