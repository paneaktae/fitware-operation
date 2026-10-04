import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      process.env.ftw_DATABASE_URL_UNPOOLED ||
      process.env.ftw_DATABASE_URL ||
      "postgresql://fitware:fitware@127.0.0.1:55432/fitware",
  },
});
