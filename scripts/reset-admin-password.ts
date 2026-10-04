import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
if (
  !process.env.ADMIN_EMAIL ||
  !process.env.ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD.length < 12
)
  throw new Error(
    "Set ADMIN_EMAIL and a new ADMIN_PASSWORD with at least 12 characters.",
  );
const user = await db.user.findUniqueOrThrow({
  where: { email: process.env.ADMIN_EMAIL },
});
await db.account.updateMany({
  where: { userId: user.id, providerId: "credential" },
  data: { password: await hashPassword(process.env.ADMIN_PASSWORD) },
});
await db.session.deleteMany({ where: { userId: user.id } });
console.log("Administrator password reset and prior sessions revoked.");
await db.$disconnect();
