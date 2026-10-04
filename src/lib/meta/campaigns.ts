import { validateAdAccount } from "./accounts";
import { db } from "../db";
import { meta, accountId } from "./client";
import { BusinessError } from "../business";
export async function createMetaCampaign(id: string) {
  const c = await db.campaign.findUniqueOrThrow({ where: { id } });
  if (c.isDemo) return;
  await validateAdAccount();
  if (c.goal !== "Messages")
    throw new BusinessError(
      "Live creation currently supports Messenger campaigns. Lead-form campaigns require a Meta form configuration.",
    );
  if (!process.env.META_IMAGE_HASH)
    throw new BusinessError(
      "Configure an approved Meta image hash before creating a live campaign.",
    );
  const campaign = await meta<{ id: string }>(
    `${accountId()}/campaigns`,
    "POST",
    {
      name: c.name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
  );
  await db.campaign.update({ where: { id }, data: { metaId: campaign.id } });
  const targeting = {
    geo_locations: { countries: [c.country] },
    age_min: 25,
    age_max: 65,
    publisher_platforms: ["facebook"],
    facebook_positions: ["feed"],
    targeting_automation: { advantage_audience: 0 },
  };
  const adset = await meta<{ id: string }>(`${accountId()}/adsets`, "POST", {
    name: `${c.name} · ${c.country}`,
    campaign_id: campaign.id,
    daily_budget: c.dailyBudget,
    billing_event: "IMPRESSIONS",
    optimization_goal: "CONVERSATIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "MESSENGER",
    promoted_object: { page_id: process.env.META_PAGE_ID },
    targeting,
    status: "PAUSED",
  });
  const localSet = await db.adSet.create({
    data: {
      campaignId: id,
      metaId: adset.id,
      name: c.name,
      status: "PAUSED",
      audience: targeting,
    },
  });
  const creative = await meta<{ id: string }>(
    `${accountId()}/adcreatives`,
    "POST",
    {
      name: c.headline,
      object_story_spec: {
        page_id: process.env.META_PAGE_ID,
        link_data: {
          message: c.primaryText,
          name: c.headline,
          description: c.description,
          image_hash: process.env.META_IMAGE_HASH,
          link: `https://m.me/${process.env.META_PAGE_ID}`,
          call_to_action: {
            type: "MESSAGE_PAGE",
            value: { app_destination: "MESSENGER" },
          },
        },
      },
    },
  );
  const localCreative = await db.creative.create({
    data: {
      campaignId: id,
      metaId: creative.id,
      angle: "Reviewed primary creative",
      primaryText: c.primaryText,
      headline: c.headline,
      description: c.description,
    },
  });
  const ad = await meta<{ id: string }>(`${accountId()}/ads`, "POST", {
    name: c.name,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });
  await db.ad.create({
    data: {
      adSetId: localSet.id,
      creativeId: localCreative.id,
      metaId: ad.id,
      name: c.name,
      status: "PAUSED",
    },
  });
}
export async function changeMetaStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
) {
  const c = await db.campaign.findUniqueOrThrow({
    where: { id },
    include: { adSets: { include: { ads: true } } },
  });
  if (c.isDemo) return;
  await validateAdAccount();
  if (!c.metaId)
    throw new BusinessError("Campaign is not fully created in Meta.");
  if (status === "PAUSED") {
    await meta(c.metaId, "POST", { status });
    return;
  }
  if (
    !c.adSets.length ||
    !c.adSets.every((s) => s.metaId && s.ads.some((a) => a.metaId))
  )
    throw new BusinessError(
      "The Meta campaign is incomplete and cannot be activated.",
    );
  // Parent remains PAUSED until every child is ready. Only the final call permits delivery.
  for (const set of c.adSets) {
    for (const ad of set.ads)
      if (ad.metaId) await meta(ad.metaId, "POST", { status });
    await meta(set.metaId!, "POST", { status });
  }
  await meta(c.metaId, "POST", { status });
}
export async function changeMetaBudget(id: string, budget: number) {
  const c = await db.campaign.findUniqueOrThrow({
    where: { id },
    include: { adSets: true },
  });
  if (c.isDemo) return;
  await validateAdAccount();
  if (c.adSets.length !== 1 || !c.adSets[0].metaId)
    throw new BusinessError(
      "Budget updates require exactly one linked ad set.",
    );
  await meta(c.adSets[0].metaId, "POST", { daily_budget: budget });
}
