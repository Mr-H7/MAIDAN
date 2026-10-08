import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const base = "http://127.0.0.1:4176";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4176",
    "--strictPort",
  ],
  { cwd: new URL("..", import.meta.url), stdio: "ignore", windowsHide: true },
);
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
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Vite preview unavailable");
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  let redirectTo;
  await page.route("**/auth/v1/signup**", async (route) => {
    redirectTo = new URL(route.request().url()).searchParams.get("redirect_to");
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "Simulated test response" }),
    });
  });
  await page.goto(base);
  await page.getByRole("button", { name: "جديد هنا؟ أنشئ حسابًا" }).click();
  await page.getByLabel("الاسم الكامل").fill("Fixture Player");
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.invalid");
  await page.getByLabel("كلمة المرور").fill("fixture-password-123");
  await page.getByRole("button", { name: "إنشاء حساب" }).click();
  await page.getByRole("alert").waitFor();
  if (redirectTo !== "https://maidan-cyan.vercel.app/")
    throw new Error(
      "Production signup did not use the canonical public origin",
    );
  console.log("PASS production signup uses public MAIDAN redirect");
} finally {
  await browser?.close();
  server.kill();
}
