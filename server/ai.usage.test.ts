/**
 * G2A Growth Engine – AI Usage Tracking Tests
 * Tests for feature gating / AI usage limit logic
 */
import { describe, it, expect } from "vitest";
import { AI_PLAN_LIMITS, getCurrentMonth } from "./authDb";

describe("AI Usage – Plan Limits", () => {
  it("free plan has limit of 3", () => {
    expect(AI_PLAN_LIMITS.free).toBe(3);
  });

  it("starter plan has limit of 20", () => {
    expect(AI_PLAN_LIMITS.starter).toBe(20);
  });

  it("pro plan is unlimited (-1)", () => {
    expect(AI_PLAN_LIMITS.pro).toBe(-1);
  });

  it("agency plan is unlimited (-1)", () => {
    expect(AI_PLAN_LIMITS.agency).toBe(-1);
  });

  it("unknown plan defaults to 3 (free) via nullish coalescing", () => {
    const limit = AI_PLAN_LIMITS["unknown_plan"] ?? 3;
    expect(limit).toBe(3);
  });
});

describe("AI Usage – getCurrentMonth", () => {
  it("returns a string in YYYY-MM format", () => {
    const month = getCurrentMonth();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("returns the current year and month", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(getCurrentMonth()).toBe(expected);
  });
});
