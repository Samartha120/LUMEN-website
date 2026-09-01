import { TRANSITIONS, isStaff, STAFF_ROLES } from "../src/api";

/**
 * The workflow the staff screens draw buttons from.
 *
 * This copy exists only to decide which buttons to show; the server checks
 * again and is the authority. These tests guard the properties that would
 * quietly break the screen if the copy drifted — a dead end nobody can leave,
 * a move offered to a role that cannot make it, a status with no way forward.
 */
describe("the state machine", () => {
  const statuses = Object.keys(TRANSITIONS);

  it("covers every status the backend can be in", () => {
    expect(statuses.sort()).toEqual([
      "ASSIGNED", "CLOSED", "IN_PROGRESS", "PENDING_REVIEW", "REJECTED", "SUBMITTED",
    ]);
  });

  it("only ever moves to a status it also knows about", () => {
    for (const [from, moves] of Object.entries(TRANSITIONS)) {
      for (const m of moves) {
        expect(statuses).toContain(m.to);
      }
    }
  });

  it("never offers a move back to where you already are", () => {
    for (const [from, moves] of Object.entries(TRANSITIONS)) {
      expect(moves.map((m) => m.to)).not.toContain(from);
    }
  });

  it("gives every move a label a person can read", () => {
    for (const moves of Object.values(TRANSITIONS)) {
      for (const m of moves) {
        expect(m.label.length).toBeGreaterThan(3);
        expect(m.label).not.toMatch(/_/); // not a raw status name
      }
    }
  });

  it("gives every move at least one role that can make it", () => {
    for (const moves of Object.values(TRANSITIONS)) {
      for (const m of moves) {
        expect(m.roles.length).toBeGreaterThan(0);
      }
    }
  });

  it("only names roles that exist", () => {
    for (const moves of Object.values(TRANSITIONS)) {
      for (const m of moves) {
        for (const r of m.roles) expect(STAFF_ROLES).toContain(r);
      }
    }
  });

  it("ends at closed and rejected, and nowhere else", () => {
    const dead = statuses.filter((s) => TRANSITIONS[s].length === 0);
    expect(dead.sort()).toEqual(["CLOSED", "REJECTED"]);
  });

  it("lets a report reach a finished state from every live one", () => {
    // Breadth-first from each status: a complaint that can never be closed is
    // a complaint that sits in the queue forever.
    for (const start of statuses) {
      const seen = new Set([start]);
      const queue = [start];
      let finished = false;
      while (queue.length) {
        const at = queue.shift()!;
        if (TRANSITIONS[at].length === 0) { finished = true; break; }
        for (const m of TRANSITIONS[at]) {
          if (!seen.has(m.to)) { seen.add(m.to); queue.push(m.to); }
        }
      }
      expect(finished).toBe(true);
    }
  });

  it("never lets an engineer close or reject a complaint", () => {
    // Approval is a supervisor's job. If this ever passes, the phone would be
    // offering an engineer a button the server will refuse.
    for (const moves of Object.values(TRANSITIONS)) {
      for (const m of moves) {
        if (["CLOSED", "REJECTED"].includes(m.to)) {
          expect(m.roles).not.toContain("ENGINEER");
        }
      }
    }
  });

  it("lets a supervisor act at every stage that has an action", () => {
    for (const moves of Object.values(TRANSITIONS)) {
      if (moves.length === 0) continue;
      expect(moves.some((m) => m.roles.includes("SUPERVISOR"))).toBe(true);
    }
  });
});

describe("isStaff", () => {
  it("recognises the three staff roles", () => {
    expect(isStaff("SUPERVISOR")).toBe(true);
    expect(isStaff("ADMINISTRATOR")).toBe(true);
    expect(isStaff("ENGINEER")).toBe(true);
  });

  it("does not let a citizen through", () => {
    expect(isStaff("CITIZEN")).toBe(false);
  });

  it("is case-insensitive and safe on nothing", () => {
    expect(isStaff("supervisor")).toBe(true);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff("")).toBe(false);
  });
});
