import { spawnSync } from "node:child_process";

// Explicit one-time release step; never creates demo business records.
if (process.env.FITWARE_BOOTSTRAP === "true") {
  if (process.env.VERCEL_ENV !== "production")
    throw new Error("Bootstrap is restricted to the production release.");
  if (!(process.env.DATABASE_URL || process.env.ftw_DATABASE_URL))
    throw new Error("A managed database connection is required.");
  if (
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 16
  )
    throw new Error("Administrator credentials are required for bootstrap.");
  for (const task of ["db:migrate", "db:seed"]) {
    const result = spawnSync("npm", ["run", task], {
      stdio: "inherit",
      env: { ...process.env, DEMO_MODE: "false" },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
