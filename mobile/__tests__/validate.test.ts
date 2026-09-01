import { isEmail, isStrongEnough, isBlank, titleProblem, isCoordinate } from "../src/utils/validate";

describe("isEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isEmail("vedant@example.com")).toBe(true);
    expect(isEmail("a.b+tag@sub.domain.co.in")).toBe(true);
  });

  it("rejects the obvious mistakes", () => {
    for (const bad of ["", "no-at-sign", "a@b", "a@b.c", "two @spaces.com"]) {
      expect(isEmail(bad)).toBe(false);
    }
  });

  it("ignores surrounding whitespace", () => {
    expect(isEmail("  vedant@example.com  ")).toBe(true);
  });
});

describe("isStrongEnough", () => {
  it("asks for eight characters and nothing more", () => {
    // Deliberately not demanding symbols: a rule the server does not enforce
    // would reject a password the account already has.
    expect(isStrongEnough("lumen123")).toBe(true);
    expect(isStrongEnough("short")).toBe(false);
  });
});

describe("isBlank", () => {
  it("treats whitespace as empty", () => {
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\n")).toBe(true);
  });

  it("treats nothing as empty", () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
  });

  it("does not treat real text as empty", () => {
    expect(isBlank("pothole")).toBe(false);
  });
});

describe("titleProblem", () => {
  it("passes a reasonable title", () => {
    expect(titleProblem("Deep pothole outside the school gate")).toBeNull();
  });

  it("asks for something when the box is empty", () => {
    expect(titleProblem("   ")).toMatch(/describe/i);
  });

  it("asks for more when it is too terse to route", () => {
    expect(titleProblem("hole")).toMatch(/detail/i);
  });

  it("stops a title that will not fit a queue row", () => {
    expect(titleProblem("x".repeat(200))).toMatch(/too long/i);
  });
});

describe("isCoordinate", () => {
  it("accepts a point in the demonstration city", () => {
    expect(isCoordinate(12.9716, 77.5946)).toBe(true);
  });

  it("rejects null island, which is what a broken GPS reports", () => {
    expect(isCoordinate(0, 0)).toBe(false);
  });

  it("rejects impossible values", () => {
    expect(isCoordinate(95, 10)).toBe(false);
    expect(isCoordinate(10, 200)).toBe(false);
    expect(isCoordinate(NaN, 10)).toBe(false);
  });

  it("rejects a missing fix", () => {
    expect(isCoordinate(null, null)).toBe(false);
    expect(isCoordinate(12.97, undefined)).toBe(false);
  });
});
