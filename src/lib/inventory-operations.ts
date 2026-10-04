import { db } from "./db";
import { BusinessError } from "./business";
export async function archiveInventory(id: string, actor: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
    if (
      await tx.campaign.count({
        where: {
          inventoryItemId: id,
          status: { in: ["ACTIVE", "ERROR", "CREATING"] },
        },
      })
    )
      throw new BusinessError(
        "Pause active campaigns and resolve uncertain Meta operations before archiving this machine.",
      );
    const item = await tx.inventoryItem.update({
      where: { id },
      data: { status: "HIDDEN" },
    });
    await tx.auditLog.create({
      data: {
        actor,
        action: "INVENTORY_ARCHIVED",
        entity: "InventoryItem",
        entityId: id,
      },
    });
    return item;
  });
}
