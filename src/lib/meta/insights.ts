import { validateAdAccount } from "./accounts";
import { db } from "../db";
import { accountId, meta } from "./client";
import { BusinessError } from "../business";
import { z } from "zod";
const rowSchema = z.object({
  campaign_id: z.string(),
  date_start: z.string(),
  spend: z.string(),
  impressions: z.string(),
  reach: z.string().optional(),
  clicks: z.string().optional(),
  actions: z
    .array(z.object({ action_type: z.string(), value: z.string() }))
    .optional(),
});
export async function syncInsights() {
  if (process.env.DEMO_MODE === "true")
    return {
      message: "Demo data is stored locally. No Meta request was made.",
    };
  await db.integration.upsert({
    where: { id: "meta" },
    create: { id: "meta" },
    update: {},
  });
  const lease = await db.integration.updateMany({
    where: {
      id: "meta",
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: new Date() } }],
    },
    data: { syncLeaseUntil: new Date(Date.now() + 10 * 60000) },
  });
  if (!lease.count)
    throw new BusinessError("A metric sync is already running.");
  try {
    await validateAdAccount();
    let after: string | undefined;
    let count = 0;
    const campaigns = await db.campaign.findMany({
      where: { isDemo: false, metaId: { not: null } },
      select: { id: true, metaId: true },
    });
    do {
      const result: {
        data: unknown[];
        paging?: { cursors?: { after?: string }; next?: string };
      } = await meta(`${accountId()}/insights`, "GET", {
        fields: "campaign_id,date_start,spend,impressions,reach,clicks,actions",
        level: "campaign",
        date_preset: "last_30d",
        time_increment: 1,
        limit: 100,
        ...(after ? { after } : {}),
      });
      for (const raw of result.data) {
        const r = rowSchema.parse(raw);
        const campaign = campaigns.find((c) => c.metaId === r.campaign_id);
        if (!campaign) continue;
        const value = (name: string) =>
          Number(r.actions?.find((a) => a.action_type === name)?.value ?? 0);
        const data = {
          spend: Math.round(Number(r.spend) * 100),
          impressions: Number(r.impressions),
          reach: Number(r.reach ?? 0),
          clicks: Number(r.clicks ?? 0),
          messages: value(
            "onsite_conversion.messaging_conversation_started_7d",
          ),
          platformLeads: value("lead"),
        };
        const date = new Date(`${r.date_start}T00:00:00Z`);
        await db.campaignMetric.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: { campaignId: campaign.id, date, ...data },
          update: data,
        });
        count++;
      }
      after = result.paging?.next ? result.paging.cursors?.after : undefined;
    } while (after);
    await db.integration.update({
      where: { id: "meta" },
      data: { status: "CONNECTED", lastSync: new Date(), lastError: null },
    });
    return { message: `Synced ${count} daily campaign snapshots.` };
  } catch (e) {
    await db.integration.update({
      where: { id: "meta" },
      data: {
        status: "ERROR",
        lastError:
          "Metric sync failed. Check the token and permissions, then retry.",
      },
    });
    throw e;
  } finally {
    await db.integration.update({
      where: { id: "meta" },
      data: { syncLeaseUntil: null },
    });
  }
}
