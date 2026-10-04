import { db } from "./db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertStock, BusinessError } from "./business";
import { leadUpdateSchema } from "./schemas";
export async function updateLead(
  id: string,
  input: z.infer<typeof leadUpdateSchema>,
  actor: string,
) {
  return db.$transaction(
    async (tx) => {
      // Lock before reading; repeated/concurrent Won requests cannot duplicate a sale.
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead = await tx.lead.findUniqueOrThrow({
        where: { id },
        include: { sale: true },
      });
      if (lead.sale && input.status !== "WON")
        throw new BusinessError(
          "A recorded sale cannot be moved to another stage. Correct its revenue instead.",
        );
      if (input.status === "WON") {
        if (input.revenue === undefined || input.revenue <= 0)
          throw new BusinessError("Enter the actual sale revenue.");
        if (!lead.sale) {
          await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${lead.inventoryItemId} FOR UPDATE`;
          const item = await tx.inventoryItem.findUniqueOrThrow({
            where: { id: lead.inventoryItemId },
          });
          assertStock(item, input.quantity);
          await tx.sale.create({
            data: {
              leadId: id,
              inventoryItemId: lead.inventoryItemId,
              campaignId: lead.campaignId,
              adId: lead.adId,
              revenue: input.revenue,
              quantity: input.quantity,
            },
          });
          const quantity = item.quantity - input.quantity;
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantity, status: quantity === 0 ? "SOLD" : item.status },
          });
          await tx.auditLog.create({
            data: {
              actor,
              action: "INVENTORY_STOCK_CHANGED",
              entity: "InventoryItem",
              entityId: item.id,
              before: { quantity: item.quantity },
              after: { quantity },
            },
          });
        } else {
          await tx.sale.update({
            where: { leadId: id },
            data: { revenue: input.revenue },
          });
        }
      }
      const qualified = ["QUALIFIED", "NEGOTIATION", "WON"].includes(
        input.status,
      );
      const updated = await tx.lead.update({
        where: { id },
        data: {
          status: input.status,
          actualRevenue: input.status === "WON" ? input.revenue : undefined,
          qualifiedAt: qualified ? (lead.qualifiedAt ?? new Date()) : undefined,
          lastContactedAt:
            input.status === "CONTACTED" ? new Date() : undefined,
          lossReason: input.lossReason,
          events: {
            create: {
              type: lead.status === input.status ? "NOTE" : "STATUS",
              message: input.note || `${lead.status} → ${input.status}`,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actor,
          action:
            input.status === "WON"
              ? lead.sale
                ? "REVENUE_EDITED"
                : "LEAD_WON"
              : "LEAD_UPDATED",
          entity: "Lead",
          entityId: id,
          before: { status: lead.status, revenue: lead.actualRevenue },
          after: { status: updated.status, revenue: updated.actualRevenue },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
