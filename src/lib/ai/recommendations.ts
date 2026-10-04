import { createHash } from "node:crypto";
import { db } from "../db";
import { report } from "../data";
import { money } from "../format";
export async function refreshRecommendations() {
  const data = await report("30d");
  const now = new Date();
  const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  await db.aIRecommendation.updateMany({
    where: { status: "PENDING" },
    data: { status: "EXPIRED" },
  });
  const suggestions: {
    type: string;
    title: string;
    description: string;
    reason: string;
    campaignId?: string;
    inventoryItemId: string;
    currentValue?: number;
    recommendedValue?: number;
  }[] = [];
  for (const item of data.items.filter(
    (i) => !["HIDDEN", "COMING_SOON", "SERVICE_REQUIRED"].includes(i.status),
  )) {
    const available = item.quantity - item.reservedQuantity;
    const campaigns = data.campaigns.filter(
      (c) => c.inventoryItemId === item.id,
    );
    const active = campaigns.filter((c) => c.status === "ACTIVE");
    if (available === 0) {
      for (const c of active)
        suggestions.push({
          type: "PAUSE_CAMPAIGN",
          title: `Sold out: ${item.brand} ${item.model}`,
          description:
            "Review and pause the campaign while this machine is unavailable.",
          reason: `Available stock is zero and ${c.name} is active. This rule does not pause it automatically.`,
          campaignId: c.id,
          inventoryItemId: item.id,
        });
      continue;
    }
    if (!active.length && item.status === "AVAILABLE")
      suggestions.push({
        type: "PROMOTE_INVENTORY",
        title: `Consider promoting ${item.brand} ${item.model}`,
        description: `${available} units are available with no active campaign.`,
        reason:
          "This is an inventory opportunity, not a forecast of advertising performance. Start with a reviewed test.",
        inventoryItemId: item.id,
      });
    for (const c of active) {
      if (c.health === "POOR")
        suggestions.push({
          type: "GENERATE_CREATIVE",
          title: `Refresh ${item.model} creative`,
          description: "Test a new factual angle before increasing the budget.",
          reason: `${money(c.spend)} spent, ${c.leads} CRM leads and ${c.qualified} qualified leads in the last 30 days. Lead quality does not justify scaling.`,
          campaignId: c.id,
          inventoryItemId: item.id,
        });
      else if (
        available > 1 &&
        c.health === "EXCELLENT" &&
        c.sales >= 3 &&
        c.leads >= 10 &&
        c.qualifiedRate !== null &&
        c.qualifiedRate >= 25 &&
        c.cpl !== null &&
        data.totals.cpl !== null &&
        c.cpl < data.totals.cpl * 0.8
      ) {
        const proposed = Math.min(
          Math.round(c.dailyBudget * 1.2),
          Number(process.env.MAX_DAILY_BUDGET_THB ?? 10000) * 100,
        );
        if (proposed > c.dailyBudget)
          suggestions.push({
            type: "INCREASE_BUDGET",
            title: `Consider a measured increase for ${item.model}`,
            description: `${money(c.dailyBudget)} → ${money(proposed)} per day, only after approval.`,
            reason: `Last 30 days: ${c.sales} sales, ${c.qualified}/${c.leads} qualified leads and CPL ${money(c.cpl)}, below 80% of the account CPL. ${available} units remain. Results may change; this is not a guarantee.`,
            campaignId: c.id,
            inventoryItemId: item.id,
            currentValue: c.dailyBudget,
            recommendedValue: proposed,
          });
      }
    }
  }
  for (const s of suggestions) {
    const id =
      "rule-" +
      createHash("sha256")
        .update(`${day}:${s.type}:${s.inventoryItemId}:${s.campaignId ?? ""}`)
        .digest("hex")
        .slice(0, 24);
    const previous = await db.aIRecommendation.findUnique({ where: { id } });
    if (
      previous &&
      ["REJECTED", "APPROVED", "EXECUTED"].includes(previous.status)
    )
      continue;
    await db.aIRecommendation.upsert({
      where: { id },
      create: { id, ...s, expiresAt: new Date(+now + 86400000) },
      update: { ...s, status: "PENDING", expiresAt: new Date(+now + 86400000) },
    });
  }
  return {
    message:
      "Recommendations refreshed from current inventory, CRM quality, and sales. No advertising changes were made.",
  };
}
