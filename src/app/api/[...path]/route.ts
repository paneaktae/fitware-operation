import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { report } from "@/lib/data";
import { BusinessError, assertStock, assertBudgetChange } from "@/lib/business";
import {
  inventorySchema,
  leadSchema,
  leadUpdateSchema,
  builderSchema,
  campaignSchema,
} from "@/lib/schemas";
import { archiveInventory } from "@/lib/inventory-operations";
import { updateLead } from "@/lib/operations";
import { refreshRecommendations } from "@/lib/ai/recommendations";
import { generateStrategy, advisor } from "@/lib/ai/service";
import { createMetaCampaign } from "@/lib/meta/campaigns";
import { campaignAction } from "@/lib/campaign-operations";
import { syncInsights } from "@/lib/meta/insights";
import { reconcileCampaign } from "@/lib/meta/reconcile";
import { storeMedia } from "@/lib/storage";
export const runtime = "nodejs";
export const maxDuration = 120;
const json = (v: unknown, status = 200) =>
  NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const parts = (await ctx.params).path;
    const [resource, id, action] = parts;
    if (resource === "cron" && id === "sync") {
      if (
        req.method !== "GET" ||
        !process.env.CRON_SECRET ||
        req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
      )
        return json({ error: "Unauthorized" }, 401);
      return json(await syncInsights());
    }
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return json({ error: "Sign in to continue." }, 401);
    const actor = session.user.email;
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (!origin || origin !== new URL(process.env.APP_URL ?? req.url).origin)
        return json(
          { error: "This request could not be verified. Refresh the page." },
          403,
        );
    }
    if (req.method === "GET") {
      if (resource === "report")
        return json(
          await report(
            req.nextUrl.searchParams.get("period") ?? "30d",
            req.nextUrl.searchParams.get("start") ?? undefined,
            req.nextUrl.searchParams.get("end") ?? undefined,
          ),
        );
      if (resource === "audit")
        return json(
          await db.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      if (resource === "media" && id && /^[0-9a-f-]+\.(webp|mp4)$/.test(id)) {
        const bytes = await readFile(
          path.join(process.cwd(), ".data", "uploads", id),
        );
        return new NextResponse(bytes, {
          headers: {
            "Content-Type": id.endsWith("mp4") ? "video/mp4" : "image/webp",
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
    if (
      resource === "inventory" &&
      id &&
      action === "media" &&
      req.method === "POST"
    ) {
      const item = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new BusinessError("Select an image or video to upload.");
      const stored = await storeMedia(file);
      const position = await db.inventoryMedia.count({
        where: { inventoryItemId: id },
      });
      return json(
        await db.inventoryMedia.create({
          data: {
            inventoryItemId: id,
            ...stored,
            position,
            alt: `${item.brand} ${item.model}`,
          },
        }),
      );
    }
    const body = req.method === "DELETE" ? {} : await req.json();
    if (resource === "inventory") {
      if (req.method === "POST" && !id) {
        const data = inventorySchema.parse(body);
        return json(await db.inventoryItem.create({ data }));
      }
      if (req.method === "PATCH" && id) {
        const data = inventorySchema.parse(body);
        return json(
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
            const before = await tx.inventoryItem.findUniqueOrThrow({
              where: { id },
            });
            if (
              typeof body.expectedUpdatedAt !== "string" ||
              new Date(body.expectedUpdatedAt).getTime() !==
                before.updatedAt.getTime()
            )
              throw new BusinessError(
                "Inventory changed since you opened this form. Close and reopen it before saving.",
              );
            const item = await tx.inventoryItem.update({ where: { id }, data });
            await tx.auditLog.create({
              data: {
                actor,
                action: "INVENTORY_UPDATED",
                entity: "InventoryItem",
                entityId: id,
                before: {
                  quantity: before.quantity,
                  askingPrice: before.askingPrice,
                  status: before.status,
                },
                after: {
                  quantity: item.quantity,
                  askingPrice: item.askingPrice,
                  status: item.status,
                },
              },
            });
            return item;
          }),
        );
      }
      if (req.method === "DELETE" && id) {
        return json(await archiveInventory(id, actor));
      }
    }
    if (resource === "media" && id && req.method === "PATCH") {
      const input = z
        .object({
          alt: z.string().max(300),
          position: z.number().int().min(0).max(100),
        })
        .parse(body);
      return json(
        await db.inventoryMedia.update({ where: { id }, data: input }),
      );
    }
    if (resource === "media" && id && req.method === "DELETE") {
      await db.inventoryMedia.delete({ where: { id } });
      return json({ ok: true });
    }
    if (resource === "generate" && req.method === "POST")
      return json(await generateStrategy(builderSchema.parse(body)));
    if (resource === "advisor" && req.method === "POST")
      return json(
        await advisor(
          z.object({ question: z.string().trim().min(1).max(2000) }).parse(body)
            .question,
        ),
      );
    if (resource === "campaigns" && req.method === "POST" && !id) {
      const input = campaignSchema.parse(body);
      const { strategy, operationKey, ...data } = input;
      const exists = await db.campaign.findUnique({ where: { operationKey } });
      if (exists) {
        if (exists.status !== "PAUSED")
          throw new BusinessError(
            "This creation request already exists and is not paused. Inspect the campaign before retrying.",
          );
        return json(exists);
      }
      assertBudgetChange(
        data.dailyBudget,
        data.dailyBudget,
        true,
        Number(process.env.MAX_DAILY_BUDGET_THB ?? 10000) * 100,
      );
      const item = await db.inventoryItem.findUniqueOrThrow({
        where: { id: data.inventoryItemId },
      });
      assertStock(item);
      const isDemo = process.env.DEMO_MODE === "true";
      const c = await db.campaign.create({
        data: {
          ...data,
          strategy,
          operationKey,
          isDemo,
          status: isDemo ? "PAUSED" : "CREATING",
          destination: isDemo
            ? "Messenger · simulated"
            : `https://m.me/${process.env.META_PAGE_ID ?? ""}`,
          cta: "MESSAGE_PAGE",
        },
      });
      try {
        if (!isDemo) {
          await createMetaCampaign(c.id);
          await db.campaign.update({
            where: { id: c.id },
            data: { status: "PAUSED" },
          });
        }
      } catch (e) {
        await db.campaign.update({
          where: { id: c.id },
          data: { status: "ERROR" },
        });
        await db.auditLog.create({
          data: {
            actor,
            action: "CAMPAIGN_CREATION_FAILED",
            entity: "Campaign",
            entityId: c.id,
            after: {
              note: "Any created Meta objects remain paused. Inspect before retrying.",
            },
          },
        });
        throw e;
      }
      await db.auditLog.create({
        data: {
          actor,
          action: "CAMPAIGN_CREATED_PAUSED",
          entity: "Campaign",
          entityId: c.id,
          after: { dailyBudget: c.dailyBudget, isDemo },
        },
      });
      return json({ ...c, status: "PAUSED" });
    }
    if (
      resource === "campaigns" &&
      id &&
      action === "reconcile" &&
      req.method === "POST"
    )
      return json(await reconcileCampaign(id, actor));
    if (resource === "campaigns" && id && req.method === "PATCH")
      return json(
        await campaignAction(
          id,
          z
            .object({
              action: z.enum(["activate", "pause", "budget"]),
              confirmed: z.literal(true),
              revision: z.number().int(),
              dailyBudget: z.number().int(),
              newBudget: z.number().int().optional(),
            })
            .parse(body),
          actor,
        ),
      );
    if (resource === "leads" && req.method === "POST") {
      const data = leadSchema.parse(body);
      if (data.campaignId) {
        const c = await db.campaign.findUniqueOrThrow({
          where: { id: data.campaignId },
        });
        if (c.inventoryItemId !== data.inventoryItemId)
          throw new BusinessError(
            "The campaign must advertise the selected machine.",
          );
      }
      if (data.adId) {
        const ad = await db.ad.findUnique({
          where: { id: data.adId },
          include: { adSet: true },
        });
        if (!ad || ad.adSet.campaignId !== data.campaignId)
          throw new BusinessError(
            "The ad must belong to the selected campaign.",
          );
      }
      return json(
        await db.lead.create({
          data: {
            ...data,
            events: { create: { type: "CREATED", message: "Lead received" } },
          },
        }),
      );
    }
    if (resource === "leads" && id && req.method === "PATCH")
      return json(await updateLead(id, leadUpdateSchema.parse(body), actor));
    if (
      resource === "recommendations" &&
      id === "refresh" &&
      req.method === "POST"
    )
      return json(await refreshRecommendations());
    if (resource === "recommendations" && id && req.method === "POST") {
      const input = z
        .object({
          decision: z.enum(["approve", "reject"]),
          confirmed: z.boolean().default(false),
        })
        .parse(body);
      const rec = await db.aIRecommendation.findUniqueOrThrow({
        where: { id },
      });
      if (rec.status !== "PENDING" || rec.expiresAt < new Date())
        throw new BusinessError("This recommendation is no longer pending.");
      if (input.decision === "reject") {
        await db.aIRecommendation.update({
          where: { id },
          data: { status: "REJECTED" },
        });
        await db.auditLog.create({
          data: {
            actor,
            action: "RECOMMENDATION_REJECTED",
            entity: "AIRecommendation",
            entityId: id,
          },
        });
        return json({ ok: true });
      }
      if (!input.confirmed)
        throw new BusinessError("Review and confirm the recommendation first.");
      if (
        rec.campaignId &&
        ["INCREASE_BUDGET", "DECREASE_BUDGET", "PAUSE_CAMPAIGN"].includes(
          rec.type,
        )
      ) {
        const c = await db.campaign.findUniqueOrThrow({
          where: { id: rec.campaignId },
        });
        if (rec.currentValue !== null && c.dailyBudget !== rec.currentValue)
          throw new BusinessError(
            "The budget changed since this recommendation. Review the campaign directly.",
          );
        // Claim prevents two concurrent approvals from executing the same recommendation.
        const claimed = await db.aIRecommendation.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
        if (!claimed.count)
          throw new BusinessError(
            "This recommendation is already being processed.",
          );
        await campaignAction(
          c.id,
          {
            action: rec.type === "PAUSE_CAMPAIGN" ? "pause" : "budget",
            confirmed: true,
            revision: c.revision,
            dailyBudget: c.dailyBudget,
            newBudget: rec.recommendedValue ?? undefined,
          },
          actor,
        );
        await db.aIRecommendation.update({
          where: { id },
          data: { status: "EXECUTED", executedAt: new Date() },
        });
      } else
        await db.aIRecommendation.update({
          where: { id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
      await db.auditLog.create({
        data: {
          actor,
          action: "RECOMMENDATION_APPROVED",
          entity: "AIRecommendation",
          entityId: id,
        },
      });
      return json({ ok: true });
    }
    if (resource === "sync" && req.method === "POST")
      return json(await syncInsights());
    if (resource === "settings" && req.method === "PATCH") {
      const data = z
        .object({
          companyName: z.string().min(1).max(100),
          currency: z.literal("THB"),
          timezone: z.literal("Asia/Bangkok"),
          defaultCountry: z.enum(["TH", "SG", "MY", "US"]),
        })
        .parse(body);
      return json(
        await db.appSetting.upsert({
          where: { id: "business" },
          create: { id: "business", ...data },
          update: data,
        }),
      );
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => i.message)
            .slice(0, 3)
            .join(" "),
        },
        400,
      );
    if (e instanceof BusinessError) return json({ error: e.message }, 400);
    console.error("Application request failed", {
      type: e instanceof Error ? e.name : "unknown",
      code: typeof e === "object" && e && "code" in e ? e.code : undefined,
    });
    return json(
      {
        error:
          "The request could not be completed. Check your connection and try again. If a live Meta change timed out, inspect its status in Meta before retrying.",
      },
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
