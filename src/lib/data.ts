import { db } from "./db";
import { rangeFor, ratios, health } from "./business";
export async function report(period = "30d", start?: string, end?: string) {
  const range = rangeFor(period, start, end);
  // Metrics are calendar-day snapshots in the business timezone, CRM events are UTC instants.
  const metricDate = (d: Date) =>
    new Date(
      new Date(+d + 7 * 3600000).toISOString().slice(0, 10) + "T00:00:00Z",
    );
  const [
    items,
    campaigns,
    leads,
    sales,
    recommendations,
    settings,
    integration,
    reportingLeads,
  ] = await Promise.all([
    db.inventoryItem.findMany({
      include: { media: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.findMany({
      include: {
        metrics: {
          where: {
            date: {
              gte: metricDate(range.previousFrom),
              lt: metricDate(range.to),
            },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findMany({
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 30 },
        sale: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    db.sale.findMany({
      where: { soldAt: { gte: range.previousFrom, lt: range.to } },
    }),
    db.aIRecommendation.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.appSetting.findUnique({ where: { id: "business" } }),
    db.integration.findUnique({ where: { id: "meta" } }),
    db.lead.findMany({
      where: { createdAt: { gte: range.previousFrom, lt: range.to } },
      select: { campaignId: true, createdAt: true, qualifiedAt: true },
    }),
  ]);
  if (process.env.DEMO_MODE !== "true" && campaigns.some((c) => c.isDemo))
    throw new Error("Live mode requires a database without demo campaigns.");
  function stats(from: Date, to: Date, campaignId?: string) {
    const metrics = campaigns
      .filter((c) => !campaignId || c.id === campaignId)
      .flatMap((c) => c.metrics)
      .filter((m) => m.date >= metricDate(from) && m.date < metricDate(to));
    const cohort = reportingLeads.filter(
      (l) =>
        (!campaignId || l.campaignId === campaignId) &&
        l.createdAt >= from &&
        l.createdAt < to,
    );
    const sold = sales.filter(
      (s) =>
        (!campaignId || s.campaignId === campaignId) &&
        s.soldAt >= from &&
        s.soldAt < to,
    );
    const m = {
      spend: metrics.reduce((a, m) => a + m.spend, 0),
      impressions: metrics.reduce((a, m) => a + m.impressions, 0),
      dailyReachSum: metrics.reduce((a, m) => a + m.reach, 0),
      clicks: metrics.reduce((a, m) => a + m.clicks, 0),
      messages: metrics.reduce((a, m) => a + m.messages, 0),
      platformLeads: metrics.reduce((a, m) => a + m.platformLeads, 0),
      leads: cohort.length,
      qualified: cohort.filter((l) => l.qualifiedAt !== null).length,
      sales: sold.length,
      revenue: sold.reduce((a, s) => a + s.revenue, 0),
    };
    return { ...m, ...ratios(m) };
  }
  const performance = campaigns.map((c) => {
    const m = stats(range.from, range.to, c.id);
    const item = items.find((i) => i.id === c.inventoryItemId)!;
    return {
      ...c,
      metrics: undefined,
      ...m,
      health: health(m, item.quantity - item.reservedQuantity),
    };
  });
  const days = [];
  for (
    let d = metricDate(range.from);
    d < metricDate(range.to);
    d = new Date(+d + 86400000)
  ) {
    const rows = campaigns
      .flatMap((c) => c.metrics)
      .filter((m) => +m.date === +d);
    const dayFrom = new Date(+d - 7 * 3600000),
      dayTo = new Date(+dayFrom + 86400000);
    const sold = sales.filter((s) => s.soldAt >= dayFrom && s.soldAt < dayTo);
    const cohort = reportingLeads.filter(
      (l) => l.createdAt >= dayFrom && l.createdAt < dayTo,
    );
    const spend = rows.reduce((a, m) => a + m.spend, 0),
      revenue = sold.reduce((a, s) => a + s.revenue, 0);
    days.push({
      date: d.toISOString().slice(0, 10),
      spend: spend / 100,
      leads: cohort.length,
      qualified: cohort.filter((l) => l.qualifiedAt).length,
      revenue: revenue / 100,
      cpl: cohort.length ? spend / 100 / cohort.length : null,
      roas: spend ? revenue / spend : null,
    });
  }
  return {
    items,
    campaigns: performance,
    leads,
    recommendations,
    settings,
    integration,
    totals: stats(range.from, range.to),
    previous: stats(range.previousFrom, range.previousTo),
    days,
    range: { from: range.from, to: range.to },
    demo: process.env.DEMO_MODE === "true",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    metaConfigured: Boolean(
      process.env.META_ACCESS_TOKEN &&
      process.env.META_API_VERSION &&
      process.env.META_AD_ACCOUNT_ID &&
      process.env.META_PAGE_ID,
    ),
    storage: process.env.STORAGE_PROVIDER ?? "local",
  };
}
export type Report = Awaited<ReturnType<typeof report>>;
export type ClientReport = JSONified<Report>;
type JSONified<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<JSONified<U>>
    : T extends object
      ? { [K in keyof T]: JSONified<T[K]> }
      : T;
