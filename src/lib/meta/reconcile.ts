import { db } from "../db";
import { meta } from "./client";
import { BusinessError } from "../business";
export async function reconcileCampaign(id: string, actor: string) {
  const c = await db.campaign.findUniqueOrThrow({
    where: { id },
    include: { adSets: { include: { ads: true } } },
  });
  if (c.isDemo || !c.metaId)
    throw new BusinessError(
      "Only a campaign linked to Meta can be reconciled.",
    );
  const remote = await meta<{ status: string }>(c.metaId, "GET", {
    fields: "status",
  });
  if (!["ACTIVE", "PAUSED"].includes(remote.status))
    throw new BusinessError(
      "Meta reports another status. Inspect this campaign in Meta Ads Manager.",
    );
  if (
    !c.adSets.length ||
    !c.adSets.every((s) => s.metaId && s.ads.some((a) => a.metaId))
  )
    throw new BusinessError(
      "Meta creation is incomplete. Inspect the paused objects in Ads Manager; activation is blocked.",
    );
  const adset = await meta<{ daily_budget: string }>(
    c.adSets[0].metaId!,
    "GET",
    { fields: "daily_budget" },
  );
  const dailyBudget = Number(adset.daily_budget);
  if (!Number.isSafeInteger(dailyBudget) || dailyBudget <= 0)
    throw new BusinessError("Meta budget could not be reconciled.");
  return db.$transaction(async (tx) => {
    const updated = await tx.campaign.update({
      where: { id },
      data: {
        status: remote.status as "ACTIVE" | "PAUSED",
        dailyBudget,
        revision: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        actor,
        action: "META_STATUS_RECONCILED",
        entity: "Campaign",
        entityId: id,
        before: { status: c.status, dailyBudget: c.dailyBudget },
        after: { status: updated.status, dailyBudget },
      },
    });
    return updated;
  });
}
