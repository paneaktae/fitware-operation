import "dotenv/config";
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const origin = process.env.VERIFY_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.name));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.type());
});
try {
  const demo = await page.request.post(origin + "/api/demo-login", {
    headers: { origin },
  });
  if (demo.status() !== 403)
    throw new Error("Production demo entry was not disabled.");
  await page.goto(origin + "/login");
  if (await page.getByRole("button", { name: "Explore local demo" }).count())
    throw new Error("Production page exposed demo entry.");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.ADMIN_EMAIL ?? "");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Let’s move good equipment." })
    .waitFor();
  const results = [
    "Production demo shortcut disabled",
    "Administrator password login passed",
  ];
  await page.waitForLoadState("networkidle");
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/production-desktop.png",
    fullPage: true,
    caret: "initial",
  });
  for (const route of [
    "dashboard",
    "inventory",
    "campaigns",
    "leads",
    "advisor",
    "analytics",
    "settings",
  ]) {
    await page.goto(origin + "/" + route);
    await page.locator("h1").waitFor();
    await page.waitForLoadState("networkidle");
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("Responsive overflow");
    }
    results.push(`Production ${route} desktop/mobile passed`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "test-results/production-mobile.png",
    fullPage: true,
    caret: "initial",
  });
  if (errors.length) throw new Error("Production browser reported errors.");
  await writeFile(
    "test-results/production-results.json",
    JSON.stringify({ results, consoleErrors: errors }, null, 2),
  );
  results.forEach((r) => console.log("PASS: " + r));
  console.log("Production browser verification complete: zero browser errors.");
} catch (e) {
  console.error(
    "Production verification failed:",
    e instanceof Error ? e.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
