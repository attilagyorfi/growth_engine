/**
 * G2A Growth Engine – AI Usage Tracking Tests
 * Tests for feature gating / AI usage limit logic (per-feature kvóta rendszer)
 */
import { describe, it, expect } from "vitest";
import { AI_PLAN_LIMITS, AI_PLAN_TOTAL_LIMITS, getCurrentMonth } from "./authDb";

describe("AI Usage – Plan Limits (per-feature struktúra)", () => {
  it("free plan is an object with per-feature limits", () => {
    expect(typeof AI_PLAN_LIMITS.free).toBe("object");
    expect(AI_PLAN_LIMITS.free).toHaveProperty("strategy");
    expect(AI_PLAN_LIMITS.free).toHaveProperty("post");
    expect(AI_PLAN_LIMITS.free).toHaveProperty("seo");
  });

  it("free plan has correct per-feature limits", () => {
    expect(AI_PLAN_LIMITS.free.strategy).toBe(1);
    expect(AI_PLAN_LIMITS.free.post).toBe(5);
    expect(AI_PLAN_LIMITS.free.seo).toBe(1);
    expect(AI_PLAN_LIMITS.free.image).toBe(0);
    expect(AI_PLAN_LIMITS.free.video).toBe(0);
  });

  it("starter plan has correct per-feature limits", () => {
    expect(AI_PLAN_LIMITS.starter.strategy).toBe(5);
    expect(AI_PLAN_LIMITS.starter.post).toBe(50);
    expect(AI_PLAN_LIMITS.starter.seo).toBe(3);
    expect(AI_PLAN_LIMITS.starter.image).toBe(5);
    expect(AI_PLAN_LIMITS.starter.video).toBe(0);
  });

  it("pro plan has correct per-feature limits", () => {
    expect(AI_PLAN_LIMITS.pro.strategy).toBe(20);
    expect(AI_PLAN_LIMITS.pro.post).toBe(300);
    expect(AI_PLAN_LIMITS.pro.seo).toBe(10);
    expect(AI_PLAN_LIMITS.pro.image).toBe(30);
    expect(AI_PLAN_LIMITS.pro.video).toBe(5);
  });

  it("agency plan has correct per-feature limits", () => {
    expect(AI_PLAN_LIMITS.agency.strategy).toBe(60);
    expect(AI_PLAN_LIMITS.agency.post).toBe(1000);
    expect(AI_PLAN_LIMITS.agency.seo).toBe(30);
    expect(AI_PLAN_LIMITS.agency.image).toBe(100);
    expect(AI_PLAN_LIMITS.agency.video).toBe(15);
  });

  it("unknown plan defaults to free via nullish coalescing", () => {
    const limits = AI_PLAN_LIMITS["unknown_plan"] ?? AI_PLAN_LIMITS.free;
    expect(limits.strategy).toBe(1);
  });

  it("AI_PLAN_TOTAL_LIMITS contains all plans", () => {
    expect(AI_PLAN_TOTAL_LIMITS).toHaveProperty("free");
    expect(AI_PLAN_TOTAL_LIMITS).toHaveProperty("starter");
    expect(AI_PLAN_TOTAL_LIMITS).toHaveProperty("pro");
    expect(AI_PLAN_TOTAL_LIMITS).toHaveProperty("agency");
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
