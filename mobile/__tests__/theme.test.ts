import { stageOf, tone, statusLabel, ago, STAGES } from "../src/theme";

/**
 * The rules that decide what a citizen sees about their own report.
 *
 * These are pure functions on purpose: the mapping from a workflow status to
 * "where has my report got to" is the kind of thing that quietly rots when
 * someone adds a status to the backend, and a test is cheaper than noticing it
 * in a screenshot.
 */
describe("stageOf", () => {
  it("puts a new report at the first stage", () => {
    expect(stageOf("SUBMITTED")).toBe(0);
  });

  it("treats every in-flight status as in progress", () => {
    for (const s of ["ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"]) {
      expect(stageOf(s)).toBe(1);
    }
  });

  it("treats closed, resolved and rejected as finished", () => {
    // Rejected is finished from the reporter's point of view: nothing more
    // will happen to it, and showing it as in progress would be a lie.
    for (const s of ["RESOLVED", "CLOSED", "REJECTED"]) {
      expect(stageOf(s)).toBe(2);
    }
  });

  it("falls back to the first stage for anything unrecognised", () => {
    expect(stageOf(undefined)).toBe(0);
    expect(stageOf(null)).toBe(0);
    expect(stageOf("SOMETHING_NEW")).toBe(0);
  });

  it("never returns an index outside the labels it is used with", () => {
    for (const s of ["SUBMITTED", "ASSIGNED", "CLOSED", "?", ""]) {
      const i = stageOf(s);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(STAGES.length);
    }
  });
});

describe("tone", () => {
  it("gives high and critical the same alarming pair", () => {
    expect(tone("HIGH")).toEqual(tone("CRITICAL"));
  });

  it("is case-insensitive, because the API is not consistent", () => {
    expect(tone("high")).toEqual(tone("HIGH"));
  });

  it("always returns a foreground and a background", () => {
    for (const p of ["HIGH", "MEDIUM", "LOW", undefined, null, ""]) {
      const t = tone(p);
      expect(t.fg).toMatch(/^#/);
      expect(t.bg).toMatch(/^#/);
    }
  });

  it("does not use the same colour for foreground and background", () => {
    // The chip draws text in fg on a fill of bg; equal values would be invisible.
    for (const p of ["HIGH", "MEDIUM", "LOW"]) {
      expect(tone(p).fg).not.toBe(tone(p).bg);
    }
  });
});

describe("statusLabel", () => {
  it("turns a database status into something readable", () => {
    expect(statusLabel("IN_PROGRESS")).toBe("In Progress");
    expect(statusLabel("PENDING_REVIEW")).toBe("Pending Review");
  });

  it("handles a missing status without throwing", () => {
    expect(statusLabel(undefined)).toBe("—");
    expect(statusLabel(null)).toBe("—");
  });
});

describe("ago", () => {
  const at = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("says just now for the last minute", () => {
    expect(ago(at(10_000))).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(ago(at(5 * 60_000))).toBe("5m ago");
    expect(ago(at(3 * 3_600_000))).toBe("3h ago");
    expect(ago(at(2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to a date beyond a month", () => {
    expect(ago(at(60 * 86_400_000))).not.toMatch(/ago$/);
  });

  it("returns an empty string rather than NaN for nothing", () => {
    expect(ago(undefined)).toBe("");
    expect(ago(null)).toBe("");
  });

  it("does not produce a negative age for a clock that is behind", () => {
    // Phone clocks drift; a report "created" a second in the future must not
    // render as "-1m ago".
    expect(ago(new Date(Date.now() + 5_000).toISOString())).toBe("just now");
  });
});
