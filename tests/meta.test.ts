import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  meta: vi.fn(),
  campaign: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  adSet: { create: vi.fn() },
  creative: { create: vi.fn() },
  ad: { create: vi.fn() },
}));
vi.mock("../src/lib/db", () => ({
  db: {
    campaign: mocks.campaign,
    adSet: mocks.adSet,
    creative: mocks.creative,
    ad: mocks.ad,
  },
}));
vi.mock("../src/lib/meta/client", () => ({
  meta: mocks.meta,
  accountId: () => "act_test",
}));
import {
  createMetaCampaign,
  changeMetaStatus,
} from "../src/lib/meta/campaigns";
const campaign = {
  id: "c1",
  isDemo: false,
  goal: "Messages",
  name: "Cybex",
  headline: "Verified machine",
  primaryText: "Product facts",
  description: "Ask us",
  country: "TH",
  dailyBudget: 50000,
  metaId: "remote-campaign",
  adSets: [{ metaId: "remote-set", ads: [{ metaId: "remote-ad" }] }],
};
beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_IMAGE_HASH = "test-approved-hash";
  process.env.META_PAGE_ID = "test-page";
  mocks.campaign.findUniqueOrThrow.mockResolvedValue(campaign);
  mocks.adSet.create.mockResolvedValue({ id: "local-set" });
  mocks.creative.create.mockResolvedValue({ id: "local-creative" });
  mocks.meta.mockImplementation(async (path: string, method: string) =>
    method === "GET"
      ? { currency: "THB", timezone_name: "Asia/Bangkok" }
      : { id: `remote-${path.split("/").at(-1)}` },
  );
});
describe("Meta spending boundary (mocked network)", () => {
  it("creates every delivery object paused and uses minor currency units", async () => {
    await createMetaCampaign("c1");
    const posts = mocks.meta.mock.calls.filter((c) => c[1] === "POST");
    const delivery = posts.filter((c) =>
      ["campaigns", "adsets", "ads"].includes(c[0].split("/").at(-1)),
    );
    expect(delivery).toHaveLength(3);
    expect(delivery.every((c) => c[2].status === "PAUSED")).toBe(true);
    expect(
      delivery.find((c) => c[0].endsWith("/adsets"))?.[2].daily_budget,
    ).toBe(50000);
  });
  it("activates the parent only after its children", async () => {
    await changeMetaStatus("c1", "ACTIVE");
    const posts = mocks.meta.mock.calls.filter((c) => c[1] === "POST");
    expect(posts.map((c) => c[0])).toEqual([
      "remote-ad",
      "remote-set",
      "remote-campaign",
    ]);
  });
  it("never activates the parent after a child activation fails", async () => {
    mocks.meta.mockImplementation(async (path: string, method: string) => {
      if (method === "GET")
        return { currency: "THB", timezone_name: "Asia/Bangkok" };
      if (path === "remote-set") throw new Error("Simulated transport failure");
      return { id: "ok" };
    });
    await expect(changeMetaStatus("c1", "ACTIVE")).rejects.toThrow();
    expect(
      mocks.meta.mock.calls.some(
        (c) => c[0] === "remote-campaign" && c[1] === "POST",
      ),
    ).toBe(false);
  });
  it("makes no Meta calls for demo campaigns", async () => {
    mocks.campaign.findUniqueOrThrow.mockResolvedValue({
      ...campaign,
      isDemo: true,
    });
    await createMetaCampaign("c1");
    await changeMetaStatus("c1", "ACTIVE");
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("rejects an account using another currency", async () => {
    mocks.meta.mockResolvedValue({
      currency: "USD",
      timezone_name: "Asia/Bangkok",
    });
    await expect(createMetaCampaign("c1")).rejects.toThrow("THB");
    expect(mocks.meta.mock.calls.filter((c) => c[1] === "POST")).toHaveLength(
      0,
    );
  });
});
