import { describe, it, expect } from "vitest";
import {
  ratios,
  assertStock,
  assertActivation,
  assertBudgetChange,
  health,
  rangeFor,
} from "../src/lib/business";
import { strategySchema, inventorySchema } from "../src/lib/schemas";
const item = { quantity: 2, reservedQuantity: 1, status: "AVAILABLE" };
describe("financial and performance calculations", () => {
  it("calculates CPL, ROAS, qualified rate, CTR, CPC and CPM without changing currency units", () => {
    const m = ratios({
      spend: 100000,
      leads: 10,
      qualified: 4,
      revenue: 500000,
      clicks: 100,
      impressions: 10000,
    });
    expect(m).toEqual({
      cpl: 10000,
      roas: 5,
      qualifiedRate: 40,
      ctr: 1,
      cpc: 1000,
      cpm: 10000,
    });
  });
  it("returns unavailable ratios for zero denominators, never Infinity or false zero results", () => {
    expect(
      ratios({
        spend: 0,
        leads: 0,
        qualified: 0,
        revenue: 0,
        clicks: 0,
        impressions: 0,
      }),
    ).toEqual({
      cpl: null,
      roas: null,
      qualifiedRate: null,
      ctr: null,
      cpc: null,
      cpm: null,
    });
  });
  it("does not classify 100 impressions as poor performance", () => {
    expect(
      health(
        { impressions: 100, spend: 900000, leads: 0, qualified: 0, revenue: 0 },
        2,
      ),
    ).toBe("INSUFFICIENT_DATA");
  });
  it("prioritizes attributed revenue and quality", () => {
    expect(
      health(
        {
          impressions: 5000,
          spend: 100000,
          leads: 10,
          qualified: 4,
          revenue: 500000,
        },
        2,
      ),
    ).toBe("EXCELLENT");
    expect(
      health(
        {
          impressions: 5000,
          spend: 300000,
          leads: 20,
          qualified: 0,
          revenue: 0,
        },
        2,
      ),
    ).toBe("POOR");
  });
});
describe("spend protection", () => {
  const campaign = { status: "PAUSED", revision: 2, dailyBudget: 50000 };
  it("requires affirmative confirmation of the exact reviewed revision and amount", () => {
    expect(() =>
      assertActivation(item, campaign, {
        confirmed: false,
        revision: 2,
        dailyBudget: 50000,
      }),
    ).toThrow();
    expect(() =>
      assertActivation(item, campaign, {
        confirmed: true,
        revision: 1,
        dailyBudget: 50000,
      }),
    ).toThrow();
    expect(() =>
      assertActivation(item, campaign, {
        confirmed: true,
        revision: 2,
        dailyBudget: 60000,
      }),
    ).toThrow();
    expect(() =>
      assertActivation(item, campaign, {
        confirmed: true,
        revision: 2,
        dailyBudget: 50000,
      }),
    ).not.toThrow();
  });
  it("never activates sold-out or incomplete campaigns", () => {
    expect(() =>
      assertActivation(
        { ...item, quantity: 0, reservedQuantity: 0 },
        campaign,
        { confirmed: true, revision: 2, dailyBudget: 50000 },
      ),
    ).toThrow();
    expect(() =>
      assertActivation(
        item,
        { ...campaign, status: "ERROR" },
        { confirmed: true, revision: 2, dailyBudget: 50000 },
      ),
    ).toThrow();
  });
  it("caps increases at 20%, requires confirmation, and rejects fractions, NaN and excessive amounts", () => {
    expect(() => assertBudgetChange(50000, 60000, true)).not.toThrow();
    for (const n of [60002, NaN, 1000001, 100.5, 0])
      expect(() => assertBudgetChange(50000, n, true)).toThrow();
    expect(() => assertBudgetChange(50000, 60000, false)).toThrow();
  });
  it("uses available quantity after reservations and forbids unready inventory", () => {
    expect(() => assertStock(item, 1)).not.toThrow();
    expect(() => assertStock(item, 2)).toThrow();
    expect(() =>
      assertStock({ ...item, status: "SERVICE_REQUIRED" }),
    ).toThrow();
  });
});
describe("date boundaries and AI validation", () => {
  it("uses Bangkok midnight across the UTC date boundary", () => {
    const r = rangeFor(
      "today",
      undefined,
      undefined,
      new Date("2026-10-04T18:00:00Z"),
    );
    expect(r.from.toISOString()).toBe("2026-10-04T17:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });
  it("validates a custom date range", () => {
    expect(() => rangeFor("custom", "2026-10-10", "2026-10-01")).toThrow();
  });
  it("rejects malformed or insufficient AI output", () => {
    expect(
      strategySchema.safeParse({ objective: "Messages", angles: ["one"] })
        .success,
    ).toBe(false);
  });
  it("rejects negative inventory values", () => {
    expect(
      inventorySchema.safeParse({
        brand: "Cybex",
        model: "Leg Press",
        askingPrice: -1,
      }).success,
    ).toBe(false);
  });
});
