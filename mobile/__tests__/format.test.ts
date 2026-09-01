import { compact, rupees, distance, plural, truncate, humanise } from "../src/utils/format";

describe("compact", () => {
  it("leaves small numbers alone", () => {
    expect(compact(0)).toBe("0");
    expect(compact(999)).toBe("999");
  });

  it("shortens thousands, with a decimal only where it fits", () => {
    expect(compact(1200)).toBe("1.2k");
    expect(compact(45_000)).toBe("45k");
  });

  it("shortens millions", () => {
    expect(compact(2_400_000)).toBe("2.4M");
  });

  it("survives nonsense rather than printing NaN", () => {
    expect(compact(NaN)).toBe("0");
    expect(compact(Infinity)).toBe("0");
  });
});

describe("rupees", () => {
  it("groups the Indian way, not in thousands", () => {
    // 1234567 is 12,34,567 in India — not 1,234,567.
    expect(rupees(1234567)).toBe("₹12,34,567");
  });

  it("leaves three digits ungrouped", () => {
    expect(rupees(999)).toBe("₹999");
  });

  it("groups at four digits", () => {
    expect(rupees(1000)).toBe("₹1,000");
  });

  it("keeps the sign in front of the symbol", () => {
    expect(rupees(-5000)).toBe("-₹5,000");
  });

  it("rounds rather than showing paise", () => {
    expect(rupees(1499.6)).toBe("₹1,500");
  });
});

describe("distance", () => {
  it("uses metres below a kilometre", () => {
    expect(distance(450)).toBe("450 m");
  });

  it("switches to kilometres at a thousand", () => {
    expect(distance(1000)).toBe("1.0 km");
    expect(distance(2350)).toBe("2.4 km");
  });

  it("refuses to render a negative distance", () => {
    expect(distance(-5)).toBe("—");
  });
});

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "report")).toBe("1 report");
  });

  it("uses the plural for none and for many", () => {
    expect(plural(0, "report")).toBe("0 reports");
    expect(plural(5, "report")).toBe("5 reports");
  });

  it("takes an irregular plural", () => {
    expect(plural(2, "person", "people")).toBe("2 people");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("cuts on a word boundary when there is one", () => {
    expect(truncate("deep pothole outside the school", 20)).toBe("deep pothole outside…");
  });

  it("cuts mid-word rather than losing most of the text", () => {
    // The boundary is only used if it keeps enough of the string.
    expect(truncate("supercalifragilistic", 10)).toBe("supercalif…");
  });
});

describe("humanise", () => {
  it("turns a constant into a phrase", () => {
    expect(humanise("PENDING_REVIEW")).toBe("Pending Review");
  });

  it("handles nothing", () => {
    expect(humanise(undefined)).toBe("");
    expect(humanise("")).toBe("");
  });
});
