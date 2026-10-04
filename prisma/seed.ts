import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters.",
  );
await db.user.upsert({
  where: { email },
  create: { id: "owner", email, name: "Fitware Owner", emailVerified: true },
  update: {},
});
await db.account.upsert({
  where: { id: "owner-credential" },
  create: {
    id: "owner-credential",
    userId: "owner",
    accountId: "owner",
    providerId: "credential",
    password: await hashPassword(password),
  },
  update: {},
});
await db.appSetting.upsert({
  where: { id: "business" },
  create: { id: "business" },
  update: {},
});
await db.integration.upsert({
  where: { id: "meta" },
  create: { id: "meta", status: "DISCONNECTED" },
  update: {},
});
if (process.env.DEMO_MODE !== "true") {
  console.log("Administrator created; demo records skipped.");
  await db.$disconnect();
  process.exit(0);
}
if (await db.inventoryItem.count()) {
  console.log("Seed skipped: inventory already exists.");
  await db.$disconnect();
  process.exit(0);
}
const machines = [
  ["Cybex", "Leg Press", "VR3", 95000, 62000, 2],
  ["Life Fitness", "Chest Press", "Signature", 75000, 45000, 1],
  ["Matrix", "Smith Machine", "G3", 90000, 58000, 4],
  ["Precor", "Lat Pulldown", "Discovery", 65000, 41000, 0],
  ["Hammer Strength", "Incline Press", "Iso-Lateral", 85000, 52000, 2],
  ["Life Fitness", "Treadmill", "95T", 120000, 80000, 1],
] as const;
for (const [i, m] of machines.entries())
  await db.inventoryItem.create({
    data: {
      id: `machine-${i + 1}`,
      brand: m[0],
      model: m[1],
      series: m[2],
      askingPrice: m[3] * 100,
      minimumPrice: (m[3] - 10000) * 100,
      purchaseCost: m[4] * 100,
      quantity: m[5],
      status: m[5] ? "AVAILABLE" : "SOLD",
      category: i === 5 ? "Cardio" : "Strength",
      condition: "Refurbished",
      conditionScore: 90 - i * 2,
      description:
        "Used commercial gym equipment. Contact the team for a condition report and current delivery options.",
      location: "Bangkok warehouse",
      createdAt: new Date(Date.now() - (50 + i) * 86400000),
    },
  });
const budgets = [500, 400, 300, 350, 400, 600],
  dailySpend = [280, 180, 100, 120, 160, 300];
