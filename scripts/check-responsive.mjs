import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4175",
    "--strictPort",
  ],
  { cwd: new URL("..", import.meta.url), stdio: "ignore", windowsHide: true },
);
const base = "http://127.0.0.1:4175";
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Vite unavailable");
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: ["--no-sandbox"],
  });
  for (const width of [320, 390, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(base);
    await page.locator(".auth-card").waitFor({ timeout: 15000 });
    const state = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      overflow: document.documentElement.scrollWidth > innerWidth,
      logoLoaded: document.querySelector(".auth-logo")?.naturalWidth > 0,
      markLoaded:
        innerWidth <= 700 ||
        document.querySelector(".auth-intro img")?.naturalWidth > 0,
    }));
    if (
      state.lang !== "ar" ||
      state.dir !== "rtl" ||
      state.overflow ||
      !state.logoLoaded ||
      !state.markLoaded
    )
      throw new Error(`${width}px Arabic auth: ${JSON.stringify(state)}`);
    if (width === 390) {
      await page.screenshot({ path: "tmp/auth-mobile-ar.png" });
      await page.getByRole("button", { name: "تسجيل الدخول" }).click();
      await page.getByText("أدخل بريدًا إلكترونيًا صحيحًا.").waitFor();
      await page.getByText("كلمة المرور ٨ أحرف على الأقل.").waitFor();
      await page.getByRole("button", { name: "جديد هنا؟ أنشئ حسابًا" }).click();
      await page.getByLabel("الاسم الكامل").waitFor();
      await page.getByRole("button", { name: "إنشاء حساب" }).waitFor();
      await page.getByRole("button", { name: "Switch to English" }).click();
      const en = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      if (en.lang !== "en" || en.dir !== "ltr" || en.overflow)
        throw new Error(`390px English auth: ${JSON.stringify(en)}`);
      await page.getByRole("button", { name: "Create account" }).click();
      await page.getByText("Enter a valid email address.").waitFor();
      await page
        .getByText("Password must have at least 8 characters.")
        .waitFor();
      await page.screenshot({ path: "tmp/auth-mobile-en.png" });
      await page.goto(`${base}/profile`);
      await page.locator(".auth-card").waitFor();
      if (new URL(page.url()).pathname !== "/profile")
        throw new Error(
          "Protected SPA route did not resolve through the HTML fallback",
        );
    }
    console.log(
      `PASS ${width}px auth viewport, approved assets, RTL, no horizontal overflow`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
