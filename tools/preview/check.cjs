const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { chromium } = require(
  runtimeModules ? runtimeModules + "/playwright" : "playwright",
);
const path = require("path");
const fs = require("fs");
const chrome = require("@sparticuz/chromium").default;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PREVIEW_CHROMIUM_PATH,
    args: chrome.args,
  });
  const page = await browser.newPage({
    viewport: { width: 736, height: 1000 },
  });
  const artifactDir =
    process.env.PREVIEW_ARTIFACT_DIR || path.join(__dirname, "artifacts");
  const previewPath =
    process.argv[2] ||
    path.resolve(__dirname, "../../docs/design-preview.html");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("file://" + previewPath);
  await page.waitForTimeout(400);
  fs.mkdirSync(artifactDir, { recursive: true });
  const pages = await page
    .locator("#sp-screen option")
    .evaluateAll((nodes) => nodes.map((n) => n.value));
  for (const width of [736, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const id of pages) {
      await page.locator("#sp-screen").selectOption(id);
      await page.waitForTimeout(350);
      console.log("render", width, id);
      if ((await page.locator(".sp-phone").innerText()) === "")
        throw new Error("Blank screen: " + id);
      const bounds = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      if (bounds.scroll > bounds.width + 1)
        throw new Error("Overflow " + id + ": " + JSON.stringify(bounds));
      if (width === 736)
        await page.screenshot({
          path: path.join(artifactDir, `${id}.png`),
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 736, height: 1000 });
  await page.locator("#sp-screen").selectOption("question");
  await page
    .getByRole("radio", { name: "B. Mitochondrion", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check my answer", exact: true })
    .click();
  await page.getByText("That’s one more", { exact: false }).waitFor();
  await page.locator("#sp-screen").selectOption("feedback-wrong");
  await page
    .getByRole("radio", { name: "I misread the question", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Mistake reflection note" })
    .fill("Read every qualifier before answering.");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reflection saved", exact: true })
    .waitFor();
  await page.locator("#sp-screen").selectOption("uploads");
  await page
    .getByRole("button", { name: "Choose ZIP or JSON files", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Question package title" })
    .fill("Biology sample");
  await page
    .getByRole("button", { name: "Send for admin approval", exact: true })
    .click();
  await page
    .getByText("“Biology sample” is waiting for admin approval.", {
      exact: true,
    })
    .waitFor();
  await page.locator("#sp-screen").selectOption("reviewdetail");
  await page
    .getByRole("button", { name: "Reject package", exact: true })
    .click();
  await page
    .getByText("Add a reason so the uploader understands the rejection.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Admin review note" })
    .fill("Verified answer and kazanım.");
  await page
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click();
  await page.getByText("Quality starts here.", { exact: true }).waitFor();
  await page.locator("#sp-screen").selectOption("login");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page.getByText("Make room to grow,", { exact: false }).waitFor();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  for (const id of pages) {
    await page.locator("#sp-screen").selectOption(id);
    await page.waitForTimeout(50);
  }
  await page.locator("#sp-screen").selectOption("today");
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(artifactDir, "dark.png"),
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      screens: pages.length,
      widths: [736, 320],
      themes: ["light", "dark"],
      interactions: [
        "answer grading",
        "reflection save",
        "ZIP upload",
        "rejection validation",
        "admin approval",
        "Google preview sign-in",
      ],
      runtimeErrors: errors,
    }),
  );
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
