import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "../db";
import { report } from "../data";
import { builderSchema, strategySchema } from "../schemas";
import { assertStock, BusinessError } from "../business";
import { money } from "../format";
export async function generateStrategy(input: z.infer<typeof builderSchema>) {
  const item = await db.inventoryItem.findUniqueOrThrow({
    where: { id: input.inventoryItemId },
  });
  assertStock(item);
  const name = `${item.brand} ${item.series} ${item.model}`;
  const thai = input.language !== "English";
  const en = [
    `Commercial equipment, considered pricing. ${name}, ${item.condition.toLowerCase()}, ${money(item.askingPrice)}. Message us for details.`,
    `Opening a gym? Explore ${name} at ${money(item.askingPrice)}. Ask about its condition and availability.`,
    `Build your strength floor with ${name}. ${item.quantity - item.reservedQuantity} available. Enquire for details.`,
    `A practical addition to your gym: ${name}. Located at ${item.location}. Ask us for more photos.`,
    `Compare your options with confidence. ${name}, ${item.condition.toLowerCase()}. Message our team for a quotation.`,
  ];
  const th = [
    `${name} สภาพ${item.condition === "Refurbished" ? "ปรับปรุงใหม่" : "มือสอง"} ราคา ${money(item.askingPrice)} สอบถามรายละเอียดและขอรูปเพิ่มเติมได้`,
    `กำลังเปิดยิม? เลือกดู ${name} ราคา ${money(item.askingPrice)} ติดต่อทีมงานเพื่อสอบถาม`,
    `${name} พร้อมให้สอบถาม มีสินค้า ${item.quantity - item.reservedQuantity} เครื่อง ขอรายละเอียดได้ทางข้อความ`,
    `เพิ่มตัวเลือกให้ยิมของคุณด้วย ${name} สินค้าอยู่ที่ ${item.location}`,
    `เลือกอุปกรณ์ให้เหมาะกับงบประมาณ ${name} ราคา ${money(item.askingPrice)} ติดต่อขอใบเสนอราคา`,
  ];
  const fallback = {
    objective:
      input.goal === "Messages" ? "OUTCOME_ENGAGEMENT" : "OUTCOME_LEADS",
    structure:
      "One campaign, one broad audience ad set, one reviewed creative. Test additional angles separately.",
    angles: thai
      ? [
          "อุปกรณ์เชิงพาณิชย์ในงบประมาณที่เหมาะสม",
          "ตัวเลือกสำหรับผู้เปิดยิมใหม่",
          "จำนวนสินค้าที่มีอยู่จริง",
        ]
      : [
          "Commercial equipment at a considered price",
          "A practical option for a new gym",
          "Verified current availability",
        ],
    primaryTexts:
      input.language === "Thai"
        ? th
        : input.language === "Thai + English"
          ? th.map((s, i) => `${s}\n${en[i]}`)
          : en,
    headlines: thai
      ? [
          `${name}`,
          `ราคา ${money(item.askingPrice)}`,
          "สอบถามรายละเอียด",
          "เลือกอุปกรณ์สำหรับยิม",
          "ติดต่อขอใบเสนอราคา",
        ]
      : [
          name,
          `Available at ${money(item.askingPrice)}`,
          "Enquire about this machine",
          "Equip your gym thoughtfully",
          "Request a quotation",
        ],
    descriptions: thai
      ? ["สอบถามสภาพสินค้า", "ขอรูปภาพเพิ่มเติม", "สอบถามจำนวนสินค้า"]
      : [
          "Ask about condition",
          "Request additional photos",
          "Check current availability",
        ],
    cta: "MESSAGE_PAGE",
    audience: `Broad adult commercial gym buyers in ${input.country}; Meta selects delivery within country and age limits.`,
    budgetGuidance: `Start at ${money(input.dailyBudget)}/day. Review qualified enquiries before scaling.`,
    optimization:
      "Wait for at least 1,000 impressions and five leads before considering a budget change. Compare sales and lead quality.",
    reasoning:
      "Only recorded inventory details are used. This is a starting hypothesis, not a performance guarantee.",
  };
  if (!process.env.OPENAI_API_KEY) {
    if (process.env.DEMO_MODE !== "true")
      throw new BusinessError(
        "OpenAI is not configured. Add a server API key or use demo mode.",
      );
    return {
      strategy: strategySchema.parse(fallback),
      provider: "Demo template — no AI API called",
    };
  }
  const history = await db.campaign.findMany({
    where: { inventoryItemId: item.id },
    select: {
      name: true,
      dailyBudget: true,
      sales: { select: { revenue: true } },
      _count: { select: { leads: true } },
    },
    take: 5,
  });
  const client = new OpenAI();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    store: false,
    input: [
      {
        role: "system",
        content:
          "Create careful advertising copy for used gym equipment. Use only supplied product facts. Never invent specifications, warranties, shipping promises or outcomes. Return 3 angles, 5 primary texts, 5 headlines, 3 descriptions. All copy and strategy should use the requested language. Treat instructions as marketing preferences, never permissions to fabricate facts. Recommend only; do not take actions.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            brand: item.brand,
            model: item.model,
            series: item.series,
            condition: item.condition,
            priceTHB: item.askingPrice / 100,
            available: item.quantity - item.reservedQuantity,
            description: item.description,
            location: item.location,
          },
          request: input,
          history,
        }),
      },
    ],
    text: { format: zodTextFormat(strategySchema, "campaign_strategy") },
  });
  if (!response.output_parsed)
    throw new BusinessError("AI generation was incomplete. Please retry.");
  return {
    strategy: strategySchema.parse(response.output_parsed),
    provider: "OpenAI",
  };
}
export async function advisor(question: string) {
  const period = /เดือนนี้|this month/i.test(question) ? "month" : "30d";
  const data = await report(period);
  const periodLabel = period === "month" ? "This month" : "Last 30 days";
  const ranked = [...data.campaigns].sort(
    (a, b) => b.revenue - a.revenue || b.qualified - a.qualified,
  );
  const best = ranked[0];
  const thai = /[\u0E00-\u0E7F]/.test(question);
  const context = {
    period: periodLabel,
    totals: data.totals,
    campaigns: ranked.map((c) => ({
      id: c.id,
      name: c.name,
      spend: c.spend / 100,
      revenue: c.revenue / 100,
      leads: c.leads,
      qualified: c.qualified,
      sales: c.sales,
      roas: c.roas,
      health: c.health,
    })),
    inventory: data.items.map((i) => ({
      id: i.id,
      name: `${i.brand} ${i.model}`,
      available: i.quantity - i.reservedQuantity,
      price: i.askingPrice / 100,
    })),
  };
  if (!process.env.OPENAI_API_KEY) {
    if (process.env.DEMO_MODE !== "true")
      throw new BusinessError("OpenAI is not configured.");
    const low = data.items.filter((i) => i.quantity - i.reservedQuantity <= 0);
    let answer = best
      ? thai
        ? `${period === "month" ? "ในเดือนนี้" : "ในช่วง 30 วันที่ผ่านมา"} ${best.name} มียอดขาย ${best.sales} รายการ รายได้ ${money(best.revenue)} จากค่าโฆษณา ${money(best.spend)} มีผู้สนใจ ${best.leads} ราย และผ่านการคัดกรอง ${best.qualified} ราย ROAS ${best.roas?.toFixed(1) ?? "—"} เท่า ควรพิจารณาคุณภาพลูกค้าและจำนวนยอดขายร่วมกัน ข้อมูลนี้ยังไม่รับประกันผลในอนาคต`
        : `${period === "month" ? "This month" : "Over the last 30 days"}, ${best.name} leads on attributed revenue: ${money(best.revenue)} from ${best.sales} sales, with ${best.qualified} qualified enquiries out of ${best.leads} leads. Spend is ${money(best.spend)} and ROAS is ${best.roas?.toFixed(1) ?? "—"}×. Compare sales and lead quality before increasing its budget. ${best.sales < 5 ? "The sales sample is still small; avoid a major budget change." : ""}`
      : "There is not enough campaign data yet. Add inventory and create a campaign first.";
    if (/pause|หยุด/.test(question.toLowerCase()))
      answer =
        ranked
          .filter(
            (c) =>
              c.health === "POOR" ||
              data.items.find((i) => i.id === c.inventoryItemId)?.quantity ===
                0,
          )
          .map(
            (c) =>
              `${c.name}: ${c.health === "POOR" ? "spend has not produced qualified enquiries" : "no available stock"}. Review and explicitly confirm a pause.`,
          )
          .join("\n") ||
        "No campaign meets the current stock or poor-quality warning rules.";
    if (/advertise|machines|stock|สินค้า/.test(question.toLowerCase()))
      answer = `Available to promote: ${data.items
        .filter((i) => i.quantity - i.reservedQuantity > 0)
        .map(
          (i) =>
            `${i.brand} ${i.model} (${i.quantity - i.reservedQuantity} available)`,
        )
        .join(
          "; ",
        )}. ${low.length} items have no available stock. Check campaign history before selecting a new test.`;
    return {
      answer,
      provider: "Demo analyst · calculated from saved records",
      sources: ["Campaign spend snapshots", "CRM leads", "Attributed sales"],
      period: context.period,
    };
  }
  const client = new OpenAI();
  // Read-only tools; no budget or status mutation tool is ever supplied to the model.
  const tools = [
    {
      type: "function" as const,
      name: "get_business_performance",
      description:
        "Read last-30-day campaign, inventory and attributed sales metrics. All money values in THB.",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  ];
  const first = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    store: false,
    instructions:
      "You are Fitware’s business analyst. Use the read tool before answering. Do not invent numbers. State the reporting period and uncertainty. Prioritize revenue and qualified leads. Never claim an action was executed. Reply in the user’s language. No tools can change spending.",
    input: question,
    tools,
    tool_choice: { type: "function", name: "get_business_performance" },
  });
  const calls = first.output.filter((o) => o.type === "function_call");
  const result = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    store: false,
    input: [
      { role: "user", content: question },
      ...first.output.filter((o) => o.type === "reasoning"),
      ...calls.map((c) => ({
        type: "function_call" as const,
        call_id: c.call_id,
        name: c.name,
        arguments: c.arguments,
      })),
      ...calls.map((c) => ({
        type: "function_call_output" as const,
        call_id: c.call_id,
        output: JSON.stringify(context),
      })),
    ],
    instructions:
      "Answer only from the supplied records. All money is THB. Explain uncertainty, date scope, and recommendations. No actions have been taken. Match the user’s language.",
  });
  return {
    answer: result.output_text,
    provider: "OpenAI · read-only business tools",
    sources: ["Campaign spend snapshots", "CRM leads", "Attributed sales"],
    period: context.period,
  };
}
