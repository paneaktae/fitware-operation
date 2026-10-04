export class BusinessError extends Error {}
export function ratios(m: {
  spend: number;
  leads: number;
  qualified: number;
  revenue: number;
  clicks: number;
  impressions: number;
}) {
  return {
    cpl: m.leads ? m.spend / m.leads : null,
    roas: m.spend ? m.revenue / m.spend : null,
    qualifiedRate: m.leads ? (m.qualified / m.leads) * 100 : null,
    ctr: m.impressions ? (m.clicks / m.impressions) * 100 : null,
    cpc: m.clicks ? m.spend / m.clicks : null,
    cpm: m.impressions ? (m.spend / m.impressions) * 1000 : null,
  };
}
export function assertStock(
  item: { quantity: number; reservedQuantity: number; status: string },
  units = 1,
) {
  if (
    !Number.isInteger(units) ||
    units < 1 ||
    item.quantity - item.reservedQuantity < units ||
    ["SOLD", "HIDDEN", "SERVICE_REQUIRED", "COMING_SOON"].includes(item.status)
  )
    throw new BusinessError(
      "This machine does not have enough available stock.",
    );
}
export function assertActivation(
  item: { quantity: number; reservedQuantity: number; status: string },
  campaign: { status: string; revision: number; dailyBudget: number },
  confirmation: { confirmed: boolean; revision: number; dailyBudget: number },
) {
  assertStock(item);
  if (
    !confirmation.confirmed ||
    campaign.revision !== confirmation.revision ||
    campaign.dailyBudget !== confirmation.dailyBudget
  )
    throw new BusinessError(
      "The campaign has changed. Review its latest details and confirm again.",
    );
  if (campaign.status !== "PAUSED")
    throw new BusinessError(
      "Only a completed, paused campaign can be activated.",
    );
}
export function assertBudgetChange(
  current: number,
  next: number,
  confirmed: boolean,
  max = 1000000,
) {
  if (!confirmed)
    throw new BusinessError("Confirm the budget change before applying it.");
  if (!Number.isSafeInteger(next) || next < 10000 || next > max)
    throw new BusinessError(
      `Daily budget must be between ฿100 and ฿${max / 100}.`,
    );
  if (next > current * 1.2 + 1)
    throw new BusinessError(
      "Increase the budget by no more than 20% per approval.",
    );
}
export function health(
  m: {
    impressions: number;
    spend: number;
    leads: number;
    qualified: number;
    revenue: number;
  },
  stock: number,
) {
  if (stock <= 0) return "WATCH";
  if (m.impressions < 1000 || m.leads < 5) return "INSUFFICIENT_DATA";
  if (m.revenue > m.spend * 3 && m.qualified / m.leads >= 0.25)
    return "EXCELLENT";
  if (m.qualified / m.leads >= 0.2) return "GOOD";
  if (m.spend > 200000 && m.qualified === 0) return "POOR";
  return "WATCH";
}
export function rangeFor(
  period: string,
  start?: string,
  end?: string,
  now = new Date(),
) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const day = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      7 * 3600000,
  );
  let from = new Date(day),
    to = new Date(day.getTime() + 86400000);
  if (period === "7d") from = new Date(day.getTime() - 6 * 86400000);
  else if (period === "30d") from = new Date(day.getTime() - 29 * 86400000);
  else if (period === "month")
    from = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 3600000,
    );
  else if (period === "previous") {
    from = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) -
        7 * 3600000,
    );
    to = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 3600000,
    );
  } else if (period === "custom" && start && end) {
    from = new Date(start + "T00:00:00+07:00");
    to = new Date(new Date(end + "T00:00:00+07:00").getTime() + 86400000);
  }
  if (
    !Number.isFinite(+from) ||
    !Number.isFinite(+to) ||
    from >= to ||
    +to - +from > 366 * 86400000
  )
    throw new BusinessError("Choose a valid date range of up to one year.");
  return {
    from,
    to,
    previousFrom: new Date(+from - (+to - +from)),
    previousTo: from,
  };
}