for (let i = 0; i < 6; i++) {
  const m = machines[i];
  await db.campaign.create({
    data: {
      id: `campaign-${i + 1}`,
      name: `${m[0]} ${m[2]} · ${i === 0 ? "Gym owners" : i === 2 ? "New gym launch" : "Enquiries"}`,
      inventoryItemId: `machine-${i + 1}`,
      status: i === 2 ? "PAUSED" : "ACTIVE",
      dailyBudget: budgets[i] * 100,
      audience: "Commercial gym buyers in Thailand · broad adult audience",
      destination: "Messenger · simulated",
      primaryText: `Explore the ${m[0]} ${m[2]} ${m[1]} at ฿${m[3].toLocaleString()}. Message us for condition details and availability.`,
      headline: `${m[0]} ${m[1]}`,
      description: "Request photos and a quotation.",
      isDemo: true,
      createdAt: new Date(Date.now() - 45 * 86400000),
    },
  });
  for (let d = 0; d < 60; d++) {
    const date = new Date(Date.now() + 7 * 3600000 - d * 86400000)
      .toISOString()
      .slice(0, 10);
    const spend =
      i === 2 && d < 4
        ? 0
        : Math.round(dailySpend[i] * (0.72 + ((d * 7) % 13) / 25) * 100);
    await db.campaignMetric.create({
      data: {
        campaignId: `campaign-${i + 1}`,
        date: new Date(date),
        spend,
        impressions: Math.round(spend / 3),
        reach: Math.round(spend / 6),
        clicks: Math.round(spend / (i === 5 ? 120 : 65)),
        messages: d % 3 === 0 ? 3 : 1,
        platformLeads: d % 3 === 0 ? 2 : 0,
      },
    });
  }
}
const names = [
  "Somchai Fitness",
  "Iron House Bangkok",
  "Narin Training Studio",
  "Peak Performance",
  "Krit Wellness",
  "Bangna Strength",
  "The Movement Club",
  "Pat Fitness",
  "Urban Gym",
  "Siri Active",
  "Northside Fitness",
  "Phuket Training",
];
for (let n = 0; n < 72; n++) {
  const i = n % 6;
  const qualified = i === 0 ? n % 3 === 0 : i === 5 ? false : n % 5 === 0;
  const won = [0, 6, 10, 13].includes(n);
  const day = n < 36 ? Math.floor(n / 2) : 30 + Math.floor((n - 36) / 2);
  const date = new Date(Date.now() - day * 86400000 - 3600000);
  const status = won
    ? "WON"
    : qualified
      ? "QUALIFIED"
      : n % 4 === 0
        ? "CONTACTED"
        : n % 7 === 0
          ? "NEGOTIATION"
          : "NEW";
  const revenue = won ? (i === 0 ? 92500 : machines[i][3]) * 100 : 0;
  await db.lead.create({
    data: {
      id: `lead-${n + 1}`,
      name: `${names[n % names.length]}${n >= 12 ? ` ${Math.floor(n / 12) + 1}` : ""}`,
      inventoryItemId: `machine-${i + 1}`,
      campaignId: `campaign-${i + 1}`,
      status,
      phone: "",
      source: "Facebook Ads",
      estimatedValue: machines[i][3] * 100,
      actualRevenue: revenue,
      qualifiedAt: qualified || won ? date : null,
      createdAt: date,
      notes: "Demo contact — replace with your real buyer details.",
      events: {
        create: [
          {
            type: "CREATED",
            message: "Lead received from Facebook Ads",
            createdAt: date,
          },
          ...(qualified
            ? [
                {
                  type: "STATUS",
                  message: "Qualified: buyer confirmed product interest",
                  createdAt: new Date(+date + 600000),
                },
              ]
            : []),
        ],
      },
      ...(won
        ? {
            sale: {
              create: {
                inventoryItemId: `machine-${i + 1}`,
                campaignId: `campaign-${i + 1}`,
                revenue,
                soldAt: date,
              },
            },
          }
        : {}),
    },
  });
}
const recs = [
  {
    id: "rec-1",
    type: "GENERATE_CREATIVE",
    title: "Refresh the treadmill creative",
    description:
      "Try a new price-focused message before considering more budget.",
    reason:
      "The last 30 days show spend without qualified enquiries. Test a different angle; do not increase the budget yet.",
    campaignId: "campaign-6",
    inventoryItemId: "machine-6",
  },
  {
    id: "rec-2",
    type: "PAUSE_CAMPAIGN",
    title: "Sold out, but still advertised",
    description:
      "Precor Lat Pulldown has no available units. Review and pause its campaign.",
    reason: "Remaining stock is zero while the demo campaign is active.",
    campaignId: "campaign-4",
    inventoryItemId: "machine-4",
  },
  {
    id: "rec-3",
    type: "PROMOTE_INVENTORY",
    title: "Put your Matrix stock to work",
    description:
      "Four Smith Machines are available. Consider a small, controlled campaign test.",
    reason:
      "There is stock to sell and the current campaign is paused. Results are not yet sufficient for a budget increase.",
    campaignId: "campaign-3",
    inventoryItemId: "machine-3",
  },
];
for (const r of recs)
  await db.aIRecommendation.create({
    data: { ...r, expiresAt: new Date(Date.now() + 14 * 86400000) },
  });
await db.auditLog.create({
  data: {
    actor: email,
    action: "DEMO_DATA_SEEDED",
    entity: "Application",
    entityId: "demo",
    after: { note: "All campaigns, contacts and metrics are simulated." },
  },
});
console.log(
  "Demo inventory, campaign history, CRM, sales and recommendations seeded.",
);
await db.$disconnect();
