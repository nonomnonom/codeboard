import { describe, expect, it } from "vitest";
import {
  addTime,
  normalizeRate,
  rescaleTime,
  scaleTimeByDuration,
} from "../../src/animation/rational-time.js";

describe("rate normalization", () => {
  it.each([
    [24, { numerator: 24, denominator: 1 }],
    [23.976, { numerator: 2997, denominator: 125 }],
    [0.001, { numerator: 1, denominator: 1000 }],
    [1e-7, { numerator: 1, denominator: 10000000 }],
    [1e3, { numerator: 1000, denominator: 1 }],
    [
      { numerator: 48000, denominator: 2002 },
      { numerator: 24000, denominator: 1001 },
    ],
  ])("reduces %j without guessing a broadcast rate", (input, expected) => {
    expect(normalizeRate(input)).toEqual(expected);
  });

  it.each([0, -24, NaN, Infinity, { numerator: 24, denominator: 0 }])(
    "rejects invalid rate %s",
    (rate) => {
      expect(() => normalizeRate(rate)).toThrow(
        expect.objectContaining({ code: "INVALID_ARGUMENT" }),
      );
    },
  );

  it.each([1e21, 1e-20])("rejects rate %s outside the safe rational representation", (rate) => {
    expect(() => normalizeRate(rate)).toThrow(expect.objectContaining({ code: "RESOURCE_LIMIT" }));
  });
});

