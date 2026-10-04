import { z } from "zod";
const amount = z.number().int().min(0).max(2000000000);
export const inventorySchema = z
  .object({
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    series: z.string().max(80).default(""),
    category: z.string().max(80).default("Strength"),
    machineType: z.string().max(80).default("Commercial"),
    condition: z.string().max(80).default("Refurbished"),
    conditionScore: z.number().int().min(0).max(100),
    manufactureYear: z.number().int().min(1970).max(2100).nullable().optional(),
    quantity: z.number().int().min(0).max(10000),
    reservedQuantity: z.number().int().min(0).max(10000),
    purchaseCost: amount,
    askingPrice: amount,
    minimumPrice: amount,
    location: z.string().max(200),
    description: z.string().max(5000),
    internalNotes: z.string().max(5000).default(""),
    status: z.enum([
      "AVAILABLE",
      "RESERVED",
      "SOLD",
      "COMING_SOON",
      "SERVICE_REQUIRED",
      "HIDDEN",
    ]),
  })
  .refine((x) => x.reservedQuantity <= x.quantity, {
    message: "Reserved stock cannot exceed quantity.",
  })
  .refine((x) => x.minimumPrice <= x.askingPrice, {
    message: "Minimum price cannot exceed asking price.",
  });
export const strategySchema = z.object({
  objective: z.string(),
  structure: z.string(),
  angles: z.array(z.string()).min(3).max(5),
  primaryTexts: z.array(z.string()).min(5).max(8),
  headlines: z.array(z.string()).min(5).max(8),
  descriptions: z.array(z.string()).min(3).max(5),
  cta: z.string(),
  audience: z.string(),
  budgetGuidance: z.string(),
  optimization: z.string(),
  reasoning: z.string(),
});
export const builderSchema = z.object({
  inventoryItemId: z.string(),
  goal: z.enum(["Messages", "Leads"]),
  dailyBudget: z.number().int().min(10000).max(1000000),
  country: z.enum(["TH", "SG", "MY", "US"]),
  language: z.enum(["English", "Thai", "Thai + English"]),
  instructions: z.string().max(2000).default(""),
});
export const campaignSchema = builderSchema.extend({
  name: z.string().min(1).max(200),
  audience: z.string().min(1).max(2000),
  primaryText: z.string().min(1).max(5000),
  headline: z.string().min(1).max(300),
  description: z.string().max(1000),
  strategy: strategySchema,
  operationKey: z.string().uuid(),
});
export const leadSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z.string().max(50).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  source: z.string().max(80).default("Facebook Ads"),
  inventoryItemId: z.string(),
  campaignId: z.string().nullable().optional(),
  adId: z.string().nullable().optional(),
  estimatedValue: amount,
  notes: z.string().max(5000).default(""),
});
export const leadUpdateSchema = z.object({
  status: z.enum([
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "NEGOTIATION",
    "WON",
    "LOST",
  ]),
  revenue: amount.optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  note: z.string().max(5000).default(""),
  lossReason: z.string().max(2000).default(""),
});
