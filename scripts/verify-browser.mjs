import sharp from "sharp";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const origin = "http://127.0.0.1:3000";
const stamp = Date.now();
const name = `Verification Press ${stamp}`;
const checks = [];
function ok(name) {
  checks.push(name);
  console.log(`PASS: ${name}`);
}
await mkdir("test-results", { recursive: true });
try {
  await page.goto(origin + "/login");
  await page.getByRole("button", { name: "Explore local demo" }).click();
  await page
    .getByRole("heading", { name: "Let’s move good equipment." })
    .waitFor();
  ok("Local demo login and dashboard");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
    caret: "initial",
  });
  for (const width of [375, 390, 430, 1440]) {
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
      throw new Error(`Dashboard overflow at ${width}`);
  }
  ok("Dashboard widths 375, 390, 430, 1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
    caret: "initial",
  });
  await page.goto(origin + "/inventory");
  await page.getByRole("button", { name: "Add machine", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Brand", { exact: true }).fill("Test Brand");
  await dialog.getByLabel("Model", { exact: true }).fill(name);
  await dialog.getByLabel("Asking Price (THB)", { exact: true }).fill("95000");
  await dialog.getByLabel("Quantity", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Save machine" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByLabel("Search inventory").fill(name);
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name }) })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: `Test Brand ${name}` }).waitFor();
  ok("Inventory add and detail");
  // Upload a real tiny PNG through the file input and verify its persisted render.
  const png = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#ddebba" },
  })
    .png()
    .toBuffer();
  await dialog.locator("input[type=file]").setInputFiles({
    name: "verification.png",
    mimeType: "image/png",
    buffer: png,
  });
  await dialog.locator(".media-row img").waitFor();
  ok("Image upload and persisted media");
  await dialog
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Generate demo strategy" }).click();
  await dialog.getByLabel("Edit primary text").waitFor();
  await dialog
    .getByLabel("Edit primary text")
    .fill("Test Brand verified equipment. Ask for details.");
  await dialog
    .getByRole("button", { name: "Review campaign", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create paused campaign", exact: true })
    .click();
  await dialog.getByText("Created. Paused. In your control.").waitFor();
  await dialog.getByRole("button", { name: "Review in Campaigns" }).click();
  await page.getByRole("heading", { name: "Campaigns", exact: true }).waitFor();
  ok("Generate, edit, review and create PAUSED demo campaign");
  await page.getByLabel("Search campaigns").fill(name);
  await page.locator(".campaign-card").first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Review & activate" }).click();
  const confirm = page.getByRole("dialog", {
    name: "Final review · activate campaign",
  });
  if (
    await confirm
      .getByRole("button", { name: "Approve & activate" })
      .isEnabled()
  )
    throw new Error("Activation did not require confirmation");
  await confirm.getByRole("checkbox").check();
  await confirm.getByRole("button", { name: "Approve & activate" }).click();
  await confirm.waitFor({ state: "hidden" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Pause campaign", exact: true })
    .waitFor();
  ok("Explicit activation confirmation required and applied");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.goto(origin + "/leads");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Buyer / business name")
    .fill(`Verification Buyer ${stamp}`);
  await dialog
    .getByLabel("Interested machine")
    .selectOption({ label: `Test Brand ${name}` });
  await dialog
    .getByLabel("Campaign", { exact: true })
    .selectOption({ label: `Test Brand ${name} · Messages` });
  await dialog.getByLabel("Estimated value (THB)").fill("95000");
  await dialog.getByRole("button", { name: "Save lead" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByLabel("Search leads").fill(`Verification Buyer ${stamp}`);
  await page.locator(".lead-row").first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Qualified", exact: true }).click();
  await page.getByText("Lead updated.", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Record a sale" }).click();
  const sale = page.getByRole("dialog", { name: "Record a won sale" });
  await sale.getByLabel("Actual revenue (THB)").fill("90000");
  await sale.getByRole("button", { name: "Confirm sale & revenue" }).click();
  await sale.waitFor({ state: "hidden" });
  await page
    .getByRole("dialog")
    .getByText("Actual revenue", { exact: true })
    .waitFor();
  ok("Lead creation, qualification, Won sale and revenue attribution");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.goto(origin + "/advisor");
  await page
    .getByRole("button", { name: "เดือนนี้ตัวไหนยิงแอดดีที่สุด" })
    .click();
  await page
    .locator(".chat-message.assistant")
    .filter({ hasText: "Demo analyst" })
    .waitFor();
  if (
    !(await page.locator(".chat-message.assistant").innerText()).includes(
      "เดือนนี้",
    )
  )
    throw new Error("Advisor missing reporting period");
  ok("Thai advisor answer from saved application records");
  for (const route of [
    "inventory",
    "campaigns",
    "leads",
    "analytics",
    "settings",
  ]) {
    await page.goto(origin + "/" + route);
    await page.locator("h1").waitFor();
    await page.waitForLoadState("networkidle");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`${route} mobile overflow`);
    await page.screenshot({
      path: `test-results/${route}-mobile.png`,
      fullPage: true,
      caret: "initial",
    });
  }
  ok("All core pages render at 390 px without overflow");
  await page.getByRole("button", { name: "Load latest activity" }).click();
  await page.locator(".audit-row").first().waitFor();
  ok("Audit history");
  const unauthed = await browser.newContext();
  const noauth = await unauthed.request.get(origin + "/api/report");
  if (noauth.status() !== 401)
    throw new Error("Unauthenticated API not blocked");
  await unauthed.close();
  ok("API requires authentication");
  const badOrigin = await page.request.patch(origin + "/api/settings", {
    headers: { origin: "https://untrusted.example" },
    data: { companyName: "Changed" },
  });
  if (badOrigin.status() !== 403)
    throw new Error("Cross-origin mutation not blocked");
  ok("Cross-origin mutation rejected");
  await writeFile(
    "test-results/browser-results.json",
    JSON.stringify({ checks, errors, stamp, name }, null, 2),
  );
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log("Browser verification complete.");
} catch (e) {
  await page.screenshot({ path: "test-results/failure.png", fullPage: true });
  await writeFile(
    "test-results/browser-failure.txt",
    `${e.stack}\n${await page.locator("body").innerText()}`,
  );
  throw e;
} finally {
  await browser.close();
}