describe("tick conversion", () => {
  it("converts an integral position onto a slower clock exactly", () => {
    expect(rescaleTime(60, 30, 24, "exact")).toEqual({
      value: 48,
      exact: true,
      error: { numerator: "0", denominator: "1" },
    });
  });
  it("rejects an unknown rounding policy", () => {
    expect(() => rescaleTime(1, 24, 30, "truncate" as never)).toThrow(
      "Unknown time rounding policy",
    );
  });
  it("places one 24 fps frame at sample 2000 in 48 kHz audio", () => {
    expect(rescaleTime(1, 24, 48000, "exact")).toEqual({
      value: 2000,
      exact: true,
      error: { numerator: "0", denominator: "1" },
    });
  });

  it("converts 30000 broadcast frames to exactly 1001 seconds", () => {
    expect(rescaleTime(30000, { numerator: 30000, denominator: 1001 }, 1, "exact")).toEqual({
      value: 1001,
      exact: true,
      error: { numerator: "0", denominator: "1" },
    });
  });

  it.each([
    [1, "floor", 0, "-4"],
    [1, "ceil", 1, "1"],
    [1, "nearest", 1, "1"],
    [-1, "floor", -1, "-1"],
    [-1, "ceil", 0, "4"],
    [-1, "nearest", -1, "-1"],
  ] as const)("rounds frame %i from 30 to 24 fps using %s", (frame, mode, value, numerator) => {
    expect(rescaleTime(frame, 30, 24, mode)).toEqual({
      value,
      exact: false,
      error: { numerator, denominator: "5" },
    });
  });

  it.each([
    [1, 1],
    [-1, 0],
  ])("rounds the half-frame tie at %i toward positive infinity", (frame, value) => {
    expect(rescaleTime(frame!, 48, 24)).toEqual({
      value,
      exact: false,
      error: { numerator: "1", denominator: "2" },
    });
  });

  it("rejects an inexact edit when quantization is forbidden", () => {
    expect(() => rescaleTime(1, 30, 24, "exact")).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  });

  it("retains the largest safe tick without a floating-point intermediate", () => {
    expect(rescaleTime(Number.MAX_SAFE_INTEGER, 48000, 48000, "exact").value).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("rejects a converted position beyond the safe integer range", () => {
    expect(() => rescaleTime(Number.MAX_SAFE_INTEGER, 24, 48000)).toThrow(
      expect.objectContaining({ code: "RESOURCE_LIMIT" }),
    );
  });

  it.each([0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects tick %s", (value) => {
    expect(() => rescaleTime(value, 24, 30)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  });
});

describe("time arithmetic", () => {
  it("adds two fractional clocks without dropping either denominator", () => {
    expect(
      addTime(1, { numerator: 3, denominator: 2 }, 1, { numerator: 5, denominator: 3 }),
    ).toEqual({
      ticks: 19,
      rate: { numerator: 15, denominator: 1 },
    });
  });

  it("scales a fractional-clock cue by elapsed duration across different clocks", () => {
    // (2/3 seconds) * (3/5 seconds) / (2/7 seconds) = 7/5 seconds.
    expect(
      scaleTimeByDuration(
        { ticks: 1, rate: { numerator: 3, denominator: 2 } },
        { ticks: 1, rate: { numerator: 7, denominator: 2 } },
        { ticks: 1, rate: { numerator: 5, denominator: 3 } },
      ),
    ).toEqual({ ticks: 7, rate: { numerator: 5, denominator: 1 } });
  });
  it.each([NaN, 0.5, Infinity])("rejects non-integer addition operand %s", (ticks) => {
    expect(() => addTime(ticks, 24, 0, 24)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
    expect(() => addTime(0, 24, ticks, 24)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  });

  it("rejects a sum larger than the safe rational range", () => {
    expect(() => addTime(Number.MAX_SAFE_INTEGER, 1, 1, 1)).toThrow(
      expect.objectContaining({ code: "RESOURCE_LIMIT", details: { reason: "TIME_SUM_RANGE" } }),
    );
  });

  it.each([0, -1, 0.5, Infinity])("rejects invalid shot duration %s", (ticks) => {
    const cue = { ticks: 12, rate: { numerator: 24, denominator: 1 } };
    const invalid = { ...cue, ticks };
    expect(() => scaleTimeByDuration(cue, invalid, cue)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
    expect(() => scaleTimeByDuration(cue, cue, invalid)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  });

  it("retains a zero cue through a duration change", () => {
    const zero = { ticks: 0, rate: { numerator: 24, denominator: 1 } };
    expect(scaleTimeByDuration(zero, { ...zero, ticks: 24 }, { ...zero, ticks: 48 })).toEqual(zero);
  });

  it("retains a cue when two durations represent the same elapsed seconds", () => {
    const cue = { ticks: 12, rate: { numerator: 24, denominator: 1 } };
    expect(
      scaleTimeByDuration(
        cue,
        { ...cue, ticks: 24 },
        { ticks: 30, rate: { numerator: 30, denominator: 1 } },
      ),
    ).toEqual(cue);
  });

  it("rejects scaled time beyond the safe integer range", () => {
    const rate = { numerator: 1, denominator: 1 };
    expect(() =>
      scaleTimeByDuration(
        { ticks: Number.MAX_SAFE_INTEGER, rate },
        { ticks: 1, rate },
        { ticks: 2, rate },
      ),
    ).toThrow(expect.objectContaining({ code: "RESOURCE_LIMIT" }));
  });
  it("adds one 24 fps frame and one 30 fps frame as 3/40 seconds", () => {
    expect(addTime(1, 24, 1, 30)).toEqual({
      ticks: 3,
      rate: { numerator: 40, denominator: 1 },
    });
  });

  it("cancels equal positive and negative positions on different clocks", () => {
    expect(addTime(24, 24, -48000, 48000)).toEqual({
      ticks: 0,
      rate: { numerator: 1, denominator: 1 },
    });
  });

  it("scales a half-second cue to three quarters when a two-second shot becomes three", () => {
    expect(
      scaleTimeByDuration(
        { ticks: 12, rate: { numerator: 24, denominator: 1 } },
        { ticks: 48, rate: { numerator: 24, denominator: 1 } },
        { ticks: 90, rate: { numerator: 30, denominator: 1 } },
      ),
    ).toEqual({ ticks: 3, rate: { numerator: 4, denominator: 1 } });
  });
});
