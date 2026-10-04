import "dotenv/config";
import { afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { updateLead } from "../src/lib/operations";
import { campaignAction } from "../src/lib/campaign-operations";
const prefix = `test-${randomUUID()}`;
const ids: { leads: string[]; items: string[]; campaigns: string[] } = {
  leads: [],
  items: [],
  campaigns: [],
};
afterAll(async () => {
  await db.sale.deleteMany({ where: { leadId: { in: ids.leads } } });
  await db.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await db.campaign.deleteMany({ where: { id: { in: ids.campaigns } } });
  await db.inventoryItem.deleteMany({ where: { id: { in: ids.items } } });
  await db.auditLog.deleteMany({ where: { actor: prefix } });
  await db.$disconnect();
});
async function fixture(stock = 2) {
  const item = await db.inventoryItem.create({
    data: {
      id: `${prefix}-${ids.items.length}`,
      brand: "Test",
      model: "Machine",
      askingPrice: 9500000,
      quantity: stock,
    },
  });
  ids.items.push(item.id);
  const campaign = await db.campaign.create({
    data: {
      inventoryItemId: item.id,
      name: "Test paused",
      dailyBudget: 50000,
      status: "PAUSED",
      isDemo: true,
      audience: "TH",
      destination: "Demo",
      primaryText: "Verified facts",
      headline: "Test",
      description: "",
    },
  });
  ids.campaigns.push(campaign.id);
  const lead = await db.lead.create({
    data: {
      name: "Test buyer",
      inventoryItemId: item.id,
      campaignId: campaign.id,
    },
  });
  ids.leads.push(lead.id);
  return { item, campaign, lead };
}
const win = {
  status: "WON" as const,
  revenue: 9000000,
  quantity: 1,
  note: "Confirmed sale",
  lossReason: "",
};
describe("transactional revenue attribution against PostgreSQL", () => {
  it("attributes the sale and decrements stock exactly once, even on repeated concurrent submission", async () => {
    const { item, campaign, lead } = await fixture();
    await Promise.all([
      updateLead(lead.id, win, prefix),
      updateLead(lead.id, win, prefix),
    ]);
    expect(await db.sale.count({ where: { leadId: lead.id } })).toBe(1);
    const sale = await db.sale.findUniqueOrThrow({
      where: { leadId: lead.id },
    });
    expect(sale.campaignId).toBe(campaign.id);
    expect(sale.inventoryItemId).toBe(item.id);
    expect(sale.revenue).toBe(9000000);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .quantity,
    ).toBe(1);
  });
  it("prevents two leads from overselling one available unit", async () => {
    const { item, campaign, lead } = await fixture(1);
    const second = await db.lead.create({
      data: {
        name: "Second buyer",
        inventoryItemId: item.id,
        campaignId: campaign.id,
      },
    });
    ids.leads.push(second.id);
    const results = await Promise.allSettled([
      updateLead(lead.id, win, prefix),
      updateLead(second.id, win, prefix),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .quantity,
    ).toBe(0);
  });
  it("edits revenue without consuming another machine", async () => {
    const { item, lead } = await fixture();
    await updateLead(lead.id, win, prefix);
    await updateLead(lead.id, { ...win, revenue: 8500000 }, prefix);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { leadId: lead.id } })).revenue,
    ).toBe(8500000);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .quantity,
    ).toBe(1);
    await expect(
      updateLead(lead.id, { ...win, status: "NEW" }, prefix),
    ).rejects.toThrow();
  });
  it("blocks stale activation and records a successful explicit demo activation", async () => {
    const { campaign } = await fixture();
    await expect(
      campaignAction(
        campaign.id,
        {
          action: "activate",
          confirmed: true,
          revision: 99,
          dailyBudget: 50000,
        },
        prefix,
      ),
    ).rejects.toThrow();
    const updated = await campaignAction(
      campaign.id,
      { action: "activate", confirmed: true, revision: 0, dailyBudget: 50000 },
      prefix,
    );
    expect(updated.status).toBe("ACTIVE");
    expect(
      await db.auditLog.count({
        where: {
          actor: prefix,
          entityId: campaign.id,
          action: "CAMPAIGN_ACTIVATE",
        },
      }),
    ).toBe(1);
  });
});
