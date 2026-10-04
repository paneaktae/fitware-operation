import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
if (process.env.DEMO_MODE !== "true")
  throw new Error("Verification cleanup is allowed only in demo mode.");
const items = await db.inventoryItem.findMany({
  where: { brand: "Test Brand", model: { startsWith: "Verification Press " } },
  include: { media: true, campaigns: true, leads: true },
});
const itemIds = items.map((i) => i.id),
  campaignIds = items.flatMap((i) => i.campaigns.map((c) => c.id)),
  leadIds = items.flatMap((i) => i.leads.map((l) => l.id));
await db.$transaction(async (tx) => {
  await tx.sale.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
  await tx.aIRecommendation.deleteMany({
    where: { inventoryItemId: { in: itemIds } },
  });
  await tx.lead.deleteMany({ where: { id: { in: leadIds } } });
  await tx.campaign.deleteMany({
    where: { id: { in: campaignIds }, isDemo: true },
  });
  await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
  await tx.auditLog.deleteMany({
    where: { entityId: { in: [...itemIds, ...campaignIds, ...leadIds] } },
  });
});
for (const m of items.flatMap((i) => i.media))
  if (/^\/api\/media\/[0-9a-f-]+\.(webp|mp4)$/.test(m.url))
    await rm(
      path.join(process.cwd(), ".data", "uploads", path.basename(m.url)),
      { force: true },
    );
console.log(
  `Removed ${items.length} named browser verification fixtures. Original demo records preserved.`,
);
await db.$disconnect();
