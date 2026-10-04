import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDB = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDB.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL || process.env.ftw_DATABASE_URL,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDB.prisma = db;
