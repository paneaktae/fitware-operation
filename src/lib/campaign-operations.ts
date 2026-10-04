import { db } from "./db";
import {
  assertActivation,
  assertBudgetChange,
  assertStock,
  BusinessError,
} from "./business";
import { changeMetaBudget, changeMetaStatus } from "./meta/campaigns";
export async function campaignAction(
  id: string,
  input: {
    action: "activate" | "pause" | "budget";
    confirmed: boolean;
    revision: number;
    dailyBudget: number;
    newBudget?: number;
  },
  actor: string,
) {
  // Serialize changes to this campaign through a row lock, including the external request.
  // Unknown network outcomes are reconciled by a human; never automatically retry a spend mutation.
  const existing = await db.campaign.findUniqueOrThrow({ where: { id } });
  if (!existing.isDemo)
    await db.auditLog.create({
      data: {
        actor,
        action: "META_CHANGE_REQUESTED",
        entity: "Campaign",
        entityId: id,
        after: { action: input.action, reviewedRevision: input.revision },
      },
    });
  let externalAttempted = false;
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
        const c = await tx.campaign.findUniqueOrThrow({
          where: { id },
          include: { inventoryItem: true },
        });
        if (
          !input.confirmed ||
          input.revision !== c.revision ||
          input.dailyBudget !== c.dailyBudget
        )
          throw new BusinessError(
            "Review the current campaign and confirm the change again.",
          );
        await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${c.inventoryItemId} FOR UPDATE`;
        const currentStock = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: c.inventoryItemId },
        });
        if (input.action === "activate") {
          assertActivation(currentStock, c, input);
          assertBudgetChange(
            c.dailyBudget,
            c.dailyBudget,
            input.confirmed,
            Number(process.env.MAX_DAILY_BUDGET_THB ?? 10000) * 100,
          );
          externalAttempted = !c.isDemo;
          await changeMetaStatus(id, "ACTIVE");
        }
        if (input.action === "pause") {
          if (c.status !== "ACTIVE")
            throw new BusinessError("Only an active campaign can be paused.");
          externalAttempted = !c.isDemo;
          await changeMetaStatus(id, "PAUSED");
        }
        if (input.action === "budget") {
          if (!["ACTIVE", "PAUSED"].includes(c.status))
            throw new BusinessError(
              "Reconcile the campaign before changing its budget.",
            );
          assertStock(currentStock);
          assertBudgetChange(
            c.dailyBudget,
            input.newBudget!,
            input.confirmed,
            Number(process.env.MAX_DAILY_BUDGET_THB ?? 10000) * 100,
          );
          externalAttempted = !c.isDemo;
          await changeMetaBudget(id, input.newBudget!);
        }
        const next = await tx.campaign.update({
          where: { id },
          data: {
            status:
              input.action === "activate"
                ? "ACTIVE"
                : input.action === "pause"
                  ? "PAUSED"
                  : c.status,
            dailyBudget:
              input.action === "budget" ? input.newBudget : c.dailyBudget,
            revision: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            actor,
            action: `CAMPAIGN_${input.action.toUpperCase()}`,
            entity: "Campaign",
            entityId: id,
            before: {
              status: c.status,
              dailyBudget: c.dailyBudget,
              revision: c.revision,
            },
            after: {
              status: next.status,
              dailyBudget: next.dailyBudget,
              revision: next.revision,
            },
          },
        });
        return next;
      },
      { timeout: 120000, maxWait: 5000 },
    );
  } catch (error) {
    if (externalAttempted) {
      await db.campaign.update({
        where: { id },
        data: { status: "ERROR", revision: { increment: 1 } },
      });
      await db.auditLog.create({
        data: {
          actor,
          action: "META_CHANGE_REQUIRES_RECONCILIATION",
          entity: "Campaign",
          entityId: id,
          after: {
            note: "External outcome may be uncertain. Read Meta status before retrying.",
          },
        },
      });
    }
    throw error;
  }
}
